/* Sincronizzazione con Firebase. La carica app.js solo quando serve: all'accesso o se eri già connesso.
   users/{uid}/books/{id}  = il libro senza foto; deleted: true = eliminato (resta come segnaposto)
   users/{uid}/spines/{id} = la foto del dorso
   Se lo stesso libro è cambiato in due posti, vince la modifica più recente (campo updated). */
(() => {
  "use strict";
  const H = window.libreriaHost;
  const CONFIG = {
    apiKey: "AIzaSyA5x9Jd6qw-IVgrefBjeQwkvNdrxPZqDXM",
    authDomain: "mylibrary-2ea05.firebaseapp.com",
    projectId: "mylibrary-2ea05",
    storageBucket: "mylibrary-2ea05.firebasestorage.app",
    messagingSenderId: "411901102706",
    appId: "1:411901102706:web:eb9c7d22f2a65fab54d0eb"
  };
  const CK = "libreria-cloud";
  const readCk = () => { try { return JSON.parse(localStorage.getItem(CK) || "{}") || {}; } catch { return {}; } };
  const ck = { spineAt: {}, ...readCk() }; // spineAt: id -> versione della foto già presente nel cloud
  const saveCk = () => { try { localStorage.setItem(CK, JSON.stringify({ ...readCk(), ...ck })); } catch {} };

  firebase.initializeApp(CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // cache offline: le scritture in attesa restano salvate

  let user = null, unsub = null, timer = null;
  const pending = new Set(), gone = new Set();
  const plain = o => JSON.parse(JSON.stringify(o));
  const books = () => db.collection(`users/${user.uid}/books`);
  const spines = () => db.collection(`users/${user.uid}/spines`);
  const goalsDoc = () => db.doc(`users/${user.uid}/meta/goals`);
  const fromDoc = ({ hasSpine, deleted, ...rest }) => rest;
  const toDoc = ({ id, spine, ...rest }) => plain({ ...rest, hasSpine: !!spine, deleted: false });
  const why = e => (e && (e.code || e.message)) || "errore";

  /* ---- dal dispositivo al cloud ---- */
  const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(flush, ms); };
  const changed = id => { if (!user) return; gone.delete(id); pending.add(id); later(); };
  const removed = id => { if (!user) return; pending.delete(id); gone.add(id); later(); };
  // iOS può sospendere l'app subito dopo una modifica: in quel caso invio ora, senza aspettare il ritardo.
  const sendNow = () => { if (timer && (pending.size || gone.size)) flush(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendNow(); });
  addEventListener("pagehide", sendNow);

  async function flush() {
    timer = null;
    if (!user || !(pending.size || gone.size)) return;
    const up = [...pending], down = new Set(gone), tombs = H.tombs();
    pending.clear(); gone.clear();
    const ops = [], spineDone = new Map();
    for (const id of up) {
      const b = H.books().find(x => x.id === id);
      if (!b) { down.add(id); continue; }
      ops.push({ ref: books().doc(id), data: toDoc(b) });
      if (b.spine && ck.spineAt[id] !== b.spineAt) {
        ops.push({ ref: spines().doc(id), data: { data: b.spine, at: b.spineAt } });
        spineDone.set(id, b.spineAt);
      } else if (!b.spine && id in ck.spineAt) {
        ops.push({ ref: spines().doc(id), del: true });
        spineDone.set(id, null);
      }
    }
    for (const id of down) {
      ops.push({ ref: books().doc(id), data: { deleted: true, hasSpine: false, updated: tombs[id] || Date.now() } });
      ops.push({ ref: spines().doc(id), del: true });
    }
    try {
      for (let i = 0; i < ops.length; i += 400) {
        const batch = db.batch();
        for (const o of ops.slice(i, i + 400)) { if (o.del) batch.delete(o.ref); else batch.set(o.ref, o.data); }
        await batch.commit();
      }
      for (const [id, at] of spineDone) { if (at === null) delete ck.spineAt[id]; else ck.spineAt[id] = at; }
      for (const id of down) { delete ck.spineAt[id]; H.clearTomb(id); }
      saveCk();
    } catch (e) {
      // Riprovo più tardi: le modifiche restano in coda.
      up.forEach(id => pending.add(id)); down.forEach(id => gone.add(id));
      later(15000);
      H.error("Sincronizzazione non riuscita (" + why(e) + "). Riprovo tra poco.");
    }
  }

  /* ---- dal cloud al dispositivo ---- */
  async function adopt(id, r) {
    const local = H.books().find(x => x.id === id);
    let spine = null;
    if (r.hasSpine) {
      if (local && local.spine && local.spineAt === r.spineAt) spine = local.spine;
      else { const s = await spines().doc(id).get(); if (s.exists) spine = s.data().data; }
      if (spine) ck.spineAt[id] = r.spineAt;
    } else delete ck.spineAt[id];
    saveCk();
    H.setLocal(id, { ...fromDoc(r), id, spine: spine || undefined });
  }

  // Obiettivo di lettura: vince la versione con la data più recente.
  async function syncGoals() {
    const snap = await goalsDoc().get();
    const r = snap.exists ? snap.data() : null, l = H.goals();
    const lu = l.updated || (Object.keys(l.goals).length ? 1 : 0);
    if (r && r.updated > lu) H.setGoals(r.goals || {}, r.updated);
    else if (lu && (!r || lu > r.updated)) await goalsDoc().set({ goals: l.goals, updated: lu });
  }

  // Confronta tutto il cloud con il dispositivo e applica la scelta: "merge" (vince il più recente), "cloud" o "device".
  async function reconcile(choice = "merge", snap = null) {
    snap = snap || await books().get();
    const remote = new Map();
    snap.forEach(d => remote.set(d.id, d.data()));
    // Stesso libro (titolo e autore) con un id diverso: uso quello del cloud, così non si duplica.
    const liveId = new Map();
    for (const [id, r] of remote) if (!r.deleted) liveId.set(H.keyOf(r), id);
    for (const b of [...H.books()]) {
      const rid = liveId.get(H.keyOf(b));
      if (rid && rid !== b.id && !remote.has(b.id)) H.renameLocal(b.id, rid);
    }
    const tombs = H.tombs();
    const ids = new Set([...H.books().map(b => b.id), ...remote.keys(), ...Object.keys(tombs)]);
    for (const id of ids) {
      const lb = H.books().find(x => x.id === id), r = remote.get(id);
      const L = lb ? { t: lb.updated || 0, book: lb } : tombs[id] ? { t: tombs[id], book: null } : null;
      const R = r ? { t: r.updated || 0, book: r.deleted ? null : fromDoc(r) } : null;
      const win = choice === "cloud" ? R
        : choice === "device" ? (L && L.book ? L : null)
        : !L ? R : !R ? L : L.t > R.t ? L : R;
      if (win && win.book && win === L) {
        if (!R || !R.book || R.t < L.t || choice === "device") pending.add(id);
      } else if (win && win.book) {
        if (choice === "cloud" || !lb || (lb.updated || 0) < win.t) await adopt(id, r);
      } else {
        if (lb) H.setLocal(id, null);
        if (R && R.book) gone.add(id);
      }
    }
    for (const id of Object.keys(tombs)) H.clearTomb(id);
    ck.uid = user.uid; saveCk();
    H.refresh();
    await flush();
    await syncGoals();
  }

  // Ascolto il cloud: le modifiche fatte su altri dispositivi arrivano qui, anche a app aperta.
  // Stato mostrato nella scheda: ci sono modifiche non ancora inviate? quanti libri ci sono nel cloud?
  let info = null;
  function showInfo() {
    if (!info) { H.info("Non ancora sincronizzato su questo dispositivo."); return; }
    const t = new Date(info.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    H.info(`Modifiche non ancora inviate: ${info.pending ? "sì" : "no"} · libri nel cloud: ${info.count} · aggiornato alle ${t}${info.fromCache ? " (copia locale: nessuna rete)" : ""}`);
  }

  function listen() {
    if (unsub) unsub();
    unsub = books().onSnapshot({ includeMetadataChanges: true }, snap => {
      info = { pending: !!snap.metadata.hasPendingWrites, fromCache: !!snap.metadata.fromCache, at: Date.now(), count: snap.docs.filter(d => !d.data().deleted).length };
      showInfo();
      let n = 0; const jobs = [];
      snap.docChanges().forEach(ch => {
        if (ch.type === "removed") return;
        const id = ch.doc.id, r = ch.doc.data(), lb = H.books().find(x => x.id === id);
        if (lb && (lb.updated || 0) >= (r.updated || 0)) return;   // è già la versione più recente (anche le mie scritture)
        if ((H.tombs()[id] || 0) >= (r.updated || 0)) return;      // ho un'eliminazione più recente in coda
        n++;
        if (r.deleted) { if (lb) H.setLocal(id, null); } else jobs.push(adopt(id, r));
      });
      Promise.all(jobs).then(() => { if (n) H.refresh(); }).catch(e => H.error("Sincronizzazione non riuscita (" + why(e) + ")."));
    }, e => H.error("Sincronizzazione non riuscita (" + why(e) + ")."));
    if (goalsUnsub) goalsUnsub();
    goalsUnsub = goalsDoc().onSnapshot(d => {
      if (!d.exists) return;
      const r = d.data(), l = H.goals();
      if (r.updated > l.updated) { H.setGoals(r.goals || {}, r.updated); H.refresh(); }
    });
  }
  let goalsUnsub = null;

  async function start() {
    const first = ck.uid !== user.uid;
    ck.email = user.email; saveCk();
    H.connected(user.email);
    window.libreriaCloud.connected = true;
    H.status("Sincronizzo i libri…");
    try {
      const snap = await books().get();
      let choice = "merge";
      const live = snap.docs.filter(d => !d.data().deleted).length;
      // Primo accesso da questo dispositivo, con libri da entrambe le parti: chiedo come unirli.
      if (first && H.books().length && live) {
        choice = await H.askMerge(live);
        if (!choice) { await auth.signOut(); return; }
      }
      await reconcile(choice, snap);
      listen();
      H.done("Libreria sincronizzata: " + user.email + ".");
    } catch (e) {
      listen();
      H.error("Sincronizzazione non riuscita (" + why(e) + "). Riprovo quando torna la connessione.");
    }
  }

  // Ponte per app.js. Le modifiche arrivano da changed/removed; il resto è interno.
  window.libreriaCloud = {
    connected: false,
    changed, removed,
    signInGoogle() {
      const p = new firebase.auth.GoogleAuthProvider();
      const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
      if (standalone) { sessionStorage.setItem("libreria-auth-pending", "1"); return auth.signInWithRedirect(p); }
      return auth.signInWithPopup(p);
    },
    sendLink(email) {
      return auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true });
    },
    finishLink(email, link) {
      return auth.signInWithEmailLink(email, link).then(() => history.replaceState(null, "", location.pathname));
    },
    signOut() { return auth.signOut(); },
    goals() { if (user) goalsDoc().set(H.goals()).catch(e => H.error("Obiettivo non inviato (" + why(e) + ")."));
    },
    reconnect() {
      H.info("Riconnessione in corso…");
      return db.disableNetwork().then(() => db.enableNetwork()).then(() => { if (user) return reconcile("merge"); })
        .then(() => showInfo(), e => H.info("Riconnessione non riuscita (" + why(e) + ")."));
    },
    refreshInfo() { showInfo(); },
    syncNow() {
      if (!user) return Promise.resolve();
      H.status("Sincronizzo i libri…");
      return reconcile("merge").then(() => H.done("Libreria sincronizzata."), e => H.error("Sincronizzazione non riuscita (" + why(e) + ")."));
    }
  };

  auth.onAuthStateChanged(u => {
    user = u || null;
    if (user) { start(); return; }
    window.libreriaCloud.connected = false;
    clearTimeout(timer); pending.clear(); gone.clear();
    if (unsub) unsub();
    unsub = null;
    if (goalsUnsub) goalsUnsub();
    goalsUnsub = null;
    ck.email = ""; saveCk();
    H.connected("");
  });
  auth.getRedirectResult().catch(() => {}).finally(() => { try { sessionStorage.removeItem("libreria-auth-pending"); } catch {} });
})();
