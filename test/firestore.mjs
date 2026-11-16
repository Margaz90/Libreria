// Regole di Firestore (v94): provate con l'emulatore ufficiale (jar Java), senza toccare il cloud vero.
// Le richieste sono REST con token non firmati, che l'emulatore accetta (come fa @firebase/rules-unit-testing).
// Se Java o il download dell'emulatore mancano, il gruppo lo dice e si salta.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { ok, ROOT } from './lib.mjs';

const JAR_URL = 'https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.7.jar';
const CACHE = path.join(os.homedir(), '.cache', 'libreria'), JAR = path.join(CACHE, path.basename(JAR_URL));
const PORT = Number(process.env.TEST_PORT || 8765) + 2, BASE = `http://127.0.0.1:${PORT}`, P = 'demo-libreria';
const DOCS = `${BASE}/v1/projects/${P}/databases/(default)/documents`;
const ADMIN = '46AtxF1piJQGsWcqm665Wjf6nFA3';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
// Token di accesso finto: Google o link via email hanno uid, email ed email_verified.
const token = ({ uid, email, verificata = true }) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({
  iss: `https://securetoken.google.com/${P}`, aud: P, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, auth_time: Math.floor(Date.now() / 1000),
  sub: uid, user_id: uid, email, email_verified: verificata, firebase: { sign_in_provider: 'google.com', identities: {} }
}) + '.';
const chiama = async (chi, metodo, percorso, corpo) => {
  const r = await fetch(percorso.startsWith('http') ? percorso : `${DOCS}/${percorso}`, {
    method: metodo, headers: { ...(chi ? { Authorization: 'Bearer ' + (chi === 'owner' ? 'owner' : token(chi)) } : {}), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  return r.status;
};
const doc = { fields: { t: { stringValue: 'x' } } };
const leggi = (chi, p) => chiama(chi, 'GET', p), scrivi = (chi, p) => chiama(chi, 'PATCH', p, doc), cancella = (chi, p) => chiama(chi, 'DELETE', p);
const sì = s => s === 200, no = s => s === 403;

async function emulatore() {
  try { execFileSync('java', ['-version'], { stdio: 'ignore' }); } catch { return null; }
  if (!fs.existsSync(JAR)) {
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      const r = await fetch(JAR_URL); if (!r.ok) return null;
      fs.writeFileSync(JAR + '.part', Buffer.from(await r.arrayBuffer())); fs.renameSync(JAR + '.part', JAR);
    } catch { return null; }
  }
  const proc = spawn('java', ['-jar', JAR, '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { // fino a 60 s
    try { if ((await fetch(BASE + '/')).ok) return proc; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  proc.kill(); return null;
}

export default async function run() {
  const regole = (() => { try { return fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'); } catch { return ''; } })();
  ok('firestore.rules esiste', !!regole);
  if (!regole) return;
  const proc = await emulatore();
  if (!proc) { console.log('  firestore: emulatore non disponibile (Java o download), gruppo saltato'); return; }
  try {
    const st = await chiama('owner', 'PUT', `${BASE}/emulator/v1/projects/${P}:securityRules`, { rules: { files: [{ name: 'firestore.rules', content: regole }] } });
    ok('regole caricate nell\'emulatore', st === 200, String(st));
    const admin = { uid: ADMIN, email: 'diego@example.com' };
    const mario = { uid: 'mario1', email: 'Mario.Rossi@Gmail.com' }, anna = { uid: 'anna1', email: 'anna@example.com' }, ugo = { uid: 'ugo1', email: 'ugo@example.com' };
    await scrivi('owner', 'invitati/mario.rossi@gmail.com'); await scrivi('owner', 'invitati/anna@example.com');
    await scrivi('owner', `users/${ADMIN}/books/x`); await scrivi('owner', 'users/mario1/books/x'); await scrivi('owner', 'users/ugo1/books/x');

    ok('amministratore: legge e scrive i suoi libri', sì(await leggi(admin, `users/${ADMIN}/books/x`)) && sì(await scrivi(admin, `users/${ADMIN}/books/y`)));
    ok('amministratore: vede l\'elenco degli invitati, aggiunge e toglie', sì(await leggi(admin, 'invitati')) && sì(await scrivi(admin, 'invitati/nuovo@example.com')) && sì(await cancella(admin, 'invitati/nuovo@example.com')));
    ok('invitato (email con maiuscole): legge e scrive solo i suoi libri', sì(await leggi(mario, 'users/mario1/books/x')) && sì(await scrivi(mario, 'users/mario1/books/y')) && sì(await scrivi(mario, 'users/mario1/meta/goals')));
    ok('invitato: niente libri degli altri', no(await leggi(mario, `users/${ADMIN}/books/x`)) && no(await scrivi(mario, `users/${ADMIN}/books/z`)) && no(await leggi(mario, 'users/ugo1/books/x')));
    ok('invitato: legge il proprio invito, non quelli altrui né l\'elenco', sì(await leggi(mario, 'invitati/mario.rossi@gmail.com')) && no(await leggi(mario, 'invitati/anna@example.com')) && no(await leggi(mario, 'invitati')));
    ok('invitato: non può scrivere inviti', no(await scrivi(mario, 'invitati/amico@example.com')) && no(await cancella(mario, 'invitati/anna@example.com')));
    ok('invitato: può leggere il proprio invito anche se non esiste (risposta «non trovato», non «vietato»)', (await leggi(ugo, 'invitati/ugo@example.com')) === 404);
    ok('non invitato: niente libri, nemmeno i suoi', no(await leggi(ugo, 'users/ugo1/books/x')) && no(await scrivi(ugo, 'users/ugo1/books/y')));
    ok('email non verificata: respinta anche se invitata', no(await leggi({ ...anna, verificata: false }, 'users/anna1/books/x')) && no(await scrivi({ ...anna, verificata: false }, 'users/anna1/books/x')));
    ok('senza accesso: niente', no(await leggi(null, 'users/mario1/books/x')) && no(await leggi(null, 'invitati/mario.rossi@gmail.com')));
    await cancella('owner', 'invitati/mario.rossi@gmail.com');
    ok('invitato tolto dall\'elenco: perde subito l\'accesso', no(await leggi(mario, 'users/mario1/books/x')));
    const writes = Array.from({ length: 400 }, (_, i) => ({ update: { name: `projects/${P}/databases/(default)/documents/users/anna1/books/b${i}`, fields: doc.fields } }));
    const cm = await chiama(anna, 'POST', `${DOCS}:commit`, { writes });
    ok('invitato: 400 libri in un colpo solo (scrittura multipla)', sì(cm), String(cm));
  } finally { proc.kill(); }
}
