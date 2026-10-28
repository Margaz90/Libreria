/* Libreria di Diego — PWA
   Dati salvati sul dispositivo (localStorage), ricerca libri e copertine da Google Books e Open Library. */
(() => {
  "use strict";

  const LS_KEY = "libreria-diego-v1";
  // Chiave per Google Books: limitata al sito dell'app e alla sola Books API.
  const GBOOKS_KEY = "AIzaSyDsTZ7a1APohAMSTQ_eUuVOKKwoe7ozeLE";
  const BINDINGS = ["#7E2E2A", "#2D4F45", "#23395B", "#A06A1F", "#4B5563", "#5B3557", "#1F6266", "#9A4A28", "#3F4A2B", "#6B2F3F"];
  const STATUS = { "in-lettura": "In lettura", "letto": "Letti", "da-leggere": "Da leggere", "desiderato": "Lista dei desideri" };
  const STATUS_ONE = { "in-lettura": "In lettura", "letto": "Letto", "da-leggere": "Da leggere", "desiderato": "Desiderato" };
  const FIELDS = ["title", "author", "year", "pages", "genre", "status", "rating", "started", "finished", "finishedYear", "notes", "quote", "callNo", "synopsis", "color", "isbn", "cover", "noCover", "spine", "spineRatio", "page", "pageStep", "coverManual", "added", "updated", "spineAt", "series", "seriesNo", "seriesNext", "seriesManual"];
  const GENRES_EN = { "Fiction": "Narrativa", "Biography & Autobiography": "Biografia", "History": "Storia", "Science": "Scienza", "Juvenile Fiction": "Ragazzi", "Young Adult Fiction": "Ragazzi", "True Crime": "True crime", "Poetry": "Poesia", "Philosophy": "Filosofia", "Business & Economics": "Economia", "Travel": "Viaggi", "Psychology": "Psicologia", "Comics & Graphic Novels": "Fumetti", "Cooking": "Cucina", "Religion": "Religione", "Political Science": "Politica", "Self-Help": "Crescita personale", "Social Science": "Scienze sociali", "Literary Criticism": "Saggistica", "Music": "Musica", "Sports & Recreation": "Sport", "Art": "Arte", "Drama": "Teatro" };

  const state = { books: [], view: "libreria", mode: "dorsi", filter: "tutti", q: "", sort: "recenti", coverJob: null, limit: {} };
  const PAGE = 15; // libri mostrati per volta in ogni scaffale e nelle copertine: il resto si apre con "Mostra altri"
  const resetLimits = () => { state.limit = {}; };
  const FILTERS = [["tutti", "Tutti"], ["in-lettura", "In lettura"], ["letto", "Letti"], ["da-leggere", "Da leggere"], ["desiderato", "Desideri"]];

  /* ---------- utilità ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const colorOf = b => (b.color && /^#[0-9a-f]{6}$/i.test(b.color)) ? b.color : BINDINGS[hash(b.title + b.author) % BINDINGS.length];
  const starStr = n => n > 0 ? "★".repeat(n) + "☆".repeat(5 - n) : "";
  const yearOf = d => (d && /^\d{4}/.test(d)) ? Number(d.slice(0, 4)) : null;
  const fmtDate = d => { if (!d) return ""; const [y, m, g] = d.split("-"); return g ? `${g}/${m}/${y}` : d; };
  const keyOf = b => (String(b.title || "") + "|" + String(b.author || "")).toLowerCase().trim();
  const newId = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Serie: chiave dei nomi, riga «Serie · N», etichetta, bollino.
  const seriesKey = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const serLabel = b => b.series ? b.series + (b.seriesNo ? " · " + b.seriesNo : "") : "";
  const serAria = b => b.seriesNo ? `, ${esc(b.series)} numero ${esc(b.seriesNo)}` : "";
  const snoHTML = b => b.seriesNo ? `<span class="sno${/\.|.../.test(b.seriesNo) ? " long" : ""}" aria-hidden="true">${esc(b.seriesNo)}</span>` : "";
  const surname3 = a => { const p = String(a || "").trim().split(/\s+/); return (p[p.length - 1] || "").replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 3).toUpperCase(); };

  function toast(msg, action) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
    const span = document.createElement("span"); span.textContent = msg; t.append(span);
    if (action) { const b = document.createElement("button"); b.textContent = action.label; b.onclick = () => { t.remove(); action.run(); }; t.append(b); }
    document.body.append(t);
    setTimeout(() => t.remove(), action ? 10000 : 2800);
  }

  /* ---------- impostazioni ---------- */
  const SET_KEY = "libreria-settings";
  function getSet() { try { return JSON.parse(localStorage.getItem(SET_KEY) || "{}") || {}; } catch { return {}; } }
  function setSet(patch) {
    const v = { ...getSet(), ...patch };
    if (patch.goals) v.goalsAt = Date.now(); // quando è cambiato l'obiettivo: serve per capire quale versione è più recente
    try { localStorage.setItem(SET_KEY, JSON.stringify(v)); } catch {}
    if (patch.goals) cloudHook("goals");
    return v;
  }
  // Data di oggi nel fuso del dispositivo (toISOString darebbe quella di Greenwich: dopo mezzanotte risulterebbe ieri).
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  // Chi è connesso e l'ultima email usata (solo per riconoscere il dispositivo, nessun dato dei libri).
  const CLOUD_KEY = "libreria-cloud";
  const cloudInfo = () => { try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || "{}") || {}; } catch { return {}; } };
  const setCloudInfo = patch => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ ...cloudInfo(), ...patch })); } catch {} };
  // Libri eliminati da comunicare al cloud (subito se sei connesso, altrimenti al prossimo accesso).
  const TOMB_KEY = "libreria-tombs";
  const getTombs = () => { try { return JSON.parse(localStorage.getItem(TOMB_KEY) || "{}") || {}; } catch { return {}; } };
  const setTombs = t => { try { localStorage.setItem(TOMB_KEY, JSON.stringify(t)); } catch {} };
  function cloudHook(name, id) { const c = window.libreriaCloud; if (c && c.connected) c[name](id); }

  /* ---------- archivio sul dispositivo ---------- */
  // Le foto dei dorsi stanno in chiavi separate: così l'elenco principale resta leggero da salvare.
  const SPINE_KEY = id => "libreria-spine-" + id;
  const spineWritten = new Map();
  function load() {
    let v = [];
    try { v = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); if (!Array.isArray(v)) v = []; } catch { v = []; }
    for (const b of v) {
      if (!b.updated) b.updated = b.added || 1;
      if (b.spine && !b.spineAt) b.spineAt = b.updated;
      if (b.spine && b.spine !== 1) { spineWritten.set(b.id, null); continue; } // dati vecchi: verranno spostati al prossimo salvataggio
      if (b.spine === 1) { try { const d = localStorage.getItem(SPINE_KEY(b.id)); if (d) { b.spine = d; spineWritten.set(b.id, d); } else delete b.spine; } catch { delete b.spine; } }
    }
    return v;
  }
  function persist() {
    clearTimeout(persistTimer); persistTimer = null;
    try {
      const ids = new Set();
      const slim = state.books.map(b => {
        if (!b.spine) return b;
        ids.add(b.id);
        if (spineWritten.get(b.id) !== b.spine) { localStorage.setItem(SPINE_KEY(b.id), b.spine); spineWritten.set(b.id, b.spine); }
        return { ...b, spine: 1 };
      });
      for (const id of [...spineWritten.keys()]) if (!ids.has(id)) { localStorage.removeItem(SPINE_KEY(id)); spineWritten.delete(id); }
      localStorage.setItem(LS_KEY, JSON.stringify(slim));
      return true;
    } catch { toast("Spazio esaurito sul dispositivo: esporta un backup ed elimina qualche libro."); return false; }
  }
  // Salvataggio raggruppato: più modifiche ravvicinate diventano una sola scrittura.
  let persistTimer = null;
  function schedulePersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 700); }
  document.addEventListener("visibilitychange", () => { if (document.hidden && persistTimer) persist(); });
  window.addEventListener("pagehide", () => { if (persistTimer) persist(); });
  function clean(b) {
    const out = {};
    for (const k of FIELDS) if (b[k] !== undefined && b[k] !== null && b[k] !== "") out[k] = b[k];
    out.title = String(out.title || "Senza titolo");
    out.status = STATUS_ONE[out.status] ? out.status : "da-leggere";
    if (out.year) out.year = Number(out.year) || undefined;
    if (out.pages) out.pages = Number(out.pages) || undefined;
    // Date di lettura solo come AAAA-MM-GG: arrivano anche da file importati e dal cloud, e finiscono nella pagina.
    for (const k of ["started", "finished"]) if (out[k] !== undefined && !(typeof out[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out[k]))) delete out[k];
    // Solo l'anno di lettura, per i libri letti senza data di fine: vale solo un anno plausibile e mai insieme alla data.
    if (out.finishedYear !== undefined) { const y = Number(out.finishedYear); if (out.finished || !Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) delete out.finishedYear; else out.finishedYear = y; }
    // Salto dell'ultima pagina scritta (per «+N»): intero tra 1 e 2000.
    if (out.pageStep !== undefined) { const n = Number(out.pageStep); if (!Number.isInteger(n) || n < 1 || n > 2000) delete out.pageStep; else out.pageStep = n; }
    if (out.spine && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(out.spine)) { delete out.spine; delete out.spineRatio; }
    // Serie ≤ 80, seguito ≤ 200, numero ≥ 0 (max 6 caratteri); senza serie niente numero né seguito.
    for (const [k, n] of [["series", 80], ["seriesNext", 200]]) if (out[k] !== undefined) { const v = String(out[k]).replace(/\s+/g, " ").trim().slice(0, n); if (v) out[k] = v; else delete out[k]; }
    if (out.seriesNo !== undefined) { const v = String(out.seriesNo).trim().replace(",", "."); if (v.length <= 6 && /^\d+(\.\d+)?$/.test(v)) out.seriesNo = v; else delete out.seriesNo; }
    if (!out.series) { delete out.seriesNo; delete out.seriesNext; }
    if (out.seriesManual !== true) delete out.seriesManual;
    out.rating = Math.max(0, Math.min(5, Number(out.rating) || 0));
    if (!out.added) out.added = Date.now();
    return out;
  }
  function upsert(b) {
    const data = clean(b);
    let id = b.id, i = id ? state.books.findIndex(x => x.id === id) : -1;
    const prev = i >= 0 ? state.books[i] : null;
    data.updated = Date.now();
    if (data.spine && (!prev || prev.spine !== data.spine)) data.spineAt = data.updated;
    if (!id) id = newId();
    if (i >= 0) state.books[i] = { ...data, id }; else state.books.push({ ...data, id });
    schedulePersist();
    // Se cambiano solo dati che non spostano il libro, aggiorno solo il suo dorso/copertina.
    const keep = ["status", "title", "author", "rating", "finished", "started", "added", "genre", "page", "pages", "series", "seriesNo"];
    if (prev && state.view !== "stats" && data.status !== "in-lettura" && keep.every(k => prev[k] === state.books.find(x => x.id === id)[k])) {
      patchBook(id); renderTally();
    } else render();
    cloudHook("changed", id);
    return id;
  }
  // Pagina rapida: salva come upsert ma ridisegna solo l'hero. add = pagine da aggiungere, to = pagina esatta;
  // manual (campo numerico o cursore) ricorda il salto in pageStep. «Annulla» ripristina page e pageStep di prima di questo gesto.
  function pageQuick(id, { add, to, manual } = {}) {
    const prev = state.books.find(x => x.id === id); if (!prev) return;
    const oldPage = Math.max(0, Number(prev.page) || 0), tot = Number(prev.pages) || 0;
    let v = Math.max(0, Math.round(Number(to !== undefined ? to : oldPage + (add || 0)) || 0));
    if (tot) v = Math.min(v, tot);
    const jump = v - oldPage;
    const step = manual && jump >= 1 && jump <= 2000 ? jump : prev.pageStep;
    if (v === oldPage && step === prev.pageStep) return; // niente da salvare
    const before = { page: prev.page, pageStep: prev.pageStep };
    const apply = (page, pageStep, undo) => {
      const k = state.books.findIndex(x => x.id === id); if (k < 0) return;
      if (undo && state.books[k].status !== "in-lettura") return; // già finito o spostato: Annulla non tocca la pagina
      const ae = document.activeElement, fk = ae && ae.closest && ae.closest("#hero") ? ["data-add", "data-repeat", "data-save"].find(a => ae.hasAttribute(a)) : null;
      state.books[k] = { ...clean({ ...state.books[k], page, pageStep }), id, updated: Date.now() };
      schedulePersist(); renderHero(); renderTally(); cloudHook("changed", id);
      if (fk) { const sel = fk === "data-add" ? `[data-add][data-id-add="${CSS.escape(id)}"]` : `[${fk}="${CSS.escape(id)}"]`; const nb = $("#hero " + sel); if (nb) nb.focus({ preventScroll: true }); }
    };
    apply(v, step);
    toast("Pagina " + v, { label: "Annulla", run: () => apply(before.page, before.pageStep, true) });
  }
  function addMany(list, { update = false } = {}) {
    const known = new Map(state.books.map(b => [keyOf(b), b]));
    let added = 0, updated = 0, skipped = 0; const ids = [];
    for (const raw of list) {
      if (!raw || !raw.title) continue;
      const cur = known.get(keyOf(raw)), now = Date.now();
      if (cur && !update) { skipped++; continue; }
      if (cur) {
        const nb = { ...cur, ...clean(raw), id: cur.id, added: cur.added || now, updated: now };
        if (nb.spine && nb.spine !== cur.spine) nb.spineAt = now;
        state.books[state.books.indexOf(cur)] = nb; known.set(keyOf(nb), nb); ids.push(nb.id); updated++;
      } else {
        const b = { ...clean(raw), id: newId(), updated: now };
        if (b.spine) b.spineAt = now;
        state.books.push(b); known.set(keyOf(b), b); ids.push(b.id); added++;
      }
    }
    schedulePersist(); render();
    ids.forEach(id => cloudHook("changed", id));
    return { added, updated, skipped };
  }
  // Stesso libro? Per ISBN; altrimenti titolo e autore; se il file non ha l'autore, basta il titolo.
  const baseTitle = t => norm(String(t || "").split(/[.:]/)[0]); // "Joe Country. Le indagini…" = "Joe Country"
  const samePurchase = (x, raw) => (raw.isbn && x.isbn && String(x.isbn) === String(raw.isbn)) || keyOf(x) === keyOf(raw) || (!raw.author && baseTitle(x.title) === baseTitle(raw.title));
  // Acquisti: un libro nuovo va in Da leggere; uno già nella lista dei desideri passa in Da leggere; gli altri non si toccano.
  function addPurchases(list) {
    const now = Date.now(), ids = [], newIds = [];
    let added = 0, moved = 0;
    for (const raw of list) {
      if (!raw || !raw.title) continue;
      const i = state.books.findIndex(x => samePurchase(x, raw));
      if (i < 0) {
        const b = { ...clean({ ...raw, status: "da-leggere" }), id: newId(), updated: now };
        state.books.push(b); ids.push(b.id); newIds.push(b.id); added++;
      } else if (state.books[i].status === "desiderato") {
        state.books[i] = { ...state.books[i], status: "da-leggere", updated: now }; ids.push(state.books[i].id); moved++;
      }
    }
    schedulePersist(); render();
    ids.forEach(id => cloudHook("changed", id));
    return { added, moved, newIds };
  }
  // Tutte le informazioni su un libro: prima per ISBN (Google Books, Open Library), poi per titolo e autore
  // (Apple Books Italia, Google Books, Open Library), così basta che una fonte risponda.
  async function fetchInfo(b, errors = {}) {
    const isbn = String(b.isbn || "").replace(/[^\dXx]/g, "");
    const byIsbn = isbn ? await settle([
      () => googleSearch("isbn:" + isbn, { italian: false, max: 3 }).then(tag("Google Books")),
      () => openLibrarySearch("isbn:" + isbn, "", 3).then(tag("Open Library")),
      () => wikidataSearch(isbn).then(tag("Wikidata"))
    ], errors) : [];
    const idHit = byIsbn.find(x => x.author) || byIsbn[0];
    const author = b.author || (idHit && idHit.author) || "";
    const last = author.split(",")[0].trim().split(/\s+/).pop() || ""; // cognome del primo autore
    const t = String(b.title || "").split(/[.:]/)[0].trim(); // "Joe Country. Le indagini…" → "Joe Country"
    const byTitle = t ? await settle([
      () => appleSearch(`${t} ${last}`.trim(), 8).then(tag("Apple Books")),
      () => googleSearch(`intitle:"${t}"` + (last ? ` inauthor:${last}` : ""), { max: 6 }).then(tag("Google Books")),
      () => openLibrarySearch(t, last).then(tag("Open Library"))
    ], errors) : [];
    // Senza autore accetto solo titoli uguali, per non prendere un libro diverso con un titolo simile.
    const ref = { ...b, title: t, author };
    const ranked = byTitle.filter(x => author ? sameAuthor(author, x.author) : baseTitle(x.title) === baseTitle(t))
      .map(x => ({ ...x, score: itScore(ref, x) })).filter(x => x.score >= 2)
      .sort((p, q) => q.score - p.score);
    const pool = [...byIsbn, ...ranked];
    if (!pool.length) return null;
    const pick = k => (pool.find(x => x[k]) || {})[k];
    const guess = c => /covers\.openlibrary\.org\/b\/isbn\//.test(c); // copertina "a tentativo" per ISBN: solo se non c'è altro
    const cover = (byIsbn.find(x => x.cover && !guess(x.cover)) || ranked.find(x => x.cover) || pool.find(x => x.cover) || {}).cover || "";
    return {
      author: (idHit && idHit.author) || (ranked[0] && ranked[0].author) || "",
      edYear: pick("edYear"), pages: pick("pages"), genre: pick("genre"), synopsis: pick("synopsis"),
      isbn: isbn || pick("isbn") || "", cover
    };
  }
  // Completa autore, anno, pagine, genere e copertina per ISBN, in sottofondo: l'app resta usabile.
  const enrich = { busy: false };
  // Generazione dei dati: il ripristino di una copia la incrementa e i lavori in sottofondo partiti prima si fermano.
  let dataGen = 0;
  async function enrichBooks(ids) {
    if (enrich.busy) { toast("Aggiornamento già in corso."); return; }
    enrich.busy = true;
    const gen = dataGen, line = $("#enrich");
    const errors = {}, sc = new Map(); let fixed = 0, missed = 0, ser = 0, wdOff = false;
    for (let k = 0; k < ids.length; k++) {
      if (line) { line.hidden = false; line.textContent = `Aggiornamento informazioni dei libri: ${k + 1} di ${ids.length}`; }
      const b = state.books.find(x => x.id === ids[k]);
      if (b && (!b.author || (!b.cover && !b.noCover))) {
        const errs = {};
        const hit = await fetchInfo(b, errs).catch(() => null);
        if (gen !== dataGen) return; // copia ripristinata nel frattempo
        if (hit && (hit.author || hit.cover)) {
          if (!b.author && hit.author) b.author = hit.author;
          if (!b.year && hit.edYear) b.year = hit.edYear;
          if (!b.pages && hit.pages) b.pages = hit.pages;
          if (!b.genre && hit.genre) b.genre = hit.genre;
          if (!b.synopsis && hit.synopsis) b.synopsis = hit.synopsis;
          if (!b.isbn && hit.isbn) b.isbn = hit.isbn;
          if (!b.callNo && b.author) b.callNo = surname3(b.author);
          if (!b.cover && !b.noCover && hit.cover) b.cover = hit.cover;
          b.updated = Date.now(); fixed++;
          cloudHook("changed", b.id);
          patchBook(b.id); // il dorso o la copertina compaiono subito
        } else {
          missed++;
          Object.entries(errs).forEach(([c, n]) => { errors[c] = (errors[c] || 0) + n; });
        }
      }
      if (b && !wdOff && !b.series && !b.seriesManual) { // anche la serie
        const r = await findSeries(b, sc).catch(e => { wdOff = /wikidata-(429|503)/.test(e && e.code); return null; });
        if (gen !== dataGen) return;
        if (r) { Object.assign(b, clean(applySeries(b, r)), { updated: Date.now() }); ser++; cloudHook("changed", b.id); patchBook(b.id); }
      }
      await sleep(250);
      if (gen !== dataGen) return;
    }
    enrich.busy = false;
    if (line) line.hidden = true;
    schedulePersist(); if (ser) render(); else renderTally();
    const err = Object.entries(errors).map(([k, n]) => `${k} ×${n}`).join(", ");
    toast(`Informazioni aggiornate per ${fixed} libri su ${ids.length}.` + (missed ? ` Non trovati: ${missed}${err ? " (" + err + ")" : ""}.` : ""));
  }

  function removeBook(id) {
    const t = getTombs(); t[id] = Date.now(); setTombs(t);
    state.books = state.books.filter(x => x.id !== id); schedulePersist(); render(); cloudHook("removed", id);
  }

  /* ---------- copie prima delle operazioni su molti libri (IndexedDB) ---------- */
  // Ogni copia: { id = at (ms), at, label, books } senza le foto dei dorsi; si tengono le ultime 3.
  async function copies(mode, fn) {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("libreria-copie", 1);
      // su WebKit l'apertura a volte non risponde: meglio nessuna copia che un import bloccato
      let late = false;
      const t = setTimeout(() => { late = true; rej(new Error("timeout")); }, 1500);
      r.onupgradeneeded = () => r.result.createObjectStore("copie", { keyPath: "id" });
      r.onsuccess = () => { clearTimeout(t); if (late) r.result.close(); else res(r.result); }; // aperto in ritardo: lo chiudo
      r.onerror = r.onblocked = () => { clearTimeout(t); rej(r.error); };
    });
    return new Promise((res, rej) => {
      const t = db.transaction("copie", mode), q = fn(t.objectStore("copie"));
      t.oncomplete = () => { db.close(); res(q && q.result); };
      t.onerror = t.onabort = () => { db.close(); rej(t.error); };
    });
  }
  let lastCopy = 0;
  // Non blocca mai l'operazione: se IndexedDB manca o fallisce restituisce false.
  async function snapshot(label) {
    try {
      const at = lastCopy = Math.max(Date.now(), lastCopy + 1);
      const books = state.books.map(b => { const c = { ...clean(b), id: b.id }; delete c.spine; delete c.spineRatio; delete c.spineAt; return c; });
      await copies("readwrite", s => { s.put({ id: at, at, label, books }); const k = s.getAllKeys(); k.onsuccess = () => k.result.slice(0, -3).forEach(x => s.delete(x)); });
      return true;
    } catch { return false; }
  }
  const listSnapshots = async () => ((await copies("readonly", s => s.getAll())) || []).reverse().map(c => ({ id: c.id, at: c.at, label: c.label, count: c.books.length, ids: c.books.map(b => b.id) }));
  const when = at => { const d = new Date(at), z = n => String(n).padStart(2, "0"); return `${z(d.getDate())}/${z(d.getMonth() + 1)} alle ${z(d.getHours())}:${z(d.getMinutes())}`; };
  async function restoreSnapshot(id) {
    let c; try { c = await copies("readonly", s => s.get(id)); } catch {}
    if (!c) return false; // letta prima della nuova copia: con 3 copie quella nuova cancellerebbe la più vecchia
    dataGen++; // ferma «Completa autori e copertine» e la ricerca delle copertine, che riempirebbero di nuovo i libri
    if (enrich.busy) { enrich.busy = false; const line = $("#enrich"); if (line) line.hidden = true; }
    state.coverJob = null;
    await snapshot("Prima del ripristino");
    const now = Date.now(), cur = new Map(state.books.map(b => [b.id, b])), keep = new Set(c.books.map(b => b.id)), t = getTombs();
    const gone = state.books.filter(b => !keep.has(b.id)).map(b => b.id);
    gone.forEach(x => { t[x] = now; }); keep.forEach(x => delete t[x]); setTombs(t); // come removeBook, ma con un solo render
    state.books = c.books.map(b => {
      const o = cur.get(b.id) || {}, nb = { ...clean(b), id: b.id, updated: now };
      for (const k of ["spine", "spineRatio", "spineAt"]) if (o[k]) nb[k] = o[k];
      return nb;
    });
    schedulePersist(); render();
    gone.forEach(x => cloudHook("removed", x)); keep.forEach(x => cloudHook("changed", x));
    toast("Libreria riportata al " + when(c.at));
    return true;
  }

  /* ---------- Google Books / Open Library ---------- */
  function normVolume(v) {
    const i = v.volumeInfo || {};
    const ids = i.industryIdentifiers || [];
    const isbn = (ids.find(x => x.type === "ISBN_13") || ids.find(x => x.type === "ISBN_10") || {}).identifier || "";
    let cover = (i.imageLinks && (i.imageLinks.thumbnail || i.imageLinks.smallThumbnail)) || "";
    if (cover) cover = cover.replace(/^http:/, "https:").replace("&edge=curl", "");
    if (!cover && isbn) cover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const cat = (i.categories || [])[0] || "";
    const desc = String(i.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: [i.title, i.subtitle && i.subtitle.length < 40 ? i.subtitle : ""].filter(Boolean).join(". "),
      author: (i.authors || []).join(", "),
      edYear: yearOf(i.publishedDate || ""),
      pages: i.pageCount || undefined,
      genre: GENRES_EN[cat] || (cat && !/fiction|general/i.test(cat) ? cat : ""),
      synopsis: desc.length > 420 ? desc.slice(0, 400).replace(/\s\S*$/, "") + "…" : desc,
      isbn, cover, lang: i.language || "", ita: i.language === "it"
    };
  }
  // --- fonte 1: Google Books ---
  // Il messaggio con cui Google spiega l'errore (per capire la causa).
  async function googleMsg(r) { try { const j = await r.json(); return j && j.error ? j.error.message : ""; } catch { return ""; } }
  async function googleSearch(q, { italian = true, max = 12 } = {}) {
    if (state.googleDown && Date.now() < state.googleDown.until) throw { code: "google-" + state.googleDown.code };
    const url = "https://www.googleapis.com/books/v1/volumes?key=" + GBOOKS_KEY + "&printType=books&maxResults=" + max +
      (italian ? "&langRestrict=it" : "") + "&q=" + encodeURIComponent(q);
    let r;
    try { r = await fetch(url); } catch { throw { code: "google-rete" }; }
    let retried = false;
    if (r.status === 503) { // servizio giù per le richieste con chiave: riprovo senza chiave dopo una pausa
      retried = true; await sleep(1200);
      try { r = await fetch(url.replace("key=" + GBOOKS_KEY + "&", "")); } catch { throw { code: "google-rete" }; }
    }
    // Quota finita, chiave rifiutata o servizio giù: non insisto (5 minuti se è giù, altrimenti fino alla prossima apertura).
    if (r.status === 429 || r.status === 403 || r.status === 503) {
      // Un 503, o un rifiuto dopo il tentativo senza chiave, è un problema passeggero: pausa di 5 minuti. Il resto (quota, chiave) vale per il giorno.
      state.googleDown = { code: r.status, until: Date.now() + (r.status === 503 || retried ? 5 * 60e3 : 864e5) };
      throw { code: "google-" + r.status, msg: await googleMsg(r) };
    }
    if (!r.ok) throw { code: "google-" + r.status, msg: await googleMsg(r) };
    const j = await r.json();
    return (j.items || []).map(normVolume).filter(x => x.title);
  }

  // --- fonte 2: Apple Books (negozio italiano, via JSONP) ---
  let jsonpN = 0;
  function jsonp(url, ms = 8000) {
    return new Promise((resolve, reject) => {
      const cb = "__mlcb" + (++jsonpN) + "_" + Date.now();
      const s = document.createElement("script");
      const done = (fn, v) => { clearTimeout(t); delete window[cb]; s.remove(); fn(v); };
      const t = setTimeout(() => done(reject, { code: "apple-timeout" }), ms);
      window[cb] = data => done(resolve, data);
      s.onerror = () => done(reject, { code: "apple-rete" });
      s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.head.append(s);
    });
  }
  async function appleSearch(term, max = 10) {
    const j = await jsonp("https://itunes.apple.com/search?media=ebook&entity=ebook&country=it&lang=it_it&limit=" + max + "&term=" + encodeURIComponent(term));
    return (j.results || []).map(r => ({
      title: r.trackName || "", author: r.artistName || "",
      edYear: yearOf(r.releaseDate || ""), pages: undefined,
      genre: (r.genres || []).find(g => !/^(Libri|Books)$/i.test(g)) || "",
      synopsis: String(r.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
      isbn: "", lang: "", ita: true,
      cover: r.artworkUrl100 ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x900bb.") : ""
    })).filter(x => x.title);
  }

  // --- fonte 3: Open Library ---
  async function openLibrarySearch(title, author, max = 8) {
    const byIsbn = /^isbn:/.test(title);
    const url = "https://openlibrary.org/search.json?limit=" + max + "&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,language" +
      (byIsbn ? "&isbn=" + encodeURIComponent(title.slice(5)) : "&title=" + encodeURIComponent(title) + (author ? "&author=" + encodeURIComponent(author) : ""));
    let r;
    try { r = await fetch(url); } catch { throw { code: "openlibrary-rete" }; }
    if (!r.ok) throw { code: "openlibrary-" + r.status };
    const j = await r.json();
    return (j.docs || []).map(d => ({
      title: d.title || "", author: (d.author_name || []).join(", "),
      edYear: d.first_publish_year, pages: d.number_of_pages_median, genre: "", synopsis: "",
      isbn: (d.isbn || [])[0] || "", lang: "", ita: (d.language || []).includes("ita"),
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : ""
    })).filter(x => x.title);
  }

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  function sameAuthor(a, b) {
    const la = norm(a).split(" ").pop(), lb = norm(b);
    return !la || lb.includes(la);
  }

  // Ricerca per il campo "Cerca il libro": prova le fonti in ordine e unisce i risultati.
  // --- fonte 4: Wikidata (solo per ISBN: gratuita, senza chiave, risposte in JSON) ---
  async function wikidataSearch(isbn) {
    return (await wdSparql(`SELECT ?edLabel ?authorLabel ?date ?pages WHERE { ${wdIsbn(isbn)}
OPTIONAL { ?ed wdt:P50 ?author. } OPTIONAL { ?ed wdt:P577 ?date. } OPTIONAL { ?ed wdt:P1104 ?pages. }
SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". } } LIMIT 5`)).map(b => ({
      title: wv(b.edLabel) || "", author: wv(b.authorLabel) || "",
      edYear: b.date ? yearOf(b.date.value) : undefined, pages: b.pages ? Number(b.pages.value) || undefined : undefined,
      genre: "", synopsis: "", isbn, lang: "", ita: false, cover: ""
    })).filter(x => x.title);
  }
  // ISBN con i trattini, in ogni divisione (come su Wikidata).
  const wdIsbn = isbn => { isbn = isbn.toUpperCase(); const i13 = isbn.length === 13 ? isbn : isbn13From10(isbn), i10 = isbn.length === 10 ? isbn : isbn10From13(isbn), o = [];
    for (const [p, s] of [[i13.slice(0, 3) + "-", i13.slice(3)], ["", i10]]) if (s) for (let i = 1; i < 6; i++) for (let j = i + 1; j < 9; j++) o.push(`"${p}${s.slice(0, i)}-${s.slice(i, j)}-${s.slice(j, 9)}-${s[9]}"`);
    return `VALUES ?i { ${o.join(" ")} } ?ed wdt:P212|wdt:P957 ?i.`; };
  // Conversione tra ISBN-10 e ISBN-13 (stessa cifra di controllo ISBN-10 e EAN-13).
  const isbn13From10 = i => { const core = "978" + i.slice(0, 9); const s = [...core].reduce((t, c, k) => t + Number(c) * (k % 2 ? 3 : 1), 0); return core + ((10 - (s % 10)) % 10); };
  const isbn10From13 = i => { if (!i.startsWith("978")) return ""; const core = i.slice(3, 12); const s = [...core].reduce((t, c, k) => t + Number(c) * (10 - k), 0); const c = (11 - (s % 11)) % 11; return core + (c === 10 ? "X" : String(c)); };
  // ISBN scritto in qualunque modo (spazi, trattini, prefisso «ISBN», X finale): il codice pulito, altrimenti "".
  const parseIsbn = s => { const c = String(s || "").replace(/^\s*ISBN[:\s-]*/i, "").replace(/[\s-]/g, "").toUpperCase(); return /^(\d{9}[\dX]|\d{13})$/.test(c) ? c : ""; };
  async function wdGet(url) {
    let r;
    try { r = await fetch(url, { headers: { Accept: "application/sparql-results+json, application/json" } }); } catch { throw { code: "wikidata-rete" }; }
    if (!r.ok) throw { code: "wikidata-" + r.status };
    return r.json();
  }
  const wdSparql = q => wdGet("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q)).then(j => j.results.bindings || []);
  const wv = x => x && !/^Q\d+$/.test(x.value) ? x.value : undefined; // niente codici Q
  // Opere (non edizioni) con serie, una riga per serie.
  const wdWorks = where => wdSparql(`SELECT ?work ?st (GROUP_CONCAT(DISTINCT ?nm; separator="|") AS ?names) (SAMPLE(?sl) AS ?s) (SAMPLE(?no) AS ?n) (SAMPLE(?ni) AS ?it) WHERE {
${where} FILTER NOT EXISTS { ?work wdt:P629 [] } ?work p:P179 ?st. ?st a wikibase:BestRank; ps:P179 ?ser.
OPTIONAL { ?work rdfs:label|skos:altLabel ?nm FILTER(LANG(?nm) IN ("it","en","mul","fr","de","es","pt","nl","sv","da","nb","fi","pl","cs")) }
OPTIONAL { ?st pq:P1545 ?n1 } OPTIONAL { ?work wdt:P1545 ?n2 } BIND(COALESCE(?n1, ?n2) AS ?no)
OPTIONAL { ?st pq:P156 ?x1 } OPTIONAL { ?work wdt:P156 ?x2 } BIND(COALESCE(?x1, ?x2) AS ?nx)
OPTIONAL { ?nx rdfs:label ?ni FILTER(LANG(?ni) = "it") }
OPTIONAL { ?ser rdfs:label ?si FILTER(LANG(?si) = "it") } OPTIONAL { ?ser rdfs:label ?se FILTER(LANG(?se) = "en") } OPTIONAL { ?ser rdfs:label ?sm FILTER(LANG(?sm) = "mul") } BIND(COALESCE(?si, ?se, ?sm) AS ?sl)
} GROUP BY ?work ?st LIMIT 500`).then(rs => rs.map(r => ({ id: r.work.value, names: String(wv(r.names) || "").split("|"), series: wv(r.s), no: wv(r.n), it: wv(r.it) })));
  // Una sola opera: 0 = nessuna, null = più d'una.
  const pickWork = (ws, t) => {
    let h = ws.filter(w => w.series && (!t || w.names.some(n => sameTitle(n, t))));
    const ex = t ? h.filter(w => w.names.some(n => titleCore(n) === titleCore(t))) : [];
    if (ex.length) h = ex;
    return new Set(h.map(w => w.id)).size > 1 ? null : h.find(w => w.no) || h[0] || 0;
  };
  async function authorWorks(a, cache) {
    const k = seriesKey(a);
    if (!cache.has(k)) {
      const j = await wdGet("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=it&uselang=it&type=item&limit=7&origin=*&search=" + encodeURIComponent(a));
      const ids = (j.search || []).map(x => x.id).filter(x => /^Q\d+$/.test(x)).slice(0, 3);
      cache.set(k, ids.length ? await wdWorks(`VALUES ?a { ${ids.map(x => "wd:" + x).join(" ")} } ?work wdt:P50 ?a.`) : []);
    }
    return cache.get(k);
  }
  // Titolo originale (Open Library).
  async function olTitle(isbn) {
    try {
      const j = await (await fetch("https://openlibrary.org/isbn/" + isbn + ".json")).json(), k = j.works && j.works[0] && j.works[0].key;
      return String(j.translation_of || (/^\/works\/OL\d+W$/.test(k) && (await (await fetch("https://openlibrary.org" + k + ".json")).json()).title) || "");
    } catch { return ""; }
  }
  // Seguito solo con un'edizione italiana.
  async function itEdition(t, a) {
    for (const f of [() => appleSearch(t + " " + a, 5), () => googleSearch(t + " " + a, { max: 5 })]) {
      try { if ((await f()).some(x => sameTitle(x.title, t))) return true; } catch {}
    }
    return false;
  }
  // Serie: 1) ISBN, 2) autore, 3) titolo originale.
  async function findSeries(b, cache = new Map()) {
    const isbn = parseIsbn(b.isbn), a = String(b.author || "").split(",")[0].trim();
    let w = 0;
    if (isbn) {
      w = pickWork(await wdWorks(`{ SELECT ?work WHERE { ${wdIsbn(isbn)} OPTIONAL { ?ed wdt:P629 ?w0 } BIND(COALESCE(?w0, ?ed) AS ?work) } }`));
    }
    if (w === 0 && a) {
      const ws = await authorWorks(a, cache);
      w = pickWork(ws, b.title);
      if (w === 0 && isbn && ws.length) { const t = await olTitle(isbn); if (t) w = pickWork(ws, t); }
    }
    if (!w) return null;
    const r = { series: w.series };
    if (w.no) r.no = w.no;
    if (w.it && await itEdition(w.it, a)) r.next = w.it;
    return r;
  }
  // Copia con la serie trovata, rispettando seriesManual.
  function applySeries(b, r) {
    const o = { ...b };
    if (!b.seriesManual && r.series) {
      const s = seriesName(r.series);
      if (seriesKey(s) !== seriesKey(b.series)) { delete o.seriesNo; delete o.seriesNext; }
      o.series = s; if (r.no) o.seriesNo = r.no;
    }
    if (r.next && seriesKey(o.series) === seriesKey(r.series)) o.seriesNext = r.next;
    return o;
  }
  // Nuovo libro: serie in sottofondo.
  function seriesLater(id) {
    const b = state.books.find(x => x.id === id);
    if (b && navigator.onLine) findSeries(b).then(r => {
      const cur = state.books.find(x => x.id === id); if (!r || !cur) return;
      const nb = applySeries(cur, r);
      if (["series", "seriesNo", "seriesNext"].some(k => nb[k] !== cur[k])) upsert(nb);
    }).catch(() => {});
  }
  async function searchBooks(q) {
    const errors = []; let out = [];
    const isbn = parseIsbn(q);
    const google = async () => {
      if (isbn) return googleSearch("isbn:" + isbn, { italian: false }); // un ISBN identifica già l'edizione
      const it = await googleSearch(q);
      return it.length ? it : googleSearch(q, { italian: false }); // alcune edizioni italiane non hanno la lingua indicata
    };
    const tries = [
      google,
      () => appleSearch(isbn || q),
      () => openLibrarySearch(isbn ? "isbn:" + isbn : q, ""),
      () => (isbn ? wikidataSearch(isbn) : Promise.resolve([]))
    ];
    for (const t of tries) {
      try { out = out.concat(await t()); } catch (e) { errors.push(e && e.code); }
      if (out.filter(x => x.cover).length >= 6) break;
    }
    if (!out.length && errors.length === tries.length) throw { code: errors.join(", ") };
    // Prima le edizioni italiane (l'ordine tra le altre resta quello delle fonti).
    const isIt = x => x.lang === "it" || !!x.ita;
    const res = out.sort((a, b) => (isIt(b) ? 1 : 0) - (isIt(a) ? 1 : 0)).slice(0, 15);
    res.errors = errors.filter(Boolean); // fonti che non hanno risposto: servono a dire la verità quando non si trova nulla
    return res;
  }

  function originalTitle(b) {
    const m = /Titolo originale: (.+?)\.(?:\s|$)/.exec(b.synopsis || "");
    return m && !/nessuna edizione/.test(m[1]) ? m[1] : "";
  }
  // Quanto un risultato sembra l'edizione italiana del libro: titolo italiano uguale, lingua italiana, negozio italiano.
  function itScore(b, x) {
    const t = norm(b.title), xt = norm(x.title), orig = norm(originalTitle(b));
    let sc = 0;
    if (xt && t && (xt === t || xt.startsWith(t + " ") || t.startsWith(xt + " "))) sc += 4;
    else if (xt && t && (xt.includes(t) || t.includes(xt))) sc += 2;
    if (x.lang === "it") sc += 3;
    if (orig && orig !== t && xt && (xt === orig || xt.startsWith(orig))) sc -= 3;
    if (x.src === "Apple Books") sc += 1;
    return sc;
  }
  async function settle(jobs, errors) {
    const res = await Promise.allSettled(jobs.map(j => j()));
    return res.flatMap(r => {
      if (r.status === "fulfilled") return r.value;
      const code = r.reason && r.reason.code; if (code && errors) errors[code] = (errors[code] || 0) + 1;
      return [];
    });
  }
  const tag = src => list => list.map(x => ({ ...x, src }));
  async function findCover(b, errors) {
    const last = String(b.author || "").split(/\s+/).pop();
    const orig = originalTitle(b);
    const ok = list => list.filter(x => x.cover && sameAuthor(b.author, x.author))
      .map(x => ({ ...x, score: itScore(b, x) })).sort((p, q) => q.score - p.score);
    // 1) edizioni italiane: Apple Books Italia, Google Books in italiano, Open Library con il titolo italiano
    const first = ok(await settle([
      () => appleSearch(`${b.title} ${last}`, 8).then(tag("Apple Books")),
      () => googleSearch(`intitle:"${b.title}"` + (last ? ` inauthor:${last}` : ""), { max: 6 }).then(tag("Google Books")),
      () => openLibrarySearch(b.title, last).then(tag("Open Library"))
    ], errors));
    if (first.length && first[0].score >= 2) return first[0];
    // 2) ripiego: titolo originale
    const second = orig ? ok(await settle([
      () => googleSearch(`intitle:"${orig}"` + (last ? ` inauthor:${last}` : ""), { italian: false, max: 6 }).then(tag("Google Books")),
      () => openLibrarySearch(orig, last).then(tag("Open Library"))
    ], errors)) : [];
    return first[0] || second[0] || null;
  }
  // Copertine alternative per un libro: fino a 6, dalle tre fonti, solo dello stesso autore.
  async function coverCandidates(b) {
    const last = String(b.author || "").split(/\s+/).pop();
    const orig = originalTitle(b);
    const jobs = [
      appleSearch(`${b.title} ${last}`, 8).then(r => r.map(x => ({ ...x, src: "Apple Books" }))),
      googleSearch(`intitle:"${b.title}"` + (last ? ` inauthor:${last}` : ""), { max: 8 }).then(r => r.map(x => ({ ...x, src: "Google Books" }))),
      openLibrarySearch(b.title, last).then(r => r.map(x => ({ ...x, src: "Open Library" }))),
      orig ? openLibrarySearch(orig, last).then(r => r.map(x => ({ ...x, src: "Open Library" }))) : Promise.resolve([])
    ];
    const all = (await Promise.allSettled(jobs)).flatMap(r => r.status === "fulfilled" ? r.value : []);
    const seen = new Set(), out = [];
    all.filter(x => x.cover && sameAuthor(b.author, x.author))
      .map(x => ({ ...x, score: itScore(b, x) }))
      .sort((p, q) => q.score - p.score)
      .forEach(x => { if (out.length < 6 && !seen.has(x.cover)) { seen.add(x.cover); out.push({ ...x, it: x.score >= 4 || x.lang === "it" }); } });
    return out;
  }

  async function runCoverJob(onProgress, { redo = false } = {}) {
    if (state.coverJob) return;
    if (!navigator.onLine) { toast("Serve una connessione per cercare le copertine."); return; }
    const todo = redo ? state.books.filter(b => !b.coverManual && !b.spine) : state.books.filter(b => !b.cover && !b.noCover);
    if (!todo.length) { toast("Tutti i libri hanno già una copertina."); return; }
    const job = state.coverJob = { done: 0, total: todo.length, found: 0 }, gen = dataGen;
    const errors = {};
    try {
      for (const b of todo) {
        const hit = await findCover(b, errors);
        if (gen !== dataGen) return; // copia ripristinata nel frattempo: niente più modifiche né messaggi
        const cur = state.books.find(x => x.id === b.id);
        if (cur && hit && cur.cover !== hit.cover) {
          cur.cover = hit.cover; if (!cur.isbn && hit.isbn) cur.isbn = hit.isbn; if (!cur.pages && hit.pages) cur.pages = hit.pages;
          cur.updated = Date.now(); cloudHook("changed", cur.id);
          state.coverJob.found++;
          patchBook(cur.id);
        } else if (cur && hit) state.coverJob.found++;
        state.coverJob.done++;
        if (state.coverJob.done % 10 === 0) schedulePersist();
        onProgress && onProgress(state.coverJob);
        await sleep(200);
        if (gen !== dataGen) return;
      }
    } finally {
      if (gen !== dataGen) onProgress && onProgress(null); // fermato dal ripristino: niente salvataggio né messaggio
      else {
        const { found, done } = job; state.coverJob = null;
        persist(); render(); onProgress && onProgress(null);
        const errs = Object.entries(errors).map(([k, n]) => `${k} ×${n}`).join(", ");
        toast(`Copertine trovate: ${found} su ${done}.` + (found < done && errs ? ` Errori: ${errs}.` : ""));
      }
    }
  }

  /* ---------- vista ---------- */
  const SHELF_ORDER = { daleggere: ["da-leggere", "in-lettura", "letto", "desiderato"] }; // con "Da leggere prima" cambia anche l'ordine degli scaffali
  const shelfOrder = () => SHELF_ORDER[state.sort] || Object.keys(STATUS);
  function sorted(list) {
    const recenti = (a, b) => (b.finished || b.started || "").localeCompare(a.finished || a.started || "") || (b.added || 0) - (a.added || 0);
    const rank = st => shelfOrder().indexOf(st);
    // Stesso autore: prima le serie (nome, numero), poi gli altri per titolo.
    const no = x => x.seriesNo ? +x.seriesNo : 1e9;
    const bySeries = (a, b) => (!!b.series - !!a.series) || (a.series ? seriesKey(a.series).localeCompare(seriesKey(b.series), "it") || no(a) - no(b) : 0);
    const by = {
      recenti,
      daleggere: (a, b) => rank(a.status) - rank(b.status) || recenti(a, b),
      autore: (a, b) => (surname3(a.author) + a.author).localeCompare(surname3(b.author) + b.author, "it") || bySeries(a, b) || a.title.localeCompare(b.title, "it"),
      titolo: (a, b) => a.title.localeCompare(b.title, "it"),
      voto: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, "it")
    }[state.sort];
    // I libri in lettura vengono sempre per primi, qualunque sia l'ordine scelto.
    return [...list].sort((a, b) => (b.status === "in-lettura") - (a.status === "in-lettura") || by(a, b));
  }
  function visible() {
    const q = norm(state.q);
    return q ? state.books.filter(b => norm(b.title + " " + (b.author || "") + " " + (b.genre || "") + " " + (b.series || "")).includes(q)) : state.books;
  }

  // Le copertine scaricate sono grandi (fino a 600x900): per dorsi e griglia ne chiedo una versione piccola.
  function thumb(url, w) {
    if (!url) return url;
    if (/mzstatic\.com/.test(url)) return url.replace(/\/\d+x\d+bb\./, `/${w}x${Math.round(w * 1.5)}bb.`);
    if (/covers\.openlibrary\.org/.test(url)) return url.replace(/-L\.jpg/, w <= 180 ? "-M.jpg" : "-L.jpg");
    return url;
  }
  function coverHTML(b, w = 300, sno = false) {
    const c = colorOf(b);
    const pat = ["repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 2px, transparent 2px 12px)",
                 "radial-gradient(circle at 70% 30%, rgba(255,255,255,.14) 0 18%, transparent 19%)",
                 "repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 9px)",
                 "linear-gradient(160deg, rgba(255,255,255,.12), transparent 55%)"][hash(b.genre || b.title) % 4];
    const img = b.cover ? `<img src="${esc(thumb(b.cover, w))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('photo');this.remove()">` : "";
    return `<div class="cover${b.cover ? " photo" : ""}" style="background:${c}"><div class="pat" style="background:${pat}"></div>
      <div class="ct">${esc(b.title)}</div><div class="ca">${esc(b.author || "")}</div>${img}${sno ? snoHTML(b) : ""}</div>`;
  }

  function renderTally() {
    const read = state.books.filter(b => b.status === "letto");
    const y = new Date().getFullYear();
    const done = read.filter(b => yearOf(b.finished) === y).length;
    const goal = (getSet().goals || {})[y] || 0;
    const pct = goal ? Math.min(1, done / goal) : 0;
    const C = 2 * Math.PI * 19;
    const ring = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="19" class="ring-bg"/>` +
      (goal && done ? `<circle cx="24" cy="24" r="19" class="ring-fg" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 24 24)"/>` : "") +
      `<text x="24" y="28.5" text-anchor="middle">${done}</text></svg>`;
    $("#tally").innerHTML = `<button class="goal" id="goal-btn" type="button">${ring}<span class="goal-txt">${goal
        ? `<b>${done} di ${goal}</b> libri nel ${y}<em>${goalPace(done, goal, y)}</em>`
        : `<b>${done} libri</b> letti nel ${y}<em>Tocca per fissare un obiettivo</em>`}</span></button>`;
    $("#goal-btn").onclick = openGoal;
  }
  function goalPace(done, goal, y) {
    if (done >= goal) return "Obiettivo raggiunto!";
    const now = new Date(), end = new Date(y, 11, 31), start = new Date(y, 0, 1);
    const expected = Math.round(goal * (now - start) / (end - start));
    const left = goal - done, weeks = Math.max(1, Math.round((end - now) / 6048e5));
    const perMonth = Math.max(1, Math.round(left / weeks * 4.3));
    // Sul telefono si vede solo "ne mancano N": il ritmo mensile resta sul computer.
    return done >= expected ? `In linea · ne mancano ${left}` : `Ne mancano ${left}<span class="pace-extra"> · circa ${perMonth} al mese</span>`;
  }
  function openGoal() {
    const y = new Date().getFullYear();
    const goals = getSet().goals || {};
    const sheet = openSheet(`<h2>Obiettivo ${y}</h2>
      <p class="hint">Quanti libri vuoi leggere quest'anno? Contano quelli segnati come letti con una data di fine nel ${y}.</p>
      <div class="field"><label for="g-n">Libri</label><input id="g-n" type="number" inputmode="numeric" min="1" max="365" value="${goals[y] || ""}" placeholder="Es. 20"></div>
      <div class="actions"><button class="btn primary" id="g-save">Salva</button>${goals[y] ? `<button class="btn danger" id="g-del">Togli obiettivo</button>` : ""}<button class="btn ghost" id="g-close">Chiudi</button></div>`);
    $("#g-close", sheet).onclick = closeSheet;
    $("#g-save", sheet).onclick = () => {
      const n = parseInt($("#g-n", sheet).value, 10);
      if (!n || n < 1) { $("#g-n", sheet).focus(); return; }
      setSet({ goals: { ...goals, [y]: n } }); closeSheet(); render(); toast("Obiettivo salvato");
    };
    const del = $("#g-del", sheet); if (del) del.onclick = () => { const g = { ...goals }; delete g[y]; setSet({ goals: g }); closeSheet(); render(); };
    setTimeout(() => $("#g-n", sheet).focus(), 50);
  }

  function renderNotice() {
    const n = $("#notice");
    $("#archive-dot").hidden = !backupDue();
    n.hidden = state.books.length > 0;
    if (state.books.length) { n.innerHTML = ""; return; }
    n.innerHTML = `<div class="notice"><span><strong>La libreria è vuota.</strong> Carica i 108 libri importati da Goodreads, oppure un backup da Altro → Backup.</span>
      <span class="actions"><button class="btn primary" id="seed-go">Carica i libri Goodreads</button></span></div>`;
    $("#seed-go").onclick = loadSeed;
  }
  function backupDue() {
    const last = getSet().lastBackup;
    return state.books.length > 0 && (!last || Date.now() - last > 30 * 864e5);
  }

  // Dorso: foto vera se l'hai scattata, altrimenti una striscia della copertina, altrimenti il dorso disegnato.
  // Libro letto con il periodo di lettura da aggiornare: manca quando l'ha finito (data o almeno l'anno) oppure le date non sono coerenti.
  const needsDates = b => b.status === "letto" && ((!b.finished && !b.finishedYear) || !!dateProblem(b.started || "", b.finished || ""));
  const STALE = "periodo di lettura da aggiornare";
  const badgeHTML = b => needsDates(b) ? `<i class="badge" aria-hidden="true">!</i>` : "";
  function spineHTML(b, tag = "button") {
    const p = Math.min(Number(b.pages) || 280, 900);
    const h = Math.round(132 + p / 900 * 72);
    let w = Math.round(26 + p / 900 * 24);
    const attrs = tag === "button" ? `data-id="${esc(b.id)}" aria-label="${esc(b.title)} di ${esc(b.author || "")}${serAria(b)}${needsDates(b) ? ", " + STALE : ""}"` : `aria-hidden="true"`;
    const stale = tag === "button" && needsDates(b), sno = snoHTML(b), bd = (stale ? badgeHTML(b) : "") + sno, ser = sno ? " ser" : "";
    const last = String(b.author || "").trim().split(/\s+/).pop() || "";
    if (b.spine) {
      if (b.spineRatio) w = Math.max(16, Math.min(80, Math.round(h * b.spineRatio)));
      return `<${tag} class="spine photo${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w}px;background-image:url('${b.spine}')"><span class="gloss"></span>${bd}</${tag}>`;
    }
    const text = `<span class="t">${esc(b.title)}</span><span class="au">${esc(last)}</span>`;
    if (b.cover) {
      return `<${tag} class="spine fromcover${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w}px;background:${colorOf(b)}">
        <img src="${esc(thumb(b.cover, 120))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('fromcover');this.remove()"><span class="shade"></span>${text}${bd}</${tag}>`;
    }
    return `<${tag} class="spine${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w}px;background:${colorOf(b)}">
      <span class="band a"></span>${text}<span class="band b"></span>${bd}</${tag}>`;
  }

  function progressOf(b) {
    const tot = Number(b.pages) || 0, pg = Math.max(0, Number(b.page) || 0);
    return { tot, pg, pct: tot ? Math.min(100, Math.round(pg / tot * 100)) : 0 };
  }
  // Sezione in alto con i libri in lettura (sempre visibile con "Tutti" e "In lettura", in entrambe le viste).
  function renderHero() {
    const hero = $("#hero");
    const reading = sorted(state.books.filter(b => b.status === "in-lettura"));
    const lib = state.view === "libreria", f = state.filter;
    const show = reading.length && (f === "tutti" || f === "in-lettura") && lib;
    // Senza letture in corso: «Cosa leggo adesso?», salvo «Non ora».
    const list = !reading.length && lib && (f === "tutti" || f === "da-leggere") && !nx.off ? nextList() : [];
    hero.hidden = !show && !list.length;
    if (hero.contains(document.activeElement)) document.activeElement.blur(); // niente cursore su un elemento che sto sostituendo
    if (hero.hidden) { hero.innerHTML = ""; return; }
    hero.setAttribute("aria-label", show ? "Libri in lettura" : "Il prossimo libro");
    if (show) { hero.innerHTML = readingCards(reading); wireMain(hero); } else { hero.innerHTML = nextHTML(list); wireNext(hero); }
  }
  // Proposte mostrate: restano le stesse finché i libri sono ancora in pila; «Altre proposte» le esclude (esaurita la pila si ricomincia).
  const nx = { ex: [], list: [], off: false };
  function nextList(more) {
    if (more) nx.ex.push(...nx.list.map(x => x.book.id));
    const pile = state.books.filter(b => b.status === "da-leggere");
    if (more || !nx.list.length || nx.list.some(x => !pile.some(b => b.id === x.book.id))) {
      nx.list = nextBooks(state.books, nx.ex);
      if (!nx.list.length) { nx.ex = []; nx.list = nextBooks(state.books); }
    }
    return nx.list = nx.list.map(x => ({ ...x, book: pile.find(b => b.id === x.book.id) || x.book })); // dati aggiornati (titolo, copertina…)
  }
  function nextHTML(list, h = "h3") {
    const more = state.books.filter(b => b.status === "da-leggere").length > list.length, hero = h === "h3";
    return `<section class="next"><${h}>Cosa leggo adesso?</${h}><div class="nlist">${list.map(({ book: b, reason }) => `<div class="ncard" data-next="${esc(b.id)}">${coverHTML(b, 120)}<div><span class="why">${esc(reason)}</span><b>${esc(b.title)}</b><span class="meta">${esc([b.author, b.pages && b.pages + " pp."].filter(Boolean).join(" · "))}</span></div><button class="btn primary" type="button" data-start="${esc(b.id)}" aria-label="Inizia ${esc(b.title)}">Inizia</button></div>`).join("")}</div>
      <div class="nfoot">${more ? `<button class="btn" type="button" data-n="more"${hero ? ' id="n-more"' : ""}>Altre proposte</button>` : "<span></span>"}<button class="btn ghost" type="button" data-n="later"${hero ? ' id="n-later"' : ""}>${hero ? "Non ora" : "Chiudi"}</button></div></section>`;
  }
  function wireNext(root, sheet) {
    root.querySelectorAll("[data-start]").forEach(btn => btn.onclick = () => { const b = state.books.find(x => x.id === btn.dataset.start); if (sheet) closeSheet(); if (b && b.status === "da-leggere") setStatus(b, "in-lettura"); else renderHero(); });
    const m = $("[data-n=more]", root);
    if (m) m.onclick = () => { nextList(true); if (sheet) fillNext(root); else renderHero(); const n = $("[data-n=more]", root); if (n) n.focus(); };
    $("[data-n=later]", root).onclick = () => { if (sheet) closeSheet(); else { nx.off = true; renderHero(); } };
  }
  function fillNext(sheet) { sheet.innerHTML = nextHTML(nextList(), "h2"); wireNext(sheet, true); }
  // Pagina rapida sotto la barra: cursore (solo con pagine totali), +10 e «+N» (ultimo salto scritto a mano).
  function pquickHTML(b, tot, pg) {
    const id = esc(b.id), t = esc(b.title), step = Number(b.pageStep) || 0;
    return `<div class="pquick">${tot ? `<input type="range" min="0" max="${tot}" value="${Math.min(pg, tot)}" data-range="${id}" aria-label="Avanzamento di ${t}" aria-valuetext="pagina ${Math.min(pg, tot)} di ${tot}">` : `<span class="grow"></span>`}<button class="btn" type="button" data-add="10" data-id-add="${id}" aria-label="Aggiungi 10 pagine a ${t}">+10</button>${step ? `<button class="btn" type="button" data-repeat="${id}" aria-label="Aggiungi ${step} pagine a ${t}">+${step}</button>` : ""}</div>`;
  }
  // Libro in lettura in primo piano: etichetta, pagina modificabile, pulsanti Aggiorna e Dettagli.
  function readingCards(books) {
    if (!books.length) return "";
    return `<div class="reading">${books.map(b => {
      const { tot, pg, pct } = progressOf(b);
      return `<article class="rcard">
        <button class="rcover" data-id="${esc(b.id)}" aria-label="Apri ${esc(b.title)}">${coverHTML(b)}</button>
        <div class="rbody">
          <span class="rlabel">In lettura adesso</span>
          <h3>${esc(b.title)}</h3>${b.series ? `<p class="rser">${esc(serLabel(b))}</p>` : ""}<p class="hint">${esc(b.author || "")}${b.callNo ? ` · <span class="callno">${esc(b.callNo)}</span>` : ""}</p>
          <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
          ${pquickHTML(b, tot, pg)}
          <div class="prow">
            <label class="pin">pag. <input type="number" inputmode="numeric" min="0" ${tot ? `max="${tot}"` : ""} value="${pg || ""}" placeholder="0" data-page="${esc(b.id)}" aria-label="Pagina attuale di ${esc(b.title)}"></label>
            <span class="hint">${tot ? `di ${tot} · ${pct}%` : "pagine totali non note"}</span>
          </div>
          <div class="ractions">
            <button class="btn primary" type="button" data-save="${esc(b.id)}">Aggiorna</button>
            <button class="btn" type="button" data-id="${esc(b.id)}">Dettagli</button>
          </div>
          ${tot && pg >= tot ? `<button class="btn primary" data-finish="${esc(b.id)}">Finito! Segna come letto</button>` : ""}
        </div></article>`;
    }).join("")}</div>`;
  }
  function renderShelves(list) {
    // Le letture in corso stanno in alto, nella sezione "hero": negli scaffali non le ripeto.
    const order = (state.filter === "tutti" ? shelfOrder() : [state.filter]).filter(st => st !== "in-lettura");
    return order.map(st => shelfHTML(st, list)).join("");
  }
  function shelfHTML(st, list) {
    const all = sorted(list.filter(b => b.status === st));
    const books = st === "in-lettura" ? all : all.slice(0, state.limit[st] || PAGE); // le letture in corso sono poche: le mostro tutte
    const spines = books.map(b => spineHTML(b)).join("");
    const more = all.length - books.length;
    const moreBtn = st === "in-lettura" ? "" : pagerHTML(st, books.length, all.length);
    return `<section class="shelf-block" data-shelf="${st}"><div class="shelf-head"><h2>${STATUS[st]}</h2>${st === "da-leggere" && all.length ? `<button class="btn choose" type="button" data-choose>Scegli per me</button>` : ""}<span>${all.length} ${all.length === 1 ? "volume" : "volumi"}</span></div>
      ${st === "in-lettura" ? readingCards(books) : ""}
      ${st === "in-lettura" && books.length ? "" : `<div class="row">${spines || `<div class="empty-shelf">${st === "in-lettura" ? "Nessun libro in lettura. Tieni premuto un dorso per iniziarne uno." : st === "desiderato" ? "Nessun desiderio. Con + Libro puoi salvare un libro nella lista dei desideri." : "Scaffale vuoto."}</div>`}</div>`}
      ${moreBtn}</section>`;
  }
  function setStatus(b, st) {
    const nb = { ...b, status: st };
    // La data di oggi solo al passaggio a Letto, e mai se si conosce già l'anno di lettura.
    if (st === "letto" && b.status !== "letto" && !nb.finished && !nb.finishedYear) nb.finished = today();
    if (st === "in-lettura") { // si rilegge: la fine e l'anno della lettura precedente non valgono più, l'inizio riparte da oggi
      delete nb.finishedYear;
      if (nb.finished) { delete nb.finished; nb.started = today(); } else if (!nb.started) nb.started = today();
    }
    if (st === "letto" && nb.pages) nb.page = nb.pages;
    upsert(nb);
    toast(`Spostato in ${STATUS[st]}`);
  }

  function cardHTML(b) {
    return `<button class="card" data-id="${esc(b.id)}" aria-label="${esc(b.title)} di ${esc(b.author || "")}${serAria(b)}${needsDates(b) ? ", " + STALE : ""}">${coverHTML(b, 300, true)}${badgeHTML(b)}
      <div class="meta">${b.rating ? `<span class="stars">${starStr(b.rating)}</span>` : ""}</div></button>`;
  }
  function renderCovers(list) {
    const all = sorted(list), shown = all.slice(0, state.limit.covers || PAGE);
    return `<div class="covers">${shown.map(cardHTML).join("")}</div>${pagerHTML("covers", shown.length, all.length)}`;
  }
  // Pulsanti sotto uno scaffale o alle copertine: mostra altri, nascondi, con il conteggio.
  function pagerHTML(key, shown, total) {
    if (total <= PAGE) return "";
    const next = Math.min(PAGE, total - shown);
    return `<div class="pager" role="group" aria-label="Mostra più o meno libri">
      <span class="pager-count">${shown} di ${total}</span>
      <span class="pager-actions">${shown < total ? `<button class="pager-btn primary" type="button" data-more="${key}">Mostra altri ${next}</button>` : ""}${shown > PAGE ? `<button class="pager-btn" type="button" data-less="${key}">Nascondi</button>` : ""}</span>
    </div>`;
  }

  // Tutti i numeri delle Statistiche, solo dai libri letti. Funzione pura: nessun accesso alla pagina.
  // Una data di fine nel futuro vale come nessuna data; senza data vale l'eventuale anno di lettura (finishedYear).
  function computeStats(books, oggi) {
    const iso = new Date(oggi - oggi.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), thisYear = oggi.getFullYear();
    const isDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= iso;
    const read = books.filter(b => b.status === "letto").map(b => {
      const fin = isDate(b.finished) ? b.finished : "";
      const fy = Number(b.finishedYear);
      const year = fin ? Number(fin.slice(0, 4)) : (Number.isInteger(fy) && fy >= 1900 && fy <= thisYear ? fy : null);
      return { b, fin, year, pages: Number(b.pages) > 0 ? Number(b.pages) : 0, rating: Number(b.rating) > 0 ? Math.min(5, Math.round(b.rating)) : 0 };
    });
    // Più recente prima: data di fine (o anno), poi ultima modifica.
    const recent = (x, y) => ((y.fin || (y.year ? y.year + "-00" : "")).localeCompare(x.fin || (x.year ? x.year + "-00" : ""))) || ((y.b.updated || 0) - (x.b.updated || 0));
    const avg = list => { const r = list.filter(x => x.rating); return r.length ? r.reduce((t, x) => t + x.rating, 0) / r.length : null; };
    const sum = list => list.reduce((t, x) => t + x.pages, 0);
    const months = list => { const m = Array(12).fill(0); list.forEach(x => { if (x.fin) m[Number(x.fin.slice(5, 7)) - 1]++; }); return m; };
    const groups = (list, key) => { const m = new Map(); list.forEach(x => { const k = String(x.b[key] || "").trim(); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(x); } }); return [...m].map(([name, xs]) => ({ name, xs })); };
    const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
    const timed = read.filter(x => x.fin && isDate(x.b.started)).map(x => ({ book: x.b, days: day(x.fin) - day(x.b.started) + 1 })).filter(t => t.days >= 1 && t.days <= 730);
    const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; read.forEach(x => { if (x.rating) ratings[x.rating]++; });
    const mo = months(read);
    const sempre = {
      read: read.length, pages: sum(read), avgRating: avg(read), unrated: read.filter(x => !x.rating).length, ratings,
      fiveStars: read.filter(x => x.rating === 5).sort(recent).map(x => x.b),
      days: timed.length ? {
        count: timed.length, avg: Math.round(timed.reduce((t, x) => t + x.days, 0) / timed.length),
        fastest: timed.reduce((a, x) => x.days < a.days ? x : a), slowest: timed.reduce((a, x) => x.days > a.days ? x : a),
      } : null,
      months: mo, monthsCount: mo.reduce((t, n) => t + n, 0),
      authors: groups(read, "author").map(g => ({ name: g.name, count: g.xs.length, pages: sum(g.xs), avgRating: avg(g.xs) }))
        .sort((a, b) => b.count - a.count || b.pages - a.pages || a.name.localeCompare(b.name, "it")).slice(0, 6),
      genres: groups(read, "genre").map(g => ({ name: g.name, count: g.xs.length }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it")).slice(0, 6),
    };
    // Il più presente dell'anno; a parità quello letto più di recente.
    const top = (list, key) => { const g = groups(list, key).map(g => ({ name: g.name, count: g.xs.length, last: g.xs.slice().sort(recent)[0] })); g.sort((a, b) => b.count - a.count || recent(a.last, b.last)); return g[0] ? { name: g[0].name, count: g[0].count } : null; };
    const byYear = new Map(); read.forEach(x => { if (x.year) { if (!byYear.has(x.year)) byYear.set(x.year, []); byYear.get(x.year).push(x); } });
    const anni = [...byYear].sort((a, b) => b[0] - a[0]).map(([year, xs]) => {
      const best = xs.filter(x => x.rating).sort((a, b) => b.rating - a.rating || recent(a, b))[0];
      return { year, count: xs.length, pages: sum(xs), avgRating: avg(xs), months: months(xs), topAuthor: top(xs, "author"), topGenre: top(xs, "genre"), best: best ? best.b : null, books: xs.sort(recent).map(x => x.b) };
    });
    return { sempre, anni, noYear: read.filter(x => !x.year && !(x.b.finished > iso)).length, future: read.filter(x => !x.year && x.b.finished > iso).length, racconti: [thisYear - 1, thisYear - 2].filter(y => byYear.has(y)) };
  }
  window.libreriaStats = Object.freeze({ compute: computeStats });

  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const num = n => Number(n).toLocaleString("it-IT");
  // Il prossimo libro: fino a tre proposte dalla pila (affine all'ultimo letto, la più vecchia, a caso). Funzione pura.
  function nextBooks(books, exclude = [], rnd = Math.random) {
    const add = b => { const n = Number(b.added); return isFinite(n) && n > 0 ? n : 0; };
    const pile = books.filter(b => b.status === "da-leggere" && !exclude.includes(b.id)).sort((a, b) => add(a) - add(b));
    const out = [], take = (b, kind, reason) => { out.push({ book: b, kind, reason }); pile.splice(pile.indexOf(b), 1); };
    const k = (b, f) => String(b[f] || "").trim().toLowerCase(); // mai abbinare valori vuoti
    const last = books.filter(b => b.status === "letto").sort((a, b) => String(b.finished || "").localeCompare(String(a.finished || "")) || (b.updated || 0) - (a.updated || 0)).slice(0, 3);
    for (const f of ["author", "genre"]) {
      const r = last.find(r => k(r, f) && pile.some(b => k(b, f) === k(r, f)));
      if (r) {
        const v = String(r[f]).trim(), who = /,| e |\bvari\b/i.test(v) ? v : v.split(/\s+/).pop(); // più autori: il nome intero, non l'ultima parola
        take(pile.find(b => k(b, f) === k(r, f)), "affine", f === "author" ? `Dopo «${r.title}», ancora ${who}` : `Stesso genere di «${r.title}»: ${v}`); break;
      }
    }
    if (pile.length) { const b = pile[0], d = new Date(add(b)); take(b, "vecchio", add(b) ? `In pila da ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Da più tempo in pila"); }
    while (out.length < 3 && pile.length) take(pile[Math.floor(rnd() * pile.length) % pile.length], "caso", "A caso");
    return out;
  }
  window.libreriaNext = Object.freeze({ next: nextBooks });
  // Stesso libro: senza articolo né sottotitolo; per inizio solo da 8 caratteri.
  const titleCore = t => norm(String(t || "").split(/:| - /)[0]).replace(/^(il|lo|la|i|gli|le|l|un|uno|una|the|a|an) /, "");
  function sameTitle(a, b) {
    let x = titleCore(a), y = titleCore(b);
    if (!x || !y) return false;
    if (x.length > y.length) [x, y] = [y, x];
    return x === y || (x.length >= 8 && y.startsWith(x + " "));
  }

  const dec = n => n == null ? "–" : n.toFixed(1).replace(".", ",");
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
  // Barra orizzontale con il numero accanto; il valore più alto in --accent.
  const hbar = (label, n, max, title = "") => `<div class="hbar"><span class="hl"${title ? ` title="${esc(title)}"` : ""}>${label}</span><span class="ht"><i class="${n === max ? "top" : ""}" style="width:${max ? Math.round(n / max * 100) : 0}%"></i></span><em>${num(n)}</em></div>`;
  function monthsHTML(m) {
    const max = Math.max(...m);
    return `<div class="months" aria-hidden="true">${m.map(n => `<i class="${n && n === max ? "top" : ""}" style="height:${max ? Math.round(n / max * 100) : 0}%"></i>`).join("")}</div>
      <div class="mlab" aria-hidden="true">${MONTHS.map(x => `<span>${x[0].toUpperCase()}</span>`).join("")}</div>
      <p class="sr">${m.map((n, i) => n ? `${MONTHS[i]} ${n}` : "").filter(Boolean).join(", ")}</p>`;
  }
  function renderStats(st) {
    const S = st.sempre;
    if (!S.read) return `<div class="stats"><p class="stats-empty">Quando segnerai un libro come Letto, qui compariranno le tue statistiche</p></div>`;
    const panel = (key, title, body) => `<section class="panel" data-panel="${key}"><h3>${title}</h3>${body}</section>`;
    const stories = st.racconti.map(y => { const a = st.anni.find(x => x.year === y); return `<button class="story-card" type="button" data-story="${y}"><small>Racconto</small><b>Il tuo ${y}</b><span>${plural(a.count, "libro", "libri")} · ${num(a.pages)} pagine</span></button>`; }).join("");
    const maxR = Math.max(...Object.values(S.ratings));
    const voti = [5, 4, 3, 2, 1].map(n => hbar(`<span class="stars" role="img" aria-label="${n} stelle">${"★".repeat(n)}</span>`, S.ratings[n], maxR)).join("") +
      `<p class="hint">${S.unrated ? plural(S.unrated, "libro senza voto", "libri senza voto") + "." : ""}${S.fiveStars.length ? ` 5 stelle: ${S.fiveStars.slice(0, 4).map(b => esc(b.title)).join(", ")}${S.fiveStars.length > 4 ? ` e altri ${S.fiveStars.length - 4}` : ""}.` : ""}</p>`;
    const D = S.days;
    const tempo = D ? `<div class="trio"><div><b>${D.avg}</b><span>giorni in media</span></div>
        <div><b>${D.fastest.days}</b><span>il più veloce · ${esc(D.fastest.book.title)}</span></div>
        <div><b>${D.slowest.days}</b><span>il più lento · ${esc(D.slowest.book.title)}</span></div></div>
        <p class="hint">Su ${plural(D.count, "libro", "libri")} con data di inizio e di fine.</p>`
      : `<p class="hint">Aggiungi «Iniziato il» e «Finito il» nella scheda dei libri per sapere quanto tempo ti serve per finirne uno.</p>`;
    const topM = S.months.indexOf(Math.max(...S.months));
    const mesi = S.monthsCount ? `${monthsHTML(S.months)}<p class="hint">Leggi di più a ${MONTHS[topM]}. Su ${plural(S.monthsCount, "libro", "libri")} con data di fine.</p>`
      : `<p class="hint">Aggiungi «Finito il» nella scheda dei libri per vedere in quali mesi leggi di più.</p>`;
    const autori = S.authors.length ? `<ul class="list">${S.authors.map(a => `<li><span title="${esc(a.name)}">${esc(a.name)}</span><span>${plural(a.count, "libro", "libri")}${a.pages ? ` · ${num(a.pages)} pp` : ""}${a.avgRating ? ` · ★ ${dec(a.avgRating)}` : ""}</span></li>`).join("")}</ul>`
      : `<p class="hint">Aggiungi l'autore nella scheda dei libri.</p>`;
    const maxG = S.genres.length ? S.genres[0].count : 0;
    const generi = S.genres.length ? S.genres.map(g => hbar(esc(g.name), g.count, maxG, g.name)).join("") : `<p class="hint">Aggiungi il genere nella scheda dei libri.</p>`;
    const years = st.anni.map((a, i) => `<details class="year" data-year="${a.year}"${i ? "" : " open"}>
        <summary><b>${a.year}</b><span>${plural(a.count, "libro", "libri")} · ${num(a.pages)} pagine${a.avgRating ? ` · ★ ${dec(a.avgRating)}` : ""}</span></summary>
        <div class="in">${a.months.some(Boolean) ? monthsHTML(a.months) : ""}
          ${a.topAuthor || a.topGenre ? `<div class="pair">${a.topAuthor ? `<div><span class="label">Autore dell'anno</span><b>${esc(a.topAuthor.name)}</b><span>${plural(a.topAuthor.count, "libro", "libri")}</span></div>` : ""}${a.topGenre ? `<div><span class="label">Genere dell'anno</span><b>${esc(a.topGenre.name)}</b><span>${plural(a.topGenre.count, "libro", "libri")}</span></div>` : ""}</div>` : ""}
          ${a.best ? `<div class="best">${coverHTML(a.best, 120)}<div><span class="label">Il preferito</span><b>${esc(a.best.title)}</b><span class="stars">${starStr(a.best.rating)}</span></div></div>` : ""}
        </div></details>`).join("");
    return `<div class="stats">
      ${stories ? `<div class="stories">${stories}</div>` : ""}
      <h2 class="stats-group">Sempre</h2>
      <div class="stats-grid">
        ${panel("sintesi", "In sintesi", `<div class="figures">
          <div class="fig"><b>${num(S.read)}</b><span>${S.read === 1 ? "libro letto" : "libri letti"}</span></div>
          <div class="fig"><b>${S.pages >= 10000 ? Math.round(S.pages / 1000) + "k" : num(S.pages)}</b><span>pagine</span></div>
          <div class="fig"><b>${dec(S.avgRating)}</b><span>voto medio</span></div>
          <div class="fig"><b>${D ? D.avg : "–"}</b><span>giorni per libro</span></div></div>`)}
        ${panel("voti", "Voti", voti)}
        ${panel("tempo", "Tempo di lettura", tempo)}
        ${panel("mesi", "Mesi", mesi)}
        ${panel("autori", "Autori", autori)}
        ${panel("generi", "Generi", generi)}
      </div>
      ${years ? `<h2 class="stats-group">Anno per anno</h2><div class="years">${years}</div>` : ""}
      ${st.future ? `<p class="hint stats-future">${st.future === 1 ? "1 libro letto ha" : `${num(st.future)} libri letti hanno`} una data di fine nel futuro: correggila dalla scheda del libro per vederlo negli anni.</p>` : ""}
      ${st.noYear ? `<p class="hint stats-noyear">${st.noYear === 1 ? "1 libro letto non ha un anno" : `${num(st.noYear)} libri letti non hanno un anno`}: aggiungilo dalla scheda del libro («Finito il» oppure solo l'anno).</p>` : ""}
    </div>`;
  }

  // Racconto a schermo intero di un anno appena concluso: schermate da sfogliare, senza avanzamento automatico.
  function openStory(year) {
    const now = new Date(), a = computeStats(state.books, now).anni.find(x => x.year === year);
    if (!a) return;
    const Y = computeStats(a.books, now).sempre, opener = document.activeElement;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const slide = (key, body) => `<section class="slide" data-s="${key}">${body}</section>`;
    const list = [slide("copertina", `<p class="kick">Il tuo anno da lettore</p><p class="big">${year}</p><p class="mid">Ecco com'è andata.</p><p class="sm">Tocca a destra per continuare</p>`),
      slide("numeri", `<p class="kick">I numeri</p><p class="big">${num(a.count)}</p><p class="mid">${a.count === 1 ? "libro letto" : "libri letti"}</p>${a.pages ? `<p class="big small">${num(a.pages)}</p><p class="mid">pagine</p><p class="sm">In media ${num(Math.max(1, Math.round(a.pages / (leap ? 366 : 365))))} pagine al giorno, tutti i giorni.</p>` : ""}`)];
    if (a.count >= 3) {
      const D = Y.days, topM = a.months.indexOf(Math.max(...a.months));
      if (Y.monthsCount) list.push(slide("mese", `<p class="kick">Il mese più letto</p><p class="big small">${MONTHS[topM][0].toUpperCase() + MONTHS[topM].slice(1)}</p><p class="mid">${plural(a.months[topM], "libro finito", "libri finiti")}</p>${monthsHTML(a.months)}`));
      if (D) list.push(slide("tempo", `<p class="kick">Tempo di lettura</p><p class="big">${D.avg}</p><p class="mid">${D.avg === 1 ? "giorno" : "giorni"} in media per libro</p><p class="sm">Il più veloce: ${esc(D.fastest.book.title)}, in ${plural(D.fastest.days, "giorno", "giorni")}.</p>`));
      if (a.topAuthor) list.push(slide("autore", `<p class="kick">L'autore dell'anno</p><p class="mid name">${esc(a.topAuthor.name)}</p><p class="sm">${plural(a.topAuthor.count, "libro letto", "libri letti")}</p>`));
      if (a.topGenre) list.push(slide("genere", `<p class="kick">Il genere dell'anno</p><p class="mid name">${esc(a.topGenre.name)}</p><p class="sm">${plural(a.topGenre.count, "libro", "libri")} su ${num(a.count)}</p>`));
      if (a.best) list.push(slide("preferito", `<p class="kick">Il tuo preferito</p><div class="fav">${coverHTML(a.best, 300)}<div><p class="mid name">${esc(a.best.title)}</p><p class="sm">${esc(a.best.author || "")}</p><p class="stars">${starStr(a.best.rating)}</p></div></div>`));
      if (a.avgRating != null) { const mx = Math.max(...Object.values(Y.ratings)); list.push(slide("voti", `<p class="kick">I tuoi voti</p><p class="big">★ ${dec(a.avgRating)}</p><p class="mid">voto medio</p><div class="story-votes">${[5, 4, 3, 2, 1].map(n => hbar(`<span role="img" aria-label="${n} stelle">${"★".repeat(n)}</span>`, Y.ratings[n], mx)).join("")}</div>`)); }
    }
    list.push(slide("chiusura", `<p class="kick">Il tuo ${year}</p><p class="mid">${plural(a.count, "libro", "libri")}, un anno da ricordare.</p><div class="story-covers">${a.books.slice(0, 12).map(b => coverHTML(b, 160)).join("")}</div><button class="story-done" type="button">Chiudi</button>`));
    const el = document.createElement("div");
    el.id = "story"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `Il tuo ${year}`); el.tabIndex = -1;
    el.innerHTML = `<div class="story-bars" aria-hidden="true">${list.map(() => "<i></i>").join("")}</div>
      <button class="story-close" type="button" aria-label="Chiudi il racconto">✕</button>
      <div class="story-body">${list.join("")}</div><p class="sr story-live" aria-live="polite"></p>
      <button class="story-prev" type="button" aria-label="Schermata precedente">‹</button><button class="story-next" type="button" aria-label="Schermata successiva">›</button>`;
    document.body.append(el); document.body.style.overflow = "hidden";
    const slides = [...el.querySelectorAll(".slide")], bars = [...el.querySelectorAll(".story-bars i")];
    let i = 0;
    const show = n => {
      i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach((x, k) => x.hidden = k !== i);
      bars.forEach((x, k) => x.classList.toggle("on", k <= i));
      const k = slides[i].querySelector(".kick"), body = slides[i].textContent.replace(/\s+/g, " ").trim();
      $(".story-live", el).textContent = `Schermata ${i + 1} di ${slides.length}: ${k ? k.textContent + ". " + body.slice(k.textContent.length).trim() : body}`.slice(0, 240);
      $(".story-prev", el).disabled = i === 0; $(".story-next", el).disabled = i === slides.length - 1;
      const a = document.activeElement; // un pulsante disattivato o nascosto perderebbe il focus: lo riporto sul racconto
      if (a && a !== el && el.contains(a) && (a.disabled || !a.offsetParent)) el.focus();
    };
    const close = () => {
      document.removeEventListener("keydown", keys, true); el.remove(); document.body.style.overflow = "";
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      else { const c = document.querySelector(`.story-card[data-story="${year}"]`); if (c) c.focus({ preventScroll: true }); }
    };
    function keys(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1); }
      else if (e.key === "Tab") { // il focus resta nel racconto
        const f = [...el.querySelectorAll("button:not([disabled])")].filter(b => b.offsetParent);
        if (!f.length) return;
        const at = f.indexOf(document.activeElement);
        if (at < 0) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
        else if (e.shiftKey && at === 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener("keydown", keys, true);
    el.addEventListener("click", e => {
      if (e.target.closest(".story-close, .story-done")) return close();
      if (e.target.closest(".story-prev")) return show(i - 1);
      if (e.target.closest(".story-next")) return show(i + 1);
      const r = el.getBoundingClientRect();
      show(e.clientX < r.left + r.width / 3 ? i - 1 : i + 1); // tocco: terzo sinistro indietro, il resto avanti
    });
    let x0 = null; // scorrimento orizzontale
    el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { e.preventDefault(); show(i + (dx < 0 ? 1 : -1)); } });
    show(0); el.focus();
  }

  // Menu: filtri a pillole (telefono), scaffali nella colonna laterale (computer), sezione attiva, vista dorsi/copertine.
  function renderNav() {
    const n = { tutti: state.books.length }; for (const b of state.books) n[b.status] = (n[b.status] || 0) + 1;
    const lib = state.view === "libreria";
    $("#pills").innerHTML = FILTERS // tutti i filtri sempre presenti: il controllo segmentato non cambia forma
      .map(([k, l]) => `<button type="button" class="pill" role="radio" data-filter="${k}" aria-checked="${state.filter === k}">${l}<b>${n[k] || 0}</b></button>`).join("");
    $("#side-shelves").innerHTML = `<span class="label">Scaffali</span>` + FILTERS
      .map(([k, l]) => `<button type="button" class="shelf-link" data-filter="${k}" aria-pressed="${lib && state.filter === k}">${l}<em>${n[k] || 0}</em></button>`).join("");
    $("#n-all").textContent = n.tutti || "";
    document.querySelectorAll("#dock [data-view]").forEach(t => t.setAttribute("aria-current", t.dataset.view === state.view ? "page" : "false"));
    document.querySelectorAll(".viewsw [data-mode]").forEach(x => x.setAttribute("aria-checked", String(x.dataset.mode === state.mode)));
  }
  function render() {
    renderTally(); renderNotice(); renderNav(); renderHero();
    const main = $("#main");
    if (state.view === "stats") main.innerHTML = renderStats(computeStats(state.books, new Date())); // la ricerca non vale qui: la sua barra è nascosta
    else {
      const list = visible().filter(b => state.filter === "tutti" || b.status === state.filter);
      if (state.mode === "dorsi") main.innerHTML = renderShelves(visible()); // gli scaffali da mostrare li sceglie renderShelves
      else main.innerHTML = list.length ? renderCovers(list) : `<p class="hint">${state.q.trim() ? "Nessun libro corrisponde alla ricerca." : "Nessun libro in questo scaffale."}</p>`;
    }
    $("#toolbar").hidden = state.view === "stats";
    wireMain(main);
  }
  function wireMain(root) {
    root.querySelectorAll("[data-story]").forEach(btn => btn.onclick = () => openStory(Number(btn.dataset.story)));
    root.querySelectorAll("[data-choose]").forEach(btn => btn.onclick = () => { const s = openSheet(""); fillNext(s); $("button", s).focus(); });
    root.querySelectorAll("[data-id]").forEach(wireItem);
    root.querySelectorAll("[data-more]").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.more;
      state.limit[key] = (state.limit[key] || PAGE) + PAGE;
      if (key === "covers") { swapIn(); render(); } else replaceShelf(key);
    });
    root.querySelectorAll("[data-less]").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.less;
      state.limit[key] = PAGE;
      if (key === "covers") { render(); $("#toolbar").scrollIntoView({ block: "start" }); return; }
      const sh = document.querySelector(`[data-shelf="${key}"]`);
      replaceShelf(key);
      // Chiudendo la lista torno all'inizio dello scaffale, senza restare in fondo a una lista corta.
      const now = document.querySelector(`[data-shelf="${key}"]`);
      if (now && now.getBoundingClientRect().top < 0) now.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    root.querySelectorAll("[data-page]").forEach(inp => inp.onchange = () => {
      const b = state.books.find(x => x.id === inp.dataset.page); if (!b) return;
      const v = Math.max(0, parseInt(inp.value, 10) || 0);
      pageQuick(b.id, { to: v, manual: true });
    });
    root.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => pageQuick(btn.dataset.idAdd, { add: Number(btn.dataset.add) }));
    root.querySelectorAll("[data-repeat]").forEach(btn => btn.onclick = () => { const b = state.books.find(x => x.id === btn.dataset.repeat); if (b && b.pageStep) pageQuick(b.id, { add: b.pageStep }); });
    root.querySelectorAll("[data-range]").forEach(r => {
      // Durante il trascinamento cambio solo il numero mostrato; salvo al rilascio.
      r.oninput = () => { const n = root.querySelector(`[data-page="${CSS.escape(r.dataset.range)}"]`); if (n) n.value = r.value; r.setAttribute("aria-valuetext", `pagina ${r.value} di ${r.max}`); };
      r.onchange = () => pageQuick(r.dataset.range, { to: Number(r.value), manual: true });
    });
    root.querySelectorAll("[data-save]").forEach(btn => btn.onclick = () => {
      const inp = root.querySelector(`[data-page="${CSS.escape(btn.dataset.save)}"]`);
      if (inp) inp.dispatchEvent(new Event("change")); // stesso salvataggio della pagina attuale
    });
    root.querySelectorAll("[data-finish]").forEach(btn => btn.onclick = () => { const b = state.books.find(x => x.id === btn.dataset.finish); if (b) setStatus(b, "letto"); });
  }
  // Modifiche arrivate dal cloud: aggiorno solo le parti che cambiano, senza ridisegnare tutta la pagina (niente sfarfallio).
  // list = [{ id, from, to, moved, added }]: from/to sono lo stato prima e dopo, moved se cambia qualcosa che sposta il libro.
  function refreshChanged(list) {
    if (!list.length) return;
    schedulePersist(); // i dati ricevuti vanno salvati sul dispositivo in ogni caso
    // Le proposte (da leggere) si vedono solo senza letture in corso: altrimenti non ridisegno l'hero, che toglierebbe il focus dalla pagina.
    const reading = state.books.some(b => b.status === "in-lettura");
    if (list.some(x => [x.from, x.to].includes("in-lettura") || x.removed || (!reading && [x.from, x.to].includes("da-leggere")))) renderHero();
    const main = $("#main");
    const visibleNow = () => visible().filter(b => state.filter === "tutti" || b.status === state.filter);
    const focused = document.activeElement;
    if (state.view === "stats" || list.some(x => x.added || x.removed) || (state.mode !== "dorsi" && list.some(x => x.moved))) { render(); return; }
    if (state.mode !== "dorsi") { // copertine: solo le copertine cambiate
      list.forEach(x => patchBookSafe(x.id, focused)); renderTally(); renderNav(); return;
    }
    const shelves = new Set();
    for (const x of list) {
      if (x.moved || x.from !== x.to) { if (x.from) shelves.add(x.from); if (x.to) shelves.add(x.to); }
      else patchBookSafe(x.id, focused);
    }
    for (const st of shelves) {
      const old = main.querySelector(`[data-shelf="${st}"]`);
      if (!old || old.contains(focused)) continue; // non tocco lo scaffale mentre stai scrivendo dentro
      replaceShelf(st);
    }
    renderTally(); renderNav();
  }
  function replaceShelf(st) {
    const main = $("#main"), old = main.querySelector(`[data-shelf="${st}"]`);
    if (!old) return;
    const list = visible().filter(b => state.filter === "tutti" || b.status === state.filter);
    const t = document.createElement("template"); t.innerHTML = shelfHTML(st, list).trim();
    const n = t.content.firstElementChild; old.replaceWith(n); wireMain(n);
  }
  function patchBookSafe(id, focused) {
    if (focused && focused.dataset && focused.dataset.page === id) return; // non cambio la pagina che stai scrivendo
    patchBook(id);
  }

  function wireItem(el) {
    el.onclick = () => { if (el.dataset.lp === "1") { el.dataset.lp = ""; return; } const b = state.books.find(x => x.id === el.dataset.id); if (b) openBook(b); };
    wireLongPress(el);
  }
  // Sostituisce solo gli elementi di un libro (dorso, copertina) senza ridisegnare la pagina.
  function patchBook(id) {
    const b = state.books.find(x => x.id === id); if (!b) return;
    if ($(`#hero [data-next="${CSS.escape(id)}"]`)) renderHero();
    document.querySelectorAll(`#main [data-id="${CSS.escape(id)}"], #hero [data-id="${CSS.escape(id)}"]`).forEach(el => {
      let html = null;
      if (el.classList.contains("spine")) html = spineHTML(b);
      else if (el.classList.contains("card")) html = cardHTML(b);
      else if (el.classList.contains("rcover")) html = `<button class="rcover" data-id="${esc(b.id)}" aria-label="Apri ${esc(b.title)}">${coverHTML(b, 160)}</button>`;
      if (!html) return;
      const t = document.createElement("template"); t.innerHTML = html.trim();
      const n = t.content.firstElementChild; el.replaceWith(n); wireItem(n);
    });
  }

  // Pressione prolungata su un dorso o una copertina: menu rapido per cambiare stato.
  function wireLongPress(el) {
    let t = null, x0 = 0, y0 = 0;
    const cancel = () => { clearTimeout(t); t = null; };
    el.addEventListener("pointerdown", e => {
      x0 = e.clientX; y0 = e.clientY; cancel();
      t = setTimeout(() => { t = null; el.dataset.lp = "1"; const b = state.books.find(x => x.id === el.dataset.id); if (b) openQuick(b); }, 480);
    });
    el.addEventListener("pointermove", e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  function openQuick(b) {
    const sheet = openSheet(`<div class="quick">
      <div class="quick-top">${coverHTML(b)}<div><h2>${esc(b.title)}</h2><div class="sub">${esc(b.author || "")}</div></div></div>
      <div class="quick-list">${["da-leggere", "in-lettura", "letto"].map(k => `<button class="btn${b.status === k ? " current" : ""}" data-st="${k}" ${b.status === k ? "disabled" : ""}>${{ "da-leggere": b.status === "desiderato" ? "Ho acquistato" : "Da leggere", "in-lettura": "Inizia a leggerlo", "letto": "Letto" }[k]}${b.status === k ? " · ora qui" : ""}</button>`).join("")}</div>
      <div class="actions"><button class="btn" id="q-open">Apri la scheda</button><button class="btn danger" id="q-del" type="button">Elimina</button><button class="btn ghost" id="q-close">Chiudi</button></div></div>`);
    sheet.querySelectorAll("[data-st]").forEach(btn => btn.onclick = () => { closeSheet(); setStatus(b, btn.dataset.st); });
    $("#q-open", sheet).onclick = () => { closeSheet(); openBook(b); };
    // Eliminazione in due tocchi, come nella scheda del libro.
    const del = $("#q-del", sheet);
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Conferma eliminazione"; return; }
      removeBook(b.id); closeSheet(); toast("Libro eliminato");
    };
    $("#q-close", sheet).onclick = closeSheet;
  }

  /* ---------- schede ---------- */
  let lastFocus = null, sheetGuard = null, sheetCancel = null;
  function openSheet(html) {
    lastFocus = document.activeElement; sheetGuard = null;
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const layer = $("#layer");
    layer.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    $("#scrim").onclick = e => { if (e.target.id === "scrim") dismissSheet(); };
    document.addEventListener("keydown", escClose);
    document.body.style.overflow = "hidden";
    return $(".sheet", layer);
  }
  function escClose(e) { if (e.key === "Escape") dismissSheet(); }
  // Ricorda lo stato iniziale dei campi: se l'utente chiude (sfondo, Esc, Chiudi) dopo aver cambiato qualcosa, chiede cosa fare.
  function guardSheet(sheet, save, extra = () => "") {
    const snap = () => JSON.stringify([...sheet.querySelectorAll("input:not([type=file]):not(#s-q), textarea")].map(i => i.value)) + extra();
    const first = snap();
    sheetGuard = { dirty: () => snap() !== first, save };
  }
  // then: dopo la chiusura, anche con Salva o Scarta.
  function dismissSheet(then) {
    const sheet = $("#layer .sheet"), go = typeof then == "function" && then;
    if (!sheet || !sheetGuard || !sheetGuard.dirty()) { closeSheet(); go && go(); return; }
    let bar = $(".unsaved", sheet);
    if (!bar) {
      bar = document.createElement("div"); bar.className = "unsaved"; bar.setAttribute("role", "alert");
      bar.innerHTML = `<span>Hai modifiche non salvate.</span><span class="actions"><button class="btn primary" type="button" data-u="save">Salva</button><button class="btn danger" type="button" data-u="drop">Scarta</button><button class="btn ghost" type="button" data-u="back">Continua</button></span>`;
      bar.onclick = e => {
        const u = e.target.dataset && e.target.dataset.u; if (!u) return;
        if (u === "drop") { closeSheet(); bar.go && bar.go(); }
        else if (u === "back") bar.remove();
        else { bar.remove(); sheetGuard.save(); sheetGuard || bar.go && bar.go(); }
      };
      sheet.append(bar);
    }
    bar.go = go;
    bar.querySelector("button").focus();
  }
  function closeSheet() {
    const cancel = sheetCancel; sheetCancel = null; if (cancel) cancel();
    sheetGuard = null;
    if (stopScan) stopScan();
    document.removeEventListener("keydown", escClose); document.body.style.overflow = "";
    const scrim = $("#scrim");
    const done = () => { if (scrim && scrim.isConnected) scrim.remove(); };
    if (scrim && !matchMedia("(prefers-reduced-motion: reduce)").matches) { scrim.classList.add("closing"); setTimeout(done, 180); } else done();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function readingFields(b) {
    return `
      <div class="field"><span class="label" id="f-status-l">Stato</span>
        <input type="hidden" id="f-status" value="${esc(b.status || "da-leggere")}">
        <div class="seg" role="radiogroup" aria-labelledby="f-status-l">${["da-leggere", "in-lettura", "letto"].map(k => `<button type="button" role="radio" data-v="${k}" aria-checked="${b.status === k}">${STATUS_ONE[k]}</button>`).join("")}<span class="seg-ink"></span></div>
      </div>
      <div>
        <div class="field"><span class="label">Voto</span><div class="rate" id="f-rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${(b.rating || 0) >= n ? "on" : ""}" aria-label="${n} stelle">★</button>`).join("")}</div></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="f-started">Iniziato il</label><input id="f-started" type="date" value="${esc(b.started || "")}"></div>
        <div class="field"><label for="f-finished">Finito il</label><input id="f-finished" type="date" value="${esc(b.finished || "")}"${b.status === "letto" ? "" : " disabled"}></div>
      </div>
      <p class="hint err" id="f-date-err" role="alert" hidden></p>
      <div class="field" id="f-year-row"${b.status === "letto" && !b.finished ? "" : " hidden"}><label for="f-year">oppure solo l'anno</label><input id="f-year" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" value="${esc(b.finishedYear || "")}" placeholder="es. 2019" aria-describedby="f-year-err"><p class="hint err" id="f-year-err" role="alert" hidden></p></div>
      <div class="field"><label for="f-page">Pagina attuale</label><input id="f-page" type="number" inputmode="numeric" min="0" value="${esc(b.status === "letto" && b.pages ? b.pages : b.page || "")}" placeholder="${b.pages ? "su " + b.pages : ""}"></div>
      <div class="field"><label for="f-notes">Note</label><textarea id="f-notes" placeholder="Cosa ti è rimasto di questo libro?">${esc(b.notes || "")}</textarea></div>
      <div class="field"><label for="f-quote">Citazione preferita</label><textarea id="f-quote" placeholder="Una frase da ricordare">${esc(b.quote || "")}</textarea></div>`;
  }
  function dataFields(b) {
    return `
      <div class="field"><label for="d-title">Titolo</label><input id="d-title" value="${esc(b.title || "")}" autocomplete="off"></div>
      <div class="field"><label for="d-author">Autore</label><input id="d-author" value="${esc(b.author || "")}" autocomplete="off"></div>
      <div class="grid-serie">
        <div class="field"><label for="d-series">Serie</label><input id="d-series" list="series-list" maxlength="80" value="${esc(b.series || "")}" autocomplete="off"></div>
        <div class="field"><label for="d-series-no">N.</label><input id="d-series-no" inputmode="decimal" maxlength="6" value="${esc(b.seriesNo || "")}" autocomplete="off"></div>
      </div>
      <datalist id="series-list">${[...seriesNames().values()].sort().map(s => `<option value="${esc(s)}">`).join("")}</datalist>
      <div class="grid2">
        <div class="field"><label for="d-year">Anno</label><input id="d-year" inputmode="numeric" value="${esc(b.year || "")}"></div>
        <div class="field"><label for="d-pages">Pagine</label><input id="d-pages" inputmode="numeric" value="${esc(b.pages || "")}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="d-genre">Genere</label><input id="d-genre" value="${esc(b.genre || "")}"></div>
        <div class="field"><label for="d-call">Segnatura</label><input id="d-call" value="${esc(b.callNo || "")}" placeholder="853.914 LEV"></div>
      </div>`;
  }
  function wireRating(sheet, holder) {
    const seg = $(".seg", sheet);
    if (seg) {
      const sync = () => { const on = seg.querySelector('[aria-checked="true"]'); const ink = seg.querySelector(".seg-ink");
        if (on && ink) { ink.style.width = on.offsetWidth + "px"; ink.style.transform = `translateX(${on.offsetLeft - 3}px)`; ink.style.opacity = 1; } };
      seg.querySelectorAll("button").forEach(btn => btn.onclick = () => {
        seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === btn)));
        $("#f-status", sheet).value = btn.dataset.v; sync();
        const fin = $("#f-finished", sheet); // la data di fine ha senso solo per un libro letto
        if (fin) { fin.disabled = btn.dataset.v !== "letto"; if (fin.disabled) { fin.value = ""; fin.dataset.ok = ""; } fin.min = $("#f-started", sheet).value || ""; }
        syncYearRow(sheet); syncPage(sheet);
      });
      const fin = $("#f-finished", sheet); if (fin) fin.addEventListener("input", () => syncYearRow(sheet));
      wireDates(sheet);
      const dp = $("#d-pages", sheet); if (dp) dp.addEventListener("input", () => syncPage(sheet));
      syncPage(sheet);
      requestAnimationFrame(sync);
    }
    sheet.querySelectorAll("#f-rate button").forEach(btn => btn.onclick = () => {
      const n = Number(btn.dataset.n); holder.rating = holder.rating === n ? 0 : n;
      sheet.querySelectorAll("#f-rate button").forEach(x => x.classList.toggle("on", Number(x.dataset.n) <= holder.rating));
    });
  }
  // Coerenza delle date di lettura: né nel futuro, la fine non prima dell'inizio. `edited` dice quale campo si sta cambiando.
  function dateProblem(started, finished, edited = "finished") {
    const t = today();
    if (finished && finished > t) return { field: "finished", msg: "La data di fine non può essere nel futuro." };
    if (started && started > t) return { field: "started", msg: "La data di inizio non può essere nel futuro." };
    if (started && finished && finished < started)
      return edited === "started" ? { field: "started", msg: "La data di inizio non può seguire quella di fine." } : { field: "finished", msg: "La data di fine non può precedere quella di inizio." };
    return null;
  }
  function wireDates(sheet) {
    const sta = $("#f-started", sheet), fin = $("#f-finished", sheet), err = $("#f-date-err", sheet);
    if (!sta || !fin) return;
    const say = (field, msg) => { err.hidden = !msg; err.textContent = msg || ""; [sta, fin].forEach(x => x.removeAttribute("aria-invalid")); if (msg && field) field.setAttribute("aria-invalid", "true"); };
    const limits = () => { const t = today(); sta.max = fin.value && fin.value < t ? fin.value : t; fin.min = sta.value || ""; fin.max = t; };
    [sta, fin].forEach(el => {
      el.dataset.ok = el.value; // ultimo valore coerente: se la nuova scelta non lo è, si torna a questo
      el.addEventListener("change", () => {
        const pr = dateProblem(sta.value, fin.value, el === sta ? "started" : "finished");
        if (pr) { el.value = el.dataset.ok; say(el, pr.msg); } else { el.dataset.ok = el.value; say(null); }
        limits(); syncYearRow(sheet);
      });
    });
    limits();
  }
  function badDates(sheet) {
    const sta = $("#f-started", sheet), fin = $("#f-finished", sheet);
    if (!sta || !fin) return false;
    const pr = dateProblem(sta.value, fin.disabled ? "" : fin.value);
    if (!pr) return false;
    const err = $("#f-date-err", sheet), el = pr.field === "started" ? sta : fin;
    err.hidden = false; err.textContent = pr.msg; el.setAttribute("aria-invalid", "true"); el.focus();
    return true;
  }
  // «oppure solo l'anno» solo per un libro letto senza data di fine
  function syncYearRow(sheet) { const r = $("#f-year-row", sheet); if (r) r.hidden = !($("#f-status", sheet).value === "letto" && !$("#f-finished", sheet).value); }
  // Un libro letto ha letto tutte le pagine: la pagina attuale segue il totale (e non si cambia a mano).
  function syncPage(sheet) {
    const pg = $("#f-page", sheet); if (!pg) return;
    if (pg.dataset.orig === undefined) pg.dataset.orig = pg.value;
    const tot = parseInt($("#d-pages", sheet) && $("#d-pages", sheet).value, 10) || 0, done = $("#f-status", sheet).value === "letto" && tot > 0;
    pg.readOnly = done; pg.value = done ? tot : pg.dataset.orig;
    pg.placeholder = tot ? "su " + tot : "";
  }
  // «Solo l'anno» scritto ma fuori da 1900–anno corrente: avviso sotto il campo e niente salvataggio.
  function badYear(sheet) {
    const row = $("#f-year-row", sheet), inp = $("#f-year", sheet), err = $("#f-year-err", sheet);
    if (!row || !inp) return false;
    const v = inp.value.trim(), y = Number(v), max = new Date().getFullYear();
    const bad = !row.hidden && v !== "" && !(Number.isInteger(y) && y >= 1900 && y <= max);
    err.hidden = !bad; err.textContent = bad ? `Scrivi un anno tra 1900 e ${max}, oppure lascia vuoto.` : "";
    if (bad) { inp.setAttribute("aria-invalid", "true"); inp.focus(); } else inp.removeAttribute("aria-invalid");
    return bad;
  }
  function readReading(sheet, b) {
    if (!$("#f-status", sheet)) return; // un libro nella lista dei desideri non ha campi di lettura
    const was = b.status;
    b.status = $("#f-status", sheet).value;
    b.started = $("#f-started", sheet).value; b.finished = $("#f-finished", sheet).value;
    if (b.status !== "letto") b.finished = ""; // la fine vale solo per un libro letto
    const y = $("#f-year", sheet); b.finishedYear = y && b.status === "letto" && !b.finished ? y.value.trim() : undefined;
    b.notes = $("#f-notes", sheet).value.trim(); b.quote = $("#f-quote", sheet).value.trim();
    const pg = parseInt($("#f-page", sheet).value, 10); b.page = pg >= 0 ? pg : undefined;
    const tot = parseInt($("#d-pages", sheet) && $("#d-pages", sheet).value, 10) || b.pages;
    if (b.status === "letto" && tot) b.page = tot; // letto = tutte le pagine
    if (b.status === "letto" && was !== "letto" && !b.finished && !b.finishedYear) b.finished = today();
  }
  function readData(sheet, b) {
    b.title = $("#d-title", sheet).value.trim() || b.title;
    b.author = $("#d-author", sheet).value.trim();
    b.year = parseInt($("#d-year", sheet).value, 10) || undefined;
    b.pages = parseInt($("#d-pages", sheet).value, 10) || undefined;
    b.genre = $("#d-genre", sheet).value.trim();
    b.callNo = $("#d-call", sheet).value.trim().toUpperCase();
    // Serie o N. cambiati a mano: niente più ricerche, seguito da rifare.
    const name = seriesName($("#d-series", sheet).value), no = $("#d-series-no", sheet).value.trim().replace(",", ".");
    if (seriesKey(name) !== seriesKey(b.series) || no !== String(b.seriesNo || "")) {
      b.series = name; b.seriesNo = no; b.seriesNext = ""; b.seriesManual = true;
    }
  }
  // Nomi già usati (prima forma trovata): un nome uguale prende quella forma.
  function seriesNames() {
    const m = new Map();
    for (const b of state.books) if (b.series && !m.has(seriesKey(b.series))) m.set(seriesKey(b.series), b.series);
    return m;
  }
  const seriesName = v => seriesNames().get(seriesKey(v)) || v.trim();
  function fillData(sheet, hit, b, { keepYear = false } = {}) {
    if (hit.title) $("#d-title", sheet).value = hit.title;
    if (hit.author) $("#d-author", sheet).value = hit.author;
    if (!keepYear && hit.edYear && !$("#d-year", sheet).value) $("#d-year", sheet).value = hit.edYear;
    if (hit.pages) { $("#d-pages", sheet).value = hit.pages; $("#d-pages", sheet).dispatchEvent(new Event("input")); }
    if (hit.genre && !$("#d-genre", sheet).value) $("#d-genre", sheet).value = hit.genre;
    if (!$("#d-call", sheet).value && hit.author) $("#d-call", sheet).value = surname3(hit.author);
    if (hit.cover) { b.cover = hit.cover; delete b.noCover; }
    if (hit.isbn) b.isbn = hit.isbn;
    if (hit.synopsis) {
      const head = (b.synopsis || "").split("\n")[0];
      b.synopsis = [/^Titolo originale|^Serie/.test(head) ? head : "", hit.synopsis].filter(Boolean).join("\n");
    }
    const prev = $(".sheet-top .cover", sheet); if (prev) prev.outerHTML = coverHTML({ ...b, title: hit.title || b.title, author: hit.author || b.author });
  }

  function searchBlock(prefill, scan = false) {
    return `<div class="field"><label for="s-q">Cerca il libro</label>
        <div class="search"><input id="s-q" type="search" value="${esc(prefill || "")}" placeholder="Titolo, autore o ISBN" autocomplete="off"><button class="btn" id="s-go" type="button">Cerca</button>${scan ? `<button class="btn" id="s-scan" type="button" aria-label="Scansiona il codice a barre">▥ ISBN</button>` : ""}</div></div>
      <div class="scanner" id="s-scanner" hidden><video id="s-video" playsinline muted></video><div class="scan-frame"></div><button class="btn" id="s-scan-stop" type="button">Chiudi fotocamera</button></div>
      <div class="status-line" id="s-status" aria-live="polite"></div>
      <div class="results" id="s-results"></div>`;
  }
  let zxingP = null, stopScan = null;
  function loadZXing() {
    return zxingP || (zxingP = new Promise((resolve, reject) => {
      const sc = document.createElement("script"); sc.src = "zxing.min.js";
      sc.onload = () => window.ZXing ? resolve(window.ZXing) : reject();
      sc.onerror = () => { zxingP = null; reject(); };
      document.head.append(sc);
    }));
  }
  function wireSearch(sheet, onPick) {
    const input = $("#s-q", sheet), status = $("#s-status", sheet), box = $("#s-results", sheet);
    let results = [], seq = 0; // seq: una risposta lenta di una ricerca vecchia non deve sovrascrivere quella nuova
    const go = async () => {
      const q = input.value.trim(); if (!q) { status.textContent = "Scrivi un titolo, un autore o un ISBN."; return; }
      if (!navigator.onLine) { status.textContent = "Sei offline: compila i campi a mano."; return; }
      const mine = ++seq;
      status.textContent = "Cerco tra le edizioni italiane…"; box.innerHTML = "";
      try {
        const found = await searchBooks(q);
        if (mine !== seq) return;
        results = found;
        status.textContent = results.length ? "Tocca l'edizione giusta per usarne i dati."
          : parseIsbn(q) && !results.errors.length ? "Nessuna fonte conosce questo ISBN."
          : "Nessun risultato" + (results.errors.length ? ": alcune fonti non hanno risposto (" + results.errors.join(", ") + ")" : ": prova con meno parole") + ". Riprova più tardi o compila a mano.";

        box.innerHTML = results.map((r, i) => `<button class="result" type="button" data-i="${i}">
          ${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg"></span>`}
          <div><b>${esc(r.title)}</b><span>${esc(r.author || "Autore sconosciuto")}${r.edYear ? " · " + r.edYear : ""}${r.pages ? " · " + r.pages + " pp." : ""}${r.isbn ? " · ISBN " + esc(r.isbn) : ""}${r.lang && r.lang !== "it" ? " · " + r.lang.toUpperCase() : ""}</span></div></button>`).join("");
        box.querySelectorAll(".result").forEach(el => el.onclick = () => { onPick(results[Number(el.dataset.i)]); box.innerHTML = ""; status.textContent = "Dati inseriti: controllali prima di salvare."; });
        if (!results.length && parseIsbn(q)) { // le fonti possono avere il libro senza il suo ISBN: si cerca per titolo e autore
          const alt = document.createElement("button");
          alt.type = "button"; alt.className = "btn"; alt.id = "s-title"; alt.textContent = "Cerca per titolo e autore";
          alt.onclick = () => { box.innerHTML = ""; status.textContent = ""; input.value = ""; input.placeholder = "Titolo e autore, es. Underworld DeLillo"; input.focus(); };
          box.append(alt);
        }
      } catch (e) {
        if (mine !== seq) return;
        status.textContent = "Ricerca non riuscita (" + ((e && e.code) || "errore") + "). Controlla la connessione o compila a mano.";
      }
    };
    $("#s-go", sheet).onclick = go;
    const scanBtn = $("#s-scan", sheet);
    if (scanBtn) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) scanBtn.hidden = true;
      scanBtn.onclick = async () => {
        const box2 = $("#s-scanner", sheet), video = $("#s-video", sheet);
        status.textContent = "Avvio la fotocamera…"; scanBtn.disabled = true;
        let stream = null, timer = null;
        const stop = () => { clearInterval(timer); stream && stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; box2.hidden = true; scanBtn.disabled = false; stopScan = null; };
        try {
          const ZX = await loadZXing();
          const hints = new Map(); hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13]);
          const core = new ZX.MultiFormatReader(); core.setHints(hints);
          // Apro la fotocamera io e faccio partire il video: così l'anteprima compare subito anche su iPhone.
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          video.setAttribute("playsinline", ""); video.muted = true; video.srcObject = stream;
          box2.hidden = false;
          await video.play();
          stopScan = stop;
          $("#s-scan-stop", sheet).onclick = () => { stopScan && stopScan(); status.textContent = ""; };
          status.textContent = "Inquadra il codice a barre sul retro del libro.";
          // Ogni 300 ms prendo un'immagine dal video e cerco il codice: funziona anche quando il video parte dopo il tocco.
          const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
          timer = setInterval(() => {
            if (!video.videoWidth) return;
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            let res = null;
            try { res = core.decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(canvas)))); }
            catch { return; } // nessun codice in questa immagine: riprovo
            const code = res.getText();
            if (!/^97[89]\d{10}$/.test(code)) { status.textContent = "Questo non è un ISBN: inquadra il codice sul retro, quello che inizia con 978 o 979."; return; }
            stop(); input.value = code; go();
          }, 300);
        } catch (e) {
          stop();
          status.textContent = e && e.name === "NotAllowedError"
            ? "Non ho il permesso di usare la fotocamera: consentilo quando te lo chiede, oppure scrivi l'ISBN a mano."
            : "Non riesco ad avviare la fotocamera. Scrivi l'ISBN a mano: lo trovi sopra il codice a barre.";
        }
      };
    }
    input.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
  }

  // Riduce la foto, la mette in verticale (testo dal basso verso l'alto, come nei libri italiani) e la salva come JPEG leggero.
  function processSpine(src, extraRotate = 0) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = typeof src === "string" ? src : URL.createObjectURL(src);
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        let deg = (w > h ? -90 : 0) + extraRotate;
        deg = ((deg % 360) + 360) % 360;
        const swap = deg === 90 || deg === 270;
        const W0 = swap ? h : w, H0 = swap ? w : h;
        const scale = Math.min(1, 640 / H0);
        const cw = Math.max(1, Math.round(W0 * scale)), ch = Math.max(1, Math.round(H0 * scale));
        const c = document.createElement("canvas"); c.width = cw; c.height = ch;
        const ctx = c.getContext("2d");
        ctx.translate(cw / 2, ch / 2); ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(img, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
        if (typeof src !== "string") URL.revokeObjectURL(url);
        resolve({ dataUrl: c.toDataURL("image/jpeg", 0.72), ratio: +(cw / ch).toFixed(3) });
      };
      img.onerror = () => { if (typeof src !== "string") URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  function openBook(book) {
    const b = { ...book };
    const sheet = openSheet(`
      <div class="sheet-top">${coverHTML(b)}<div>
        <h2>${esc(b.title)}</h2><div class="sub">${esc(b.author || "Autore sconosciuto")}</div>
        ${b.series ? `<button class="sserie" type="button" data-series>${esc(serLabel(b))}</button>` : ""}
        <div class="kv">${b.callNo ? `<span class="callno">${esc(b.callNo)}</span>` : ""}${b.year ? `<span>${esc(b.year)}</span>` : ""}${b.pages ? `<span>${esc(b.pages)} pp.</span>` : ""}${b.genre ? `<span>${esc(b.genre)}</span>` : ""}</div>
        ${b.finished ? `<p class="hint">Finito il ${esc(fmtDate(b.finished))}</p>` : ""}
        ${needsDates(b) ? `<p class="hint stale-note" id="s-stale"><i class="badge inline" aria-hidden="true">!</i><span>Periodo di lettura da aggiornare: ${b.finished || b.finishedYear ? esc(dateProblem(b.started || "", b.finished || "").msg) : "aggiungi la data di fine, o almeno l'anno."}</span></p>` : ""}
      </div></div>
      <p class="synopsis" id="s-syn"${b.synopsis ? "" : " hidden"}>${esc(b.synopsis || "")}</p>
      <div class="refresh"><button class="btn" id="s-refresh" type="button">Aggiorna informazioni</button><div class="status-line" id="s-ref-status" aria-live="polite"></div></div>
      ${b.status === "desiderato" ? `<div class="wish-box"><p class="hint">Nella lista dei desideri. Quando lo compri:</p><button class="btn primary" id="s-bought" type="button">Ho acquistato: passa a Da leggere</button></div>` : readingFields(b)}
      <div class="cover-edit">
        <div class="cover-head"><span class="label">Copertina</span><button class="btn" id="cv-more" type="button">Scegli un'altra copertina</button></div>
        <div class="status-line" id="cv-status" aria-live="polite"></div>
        <div class="cover-picks" id="cv-picks" hidden></div>
      </div>
      <div class="spine-edit">
        <span class="label">Dorso sullo scaffale</span>
        <div class="spine-row">
          <div class="spine-prev" id="sp-prev">${spineHTML(b, "div")}</div>
          <div class="spine-actions">
            <label class="btn" for="sp-file">${b.spine ? "Cambia foto del dorso" : "Fotografa il dorso"}</label>
            <input type="file" id="sp-file" accept="image/*" hidden>
            <span class="actions"><button class="btn" id="sp-rot" type="button">Ruota</button><button class="btn danger" id="sp-del" type="button">Rimuovi</button></span>
            <p class="hint">Inquadra solo il dorso, da vicino e con buona luce. Va bene anche in orizzontale: lo raddrizzo io.</p>
          </div>
        </div>
      </div>
      <details class="edit"><summary>Modifica dati e copertina</summary><div class="inner">
        ${searchBlock(b.title + " " + (b.author || ""))}
        ${dataFields(b)}
        <div class="actions"><button class="btn" id="cv-clear" type="button">${b.cover ? "Usa copertina disegnata" : "Nessuna copertina trovata"}</button></div>
      </div></details>
      <div class="actions">
        <button class="btn primary" id="s-save">Salva</button>
        <button class="btn ghost" id="s-close">Chiudi</button>
        <button class="btn danger" id="s-del">Elimina</button>
      </div>`);
    wireRating(sheet, b);
    wireSearch(sheet, hit => fillData(sheet, hit, b, { keepYear: true }));
    const spPrev = $("#sp-prev", sheet), spRot = $("#sp-rot", sheet), spDel = $("#sp-del", sheet);
    const spSync = () => { spPrev.innerHTML = spineHTML(b, "div"); spRot.disabled = spDel.disabled = !b.spine; };
    spSync();
    $("#sp-file", sheet).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const r = await processSpine(f); b.spine = r.dataUrl; b.spineRatio = r.ratio; spSync(); toast("Foto pronta: tocca Salva per tenerla."); }
      catch { toast("Non riesco a leggere questa foto. Riprova con un'altra."); }
      e.target.value = "";
    };
    spRot.onclick = async () => { const r = await processSpine(b.spine, 180); b.spine = r.dataUrl; b.spineRatio = r.ratio; spSync(); };
    spDel.onclick = () => { delete b.spine; delete b.spineRatio; spSync(); };
    const cvMore = $("#cv-more", sheet), cvPicks = $("#cv-picks", sheet), cvStatus = $("#cv-status", sheet);
    let cands = [];
    const drawPicks = () => {
      cvPicks.hidden = false;
      cvPicks.innerHTML = cands.map((c, i) => `<button type="button" class="pick${c.cover === b.cover ? " on" : ""}" data-i="${i}" aria-label="Copertina ${i + 1}${c.src ? " da " + c.src : ""}">
          <img src="${esc(c.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><span>${c.it ? "🇮🇹 " : ""}${esc(c.src || "")}</span></button>`).join("") +
        `<button type="button" class="pick none${!b.cover ? " on" : ""}" data-i="-1">${coverHTML({ ...b, cover: "" })}<span>Disegnata</span></button>`;
      cvPicks.querySelectorAll(".pick").forEach(el => el.onclick = () => {
        const i = Number(el.dataset.i);
        if (i < 0) { delete b.cover; b.noCover = true; } else { b.cover = cands[i].cover; delete b.noCover; }
        b.coverManual = true;
        cvPicks.querySelectorAll(".pick").forEach(x => x.classList.toggle("on", x === el));
        const p = $(".sheet-top .cover", sheet); if (p) p.outerHTML = coverHTML(b);
        spSync(); cvStatus.textContent = "Tocca Salva per tenere questa copertina.";
      });
    };
    cvMore.onclick = async () => {
      if (!navigator.onLine) { cvStatus.textContent = "Serve una connessione per cercare le copertine."; return; }
      cvMore.disabled = true; cvStatus.textContent = "Cerco le copertine…";
      cands = await coverCandidates(b);
      if (b.cover && !cands.some(c => c.cover === b.cover)) cands.unshift({ cover: b.cover, src: "attuale" });
      cvStatus.textContent = cands.length > (b.cover ? 1 : 0) ? "Tocca quella che preferisci." : "Non ho trovato altre copertine: prova a correggere titolo o autore in Modifica dati.";
      drawPicks(); cvMore.disabled = false; cvMore.textContent = "Cerca di nuovo";
    };
    // Aggiorna informazioni: cerca il libro su tutte le fonti e riempie la scheda; si conferma con Salva.
    const refBtn = $("#s-refresh", sheet), refSt = $("#s-ref-status", sheet);
    refBtn.onclick = async () => {
      if (!navigator.onLine) { refSt.textContent = "Serve una connessione per aggiornare le informazioni."; return; }
      const cur = { ...b }; readData(sheet, cur); // usa titolo e autore come sono ora nei campi
      refBtn.disabled = true; refSt.textContent = "Cerco le informazioni…";
      const errors = {};
      const info0 = await fetchInfo(cur, errors).catch(() => null), info = info0 || {};
      const sr = await findSeries({ ...cur, isbn: cur.isbn || info.isbn }).catch(() => null);
      refBtn.disabled = false;
      if (!info0 && !sr) {
        const err = Object.keys(errors).join(", ");
        refSt.textContent = `Nessuna informazione trovata${err ? " (" + err + ")" : ""}. Prova a correggere titolo o autore in Modifica dati.`;
        return;
      }
      const got = [];
      const put = (id, v, label, onlyEmpty) => {
        const el = $(id, sheet);
        if (!v || String(el.value) === String(v) || (onlyEmpty && el.value.trim())) return;
        el.value = v; el.dispatchEvent(new Event("input")); got.push(label);
      };
      put("#d-author", info.author, "autore");
      put("#d-year", info.edYear, "anno", true); // l'anno può essere quello della prima edizione: non lo sovrascrivo
      put("#d-pages", info.pages, "pagine");
      put("#d-genre", info.genre, "genere", true);
      put("#d-call", info.author && surname3(info.author), "segnatura", true);
      if (info.isbn && !b.isbn) { b.isbn = info.isbn; got.push("ISBN"); }
      if (info.synopsis && !(b.synopsis || "").includes(info.synopsis)) {
        const head = (b.synopsis || "").split("\n")[0];
        b.synopsis = [/^Titolo originale|^Serie/.test(head) ? head : "", info.synopsis].filter(Boolean).join("\n");
        const syn = $("#s-syn", sheet); syn.textContent = b.synopsis; syn.hidden = false; got.push("trama");
      }
      if (sr) { // si tiene con Salva
        const nb = applySeries(cur, sr);
        if (nb.series !== cur.series || nb.seriesNo !== cur.seriesNo) { $("#d-series", sheet).value = b.series = nb.series; $("#d-series-no", sheet).value = b.seriesNo = nb.seriesNo || ""; b.seriesNext = nb.seriesNext; got.push("serie"); }
        if (nb.seriesNext && nb.seriesNext !== b.seriesNext) { b.seriesNext = nb.seriesNext; got.push("seguito"); }
      }
      if (info.cover && info.cover !== b.cover && !b.coverManual) { b.cover = info.cover; delete b.noCover; cvc.disabled = false; got.push("copertina"); }
      const p = $(".sheet-top .cover", sheet); if (p) p.outerHTML = coverHTML({ ...b, author: $("#d-author", sheet).value });
      $(".sheet-top .sub", sheet).textContent = $("#d-author", sheet).value || "Autore sconosciuto";
      spSync();
      if (got.some(g => ["autore", "anno", "pagine", "genere", "segnatura", "serie"].includes(g))) $("details.edit", sheet).open = true;
      refSt.textContent = got.length ? `Aggiornati: ${got.join(", ")}. Tocca Salva per tenerli.` : "Le informazioni sono già aggiornate.";
    };
    const cvc = $("#cv-clear", sheet);
    cvc.disabled = !b.cover;
    cvc.onclick = () => { delete b.cover; b.noCover = true; cvc.disabled = true; const p = $(".sheet-top .cover", sheet); if (p) p.outerHTML = coverHTML(b); };
    $("#s-close", sheet).onclick = dismissSheet;
    const ser = $("[data-series]", sheet); // serie → ricerca nella libreria
    if (ser) ser.onclick = () => dismissSheet(() => searchFor(book.series));
    $("#s-save", sheet).onclick = () => { if (badYear(sheet) || badDates(sheet)) return; readReading(sheet, b); readData(sheet, b); upsert(b); closeSheet(); toast("Salvato"); };
    const bought = $("#s-bought", sheet);
    if (bought) bought.onclick = () => { const cur = state.books.find(x => x.id === b.id) || b; closeSheet(); setStatus(cur, "da-leggere"); };
    const del = $("#s-del", sheet);
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Conferma eliminazione"; return; }
      removeBook(b.id); closeSheet(); toast("Libro eliminato");
    };
    guardSheet(sheet, () => $("#s-save", sheet).click(), () => JSON.stringify(b));
  }

  function openAdd({ scan = false } = {}) {
    const b = { status: "da-leggere", rating: 0 };
    const sheet = openSheet(`
      <h2>Nuovo libro</h2>
      ${searchBlock("", true)}
      <div class="sheet-top" hidden id="a-prev"></div>
      <div class="cover-edit" id="a-cov">
        <div class="cover-head"><span class="label">Copertina</span><button class="btn" id="a-cv-more" type="button">Scegli un'altra copertina</button></div>
        <div class="status-line" id="a-cv-status" aria-live="polite"></div>
        <div class="cover-picks" id="a-cv-picks" hidden></div>
      </div>
      ${dataFields(b)}
      ${readingFields(b)}
      <div class="actions"><button class="btn primary" id="a-save">Aggiungi alla libreria</button><button class="btn" id="a-wish" type="button">Lista dei desideri</button><button class="btn ghost" id="a-cancel">Annulla</button></div>`);
    wireRating(sheet, b);
    wireSearch(sheet, hit => {
      const prev = $("#a-prev", sheet); prev.hidden = false;
      prev.innerHTML = `${coverHTML({ ...hit })}<div><p class="synopsis">${esc(hit.synopsis || "")}</p></div>`;
      fillData(sheet, hit, b);
    });
    // Copertine alternative già nella scheda di inserimento (stesso criterio della scheda di modifica).
    const cvMore = $("#a-cv-more", sheet), cvPicks = $("#a-cv-picks", sheet), cvStatus = $("#a-cv-status", sheet);
    const showCover = () => { const prev = $("#a-prev", sheet); prev.hidden = false; prev.innerHTML = `${coverHTML({ ...b })}<div><p class="synopsis">${esc(b.synopsis || "")}</p></div>`; };
    cvMore.onclick = async () => {
      readData(sheet, b);
      if (!b.title) { cvStatus.textContent = "Scrivi prima il titolo, poi cerco le copertine."; return; }
      if (!navigator.onLine) { cvStatus.textContent = "Serve una connessione per cercare le copertine."; return; }
      cvMore.disabled = true; cvStatus.textContent = "Cerco le copertine…";
      const cands = await coverCandidates(b);
      if (b.cover && !cands.some(c => c.cover === b.cover)) cands.unshift({ cover: b.cover, src: "attuale" });
      cvStatus.textContent = cands.length ? "Tocca quella che preferisci." : "Non ho trovato copertine: prova a correggere titolo o autore.";
      cvPicks.hidden = !cands.length;
      cvPicks.innerHTML = cands.map((c, i) => `<button type="button" class="pick${c.cover === b.cover ? " on" : ""}" data-i="${i}" aria-label="Copertina ${i + 1}${c.src ? " da " + c.src : ""}">
          <img src="${esc(c.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><span>${c.it ? "🇮🇹 " : ""}${esc(c.src || "")}</span></button>`).join("") +
        `<button type="button" class="pick none${!b.cover ? " on" : ""}" data-i="-1">${coverHTML({ ...b, cover: "" })}<span>Disegnata</span></button>`;
      cvPicks.querySelectorAll(".pick").forEach(el => el.onclick = () => {
        const i = Number(el.dataset.i);
        if (i < 0) { delete b.cover; b.noCover = true; } else { b.cover = cands[i].cover; delete b.noCover; }
        b.coverManual = true;
        cvPicks.querySelectorAll(".pick").forEach(x => x.classList.toggle("on", x === el));
        showCover(); cvStatus.textContent = "Tocca Aggiungi per tenere questa copertina.";
      });
      cvMore.disabled = false; cvMore.textContent = "Cerca di nuovo";
    };
    const sb = $("#s-scan", sheet);
    // La fotocamera può partire solo da un tocco dell'utente: la pressione prolungata apre la scheda con il pulsante ISBN in evidenza.
    if (sb && !sb.hidden) loadZXing().catch(() => {}); // libreria del lettore pronta prima del tocco
    if (scan && sb && !sb.hidden) toast("Tocca ▥ ISBN per inquadrare il codice");
    if (!scan) setTimeout(() => $("#s-q", sheet).focus(), 50);
    $("#a-cancel", sheet).onclick = dismissSheet;
    $("#a-save", sheet).onclick = () => {
      if (badYear(sheet) || badDates(sheet)) return;
      readData(sheet, b);
      if (!$("#d-title", sheet).value.trim()) { $("#s-status", sheet).textContent = "Il titolo è obbligatorio."; $("#d-title", sheet).focus(); return; }
      readReading(sheet, b);
      if (state.books.some(x => keyOf(x) === keyOf(b))) { toast("Questo libro è già nella libreria."); return; }
      seriesLater(upsert(b)); closeSheet(); toast("Aggiunto alla libreria");
    };
    $("#a-wish", sheet).onclick = () => {
      readData(sheet, b);
      if (!$("#d-title", sheet).value.trim()) { $("#s-status", sheet).textContent = "Il titolo è obbligatorio."; $("#d-title", sheet).focus(); return; }
      if (state.books.some(x => keyOf(x) === keyOf(b))) { toast("Questo libro è già nella libreria."); return; }
      b.status = "desiderato";
      seriesLater(upsert(b)); closeSheet(); toast("Aggiunto alla lista dei desideri");
    };
    guardSheet(sheet, () => $("#a-save", sheet).click(), () => JSON.stringify(b));
  }

  function openMore() {
    const y = new Date().getFullYear(), goal = (getSet().goals || {})[y];
    const done = state.books.filter(b => b.status === "letto" && yearOf(b.finished) === y).length;
    const last = getSet().lastBackup, days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const missing = state.books.filter(b => !b.cover && !b.noCover).length;
    const sheet = openSheet(`<h2>Altro</h2>
      <div class="menu-list">
        <button type="button" data-m="sync"><b>Accedi e sincronizza</b><span>${cloud.email ? "Collegato come " + esc(cloud.email) : "La stessa libreria su iPhone, iPad e computer"}</span></button>
        <button type="button" data-m="goal"><b>Obiettivo ${y}</b><span>${goal ? `${done} di ${goal} libri` : "Non ancora fissato"}</span></button>
        <button type="button" data-m="backup" class="${backupDue() ? "due" : ""}"><b>Backup, importa e copertine</b><span>${days === null ? "Nessun backup ancora" : days === 0 ? "Ultimo backup: oggi" : `Ultimo backup: ${days} ${days === 1 ? "giorno" : "giorni"} fa`}${missing ? ` · ${missing} senza copertina` : ""}</span></button>
      </div>
      <div class="actions"><button class="btn ghost" id="m-close">Chiudi</button></div>`);
    $("[data-m=goal]", sheet).onclick = openGoal;
    $("[data-m=backup]", sheet).onclick = openImport;
    $("[data-m=sync]", sheet).onclick = openSync;
    $("#m-close", sheet).onclick = closeSheet;
  }

  /* ---------- accesso e sincronizzazione (Firebase, caricata solo quando serve) ---------- */
  const cloud = { email: cloudInfo().email || "" };
  const CLOUD_SCRIPTS = [
    "https://cdn.jsdelivr.net/npm/firebase@10.14.1/firebase-app-compat.js",
    "https://cdn.jsdelivr.net/npm/firebase@10.14.1/firebase-auth-compat.js",
    "https://cdn.jsdelivr.net/npm/firebase@10.14.1/firebase-firestore-compat.js",
    "cloud.js"
  ];
  let cloudLoading = null;
  function loadCloud() {
    if (window.libreriaCloud) return Promise.resolve(window.libreriaCloud);
    if (!cloudLoading) cloudLoading = CLOUD_SCRIPTS.reduce((p, src) => p.then(() => new Promise((ok, ko) => {
      const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko({ code: "rete" }); document.head.append(s);
    })), Promise.resolve()).then(() => window.libreriaCloud, e => { cloudLoading = null; throw e; });
    return cloudLoading;
  }
  const errText = e => (e && (e.message || e.code)) || String(e);
  // Ponte con cloud.js: lo strato di sincronizzazione legge e scrive i libri solo tramite queste funzioni.
  window.libreriaHost = {
    books: () => state.books,
    keyOf,
    tombs: getTombs,
    clearTomb(id) { const t = getTombs(); delete t[id]; setTombs(t); },
    setLocal(id, book) {
      const i = state.books.findIndex(x => x.id === id);
      if (!book) { if (i >= 0) state.books.splice(i, 1); return; }
      const nb = { ...clean(book), id };
      if (i >= 0) state.books[i] = nb; else state.books.push(nb);
    },
    renameLocal(from, to) {
      const b = state.books.find(x => x.id === from); if (!b) return;
      state.books = state.books.filter(x => x.id !== from); state.books.push({ ...b, id: to });
    },
    refresh() { schedulePersist(); render(); },
    refreshChanged,
    snapshot,
    tally: () => renderTally(),
    status(msg) { const el = $("#sy-status"); if (el) el.textContent = msg; },
    error(msg) { const el = $("#sy-status"); if (el) el.textContent = msg; const info = $("#sy-info"); if (info) info.textContent = msg; else toast(msg); },
    done(msg) { if ($("#sy-status")) closeSheet(); toast(msg); },
    notice(msg) { if ($("#sy-status")) closeSheet(); toast(msg, { label: "OK", run: () => {} }); }, // messaggio lungo: resta 10 secondi
    connected(email) { cloud.email = email || ""; },
    goals: () => ({ goals: getSet().goals || {}, updated: getSet().goalsAt || 0 }),
    setGoals(goals, updated) { try { localStorage.setItem(SET_KEY, JSON.stringify({ ...getSet(), goals, goalsAt: updated })); } catch {} },
    info(text) { const el = $("#sy-info"); if (el) el.textContent = text; },
    askMerge
  };
  function openSync() {
    if (cloud.email) return openSyncDone();
    // Nell'app installata su iPhone l'accesso con Google non torna all'app (né con popup né con redirect): lì si usa il link via email.
    const iosApp = navigator.standalone === true;
    const sheet = openSheet(`<h2>Accedi e sincronizza</h2>
      <p class="hint">La libreria diventa la stessa su iPhone, iPad e computer. Funziona anche offline: le modifiche partono appena torna la rete.</p>
      ${iosApp
        ? `<p class="hint">Nell'app installata su iPhone, iOS non lascia completare l'accesso con Google: usa il link via email, con lo stesso indirizzo del tuo account Google. Se l'account non ha libri, l'app te lo dice.</p>`
        : `<div class="actions"><button class="btn primary" id="sy-google" disabled>Accedi con Google</button></div>`}
      <div class="field"><label for="sy-email">${iosApp ? "Accedi con un link via email (senza password)" : "Oppure con un link via email (senza password)"}</label><input id="sy-email" type="email" autocomplete="email" inputmode="email" placeholder="tua@email.it" value="${esc(cloudInfo().lastEmail || "")}"></div>
      <div class="actions"><button class="btn" id="sy-link" disabled>Invia il link</button></div>
      <div class="field"><label for="sy-paste">Hai ricevuto il link? Copialo (tieni premuto, poi Copia) e incollalo qui senza aprirlo</label><input id="sy-paste" type="url" autocomplete="off" placeholder="https://…"></div>
      <div class="actions"><button class="btn" id="sy-paste-go" disabled>Accedi con il link</button></div>
      <div class="status-line" id="sy-status" aria-live="polite">Preparo l'accesso…</div>
      <div class="actions"><button class="btn ghost" id="sy-close">Chiudi</button></div>`);
    const st = msg => { $("#sy-status", sheet).textContent = msg; };
    $("#sy-close", sheet).onclick = closeSheet;
    loadCloud().then(() => {
      ["#sy-google", "#sy-link", "#sy-paste-go"].forEach(sel => { const b = $(sel, sheet); if (b) b.disabled = false; });
      st("");
    }).catch(() => st("Non riesco a caricare il servizio. Controlla la connessione e riprova."));
    // Il clic su Google deve partire subito (il browser blocca le finestre aperte dopo): per questo il servizio si carica quando la scheda si apre.
    if (!iosApp) $("#sy-google", sheet).onclick = () => {
      st("Apro l'accesso con Google…");
      window.libreriaCloud.signInGoogle().catch(e => {
        const c = (e && e.code) || "errore";
        st(/popup-closed-by-user|cancelled-popup-request/.test(c) ? "Accesso annullato."
          : /network-request-failed/.test(c) ? "Nessuna connessione: riprova quando sei online."
          : "Accesso non riuscito (" + c + "). Puoi usare il link via email qui sotto.");
      });
    };
    $("#sy-link", sheet).onclick = () => {
      const email = $("#sy-email", sheet).value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { st("Scrivi un indirizzo email valido."); return; }
      st("Invio il link…");
      window.libreriaCloud.sendLink(email)
        .then(() => { setCloudInfo({ lastEmail: email }); st("Link inviato a " + email + ". Copialo dall'email e incollalo qui sopra, senza aprirlo."); })
        .catch(e => st("Non riesco a inviare il link (" + ((e && e.code) || "errore") + ")."));
    };
    $("#sy-paste-go", sheet).onclick = () => {
      const link = $("#sy-paste", sheet).value.trim(), email = $("#sy-email", sheet).value.trim() || cloudInfo().lastEmail || "";
      if (!link) { st("Incolla il link."); return; }
      if (!email) { st("Scrivi l'email a cui hai ricevuto il link."); return; }
      st("Accedo…");
      window.libreriaCloud.finishLink(email, link).catch(() => st("Link non valido o scaduto: chiedine uno nuovo."));
    };
  }
  function openSyncDone() {
    const sheet = openSheet(`<h2>Sincronizzazione</h2>
      <p class="hint">Collegato come <b>${esc(cloud.email)}</b>. Ogni modifica va nel cloud e arriva anche sugli altri dispositivi.</p>
      <div class="actions"><button class="btn primary" id="sy-now">Sincronizza ora</button><button class="btn danger" id="sy-out">Esci da questo dispositivo</button></div>
      <div class="status-line" id="sy-info">Controllo lo stato…</div>
      <div class="actions"><button class="btn" id="sy-re">Riconnetti</button></div>
      <p class="hint">Uscendo i libri restano su questo dispositivo, ma smettono di aggiornarsi dal cloud.</p>
      <div class="status-line" id="sy-status" aria-live="polite"></div>
      <div class="actions"><button class="btn ghost" id="sy-close">Chiudi</button></div>`);
    $("#sy-close", sheet).onclick = closeSheet;
    loadCloud().then(c => c.refreshInfo()).catch(e => $("#sy-info", sheet).textContent = "Errore di caricamento: " + errText(e));
    $("#sy-now", sheet).onclick = () => loadCloud().then(c => c.syncNow()).catch(e => { $("#sy-info", sheet).textContent = "Errore: " + errText(e); });
    $("#sy-re", sheet).onclick = () => loadCloud().then(c => c.reconnect()).catch(e => { $("#sy-info", sheet).textContent = "Errore: " + errText(e); });
    $("#sy-out", sheet).onclick = () => { if (window.libreriaCloud) window.libreriaCloud.signOut(); closeSheet(); toast("Sei uscito: i libri restano su questo dispositivo."); };
  }
  // Primo accesso con libri da entrambe le parti: decide l'utente. Annullare = non sincronizzare.
  function askMerge(cloudCount) {
    return new Promise(resolve => {
      const sheet = openSheet(`<h2>Unisco i libri?</h2>
        <p class="hint">Su questo dispositivo ci sono ${state.books.length} libri, nel cloud ${cloudCount}. Come procedo?</p>
        <div class="menu-list">
          <button type="button" data-c="merge"><b>Unisci (consigliato)</b><span>Per ogni libro vince la modifica più recente: non si perde nulla.</span></button>
          <button type="button" data-c="cloud"><b>Usa solo il cloud</b><span>I libri che ci sono solo su questo dispositivo vengono tolti.</span></button>
          <button type="button" data-c="device"><b>Usa solo questo dispositivo</b><span>Il cloud viene sostituito con i libri di questo dispositivo.</span></button>
        </div>
        <div class="actions"><button class="btn ghost" id="mc-no" type="button">Annulla</button></div>`);
      sheetCancel = () => resolve(null);
      sheet.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { sheetCancel = null; closeSheet(); resolve(b.dataset.c); });
      $("#mc-no", sheet).onclick = closeSheet;
    });
  }

  /* ---------- importa / esporta ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  function fromGoodreads(text) {
    const rows = parseCSV(text); if (rows.length < 2) return [];
    const h = rows[0].map(x => x.trim()); const ix = n => h.indexOf(n);
    const shelf = { "read": "letto", "currently-reading": "in-lettura", "to-read": "da-leggere" };
    return rows.slice(1).map(r => {
      const g = n => (ix(n) >= 0 ? (r[ix(n)] || "").trim() : "");
      return {
        title: g("Title").replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, ""), author: g("Author").replace(/\s+/g, " "),
        rating: Number(g("My Rating")) || 0, pages: Number(g("Number of Pages")) || undefined,
        year: Number(g("Original Publication Year")) || Number(g("Year Published")) || undefined,
        finished: g("Date Read").replace(/\//g, "-"), status: shelf[g("Exclusive Shelf")] || "da-leggere",
        notes: g("My Review").replace(/<br\s*\/?>/gi, "\n")
      };
    }).filter(b => b.title);
  }
  async function loadSeed() {
    try {
      const r = await fetch("seed.json", { cache: "no-store" });
      if (!r.ok) throw 0;
      const j = await r.json();
      const { added, skipped } = addMany(j.books || []);
      toast(`Caricati ${added} libri${skipped ? `, ${skipped} già presenti` : ""}.`, added && navigator.onLine ? { label: "Cerca copertine", run: () => runCoverJob() } : null);
    } catch { toast("Non trovo il file dei libri Goodreads (seed.json)."); }
  }
  async function exportBackup(status) {
    const data = JSON.stringify({ app: "libreria-diego", version: 1, exported: new Date().toISOString(), books: state.books.map(clean) }, null, 2);
    const name = `libreria-diego-${today()}.json`;
    const file = new File([data], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Backup MyLibrary" }); setSet({ lastBackup: Date.now() }); status.textContent = "Backup condiviso."; render(); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setSet({ lastBackup: Date.now() }); render();
    status.textContent = "Backup scaricato.";
  }

  function openImport() {
    const last = getSet().lastBackup;
    const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const missing = state.books.filter(b => !b.cover && !b.noCover).length;
    const noAuthor = state.books.filter(b => !b.author || (!b.cover && !b.noCover)).length;
    const sheet = openSheet(`
      <h2>Backup e copertine</h2>
      <section class="arch">
        <span class="label">Annulla</span>
        <p class="hint">Prima delle operazioni su molti libri salvo una copia: puoi tornare indietro.</p>
        <div class="ulist" id="u-list"></div>
      </section>
      <section class="arch">
        <span class="label">Backup</span>
        <p class="${backupDue() ? "warn" : "hint"}">${days === null ? "Non hai ancora fatto un backup." : days === 0 ? "Ultimo backup: oggi." : `Ultimo backup: ${days} ${days === 1 ? "giorno" : "giorni"} fa.`} I dati stanno solo su questo iPhone: esportalo ogni tanto in File o iCloud.</p>
        <div class="actions"><button class="btn primary" id="i-export">Esporta backup</button></div>
      </section>
      <section class="arch">
        <span class="label">Copertine</span>
        <p class="hint">${missing ? `${missing} libri senza copertina.` : "Tutti i libri hanno una copertina o hai scelto quella disegnata."}</p>
        <div class="actions">${missing ? `<button class="btn" id="i-covers">Cerca copertine mancanti</button>` : ""}<button class="btn" id="i-redo">Rifai tutte preferendo le edizioni italiane</button></div>
        <div class="actions"><button class="btn" id="i-verify" type="button">Verifica ricerche</button></div>
        <div class="status-line" id="v-status" aria-live="polite"></div>
        ${noAuthor ? `<p class="hint">${noAuthor} libri senza autore o copertina: li cerco per ISBN, titolo e autore (serve la connessione).</p><div class="actions"><button class="btn" id="i-authors">Completa autori e copertine</button></div>` : ""}
        <p class="hint">Le copertine che hai scelto a mano e i dorsi fotografati non vengono toccati.</p>
      </section>
      <section class="arch">
        <span class="label">Importa</span>
        <p class="hint">Un backup JSON oppure il CSV esportato da Goodreads.</p>
        <div class="field"><input id="i-file" type="file" accept=".csv,.json,text/csv,application/json" aria-label="File CSV o JSON"></div>
        <label class="check"><input type="checkbox" id="i-upd"> Aggiorna i libri già presenti con i dati del file (per ripristinare un backup)</label>
        <div class="actions"><button class="btn primary" id="i-go" disabled>Importa</button><button class="btn" id="i-seed">Carica i libri Goodreads</button></div>
      </section>
      <div class="status-line" id="i-status" aria-live="polite"></div>
      <div class="actions"><button class="btn ghost" id="i-close">Chiudi</button></div>`);
    const ul = $("#u-list", sheet); let snaps = [];
    const fillCopies = () => listSnapshots().then(l => { // richiamata dopo un import con la scheda aperta
      snaps = l;
      ul.innerHTML = l.length ? l.map(c => `<div class="urow"><span>${esc(c.label)}<small>${when(c.at)} · ${plural(c.count, "libro", "libri")}</small></span><button class="btn" type="button" data-restore="${c.id}">Ripristina</button></div>`).join("")
        + `<p class="hint" id="u-sync">Il ripristino vale anche sugli altri dispositivi collegati.</p>` : `<p class="hint">Nessuna copia per ora.</p>`;
    }, () => { if (ul.isConnected) ul.outerHTML = `<p class="hint" id="u-none">L'annullamento non è disponibile su questo dispositivo</p>`; });
    fillCopies();
    ul.onclick = e => { // conferma in due tocchi; il secondo dice quanti libri spariranno
      const b = e.target.closest("[data-restore]"); if (!b) return;
      if (b.classList.contains("danger")) {
        closeSheet();
        restoreSnapshot(Number(b.dataset.restore)).then(done => { if (!done) toast("Copia non trovata: ripristino non riuscito"); });
        return;
      }
      ul.querySelectorAll(".danger").forEach(x => { x.classList.remove("danger"); x.textContent = "Ripristina"; });
      const c = snaps.find(x => x.id === Number(b.dataset.restore)), keep = new Set(c ? c.ids : []);
      const n = c ? state.books.filter(x => !keep.has(x.id)).length : 0;
      b.classList.add("danger"); b.textContent = n ? `Conferma: toglie ${plural(n, "libro", "libri")}` : "Conferma ripristino";
    };
    let pending = [], counts = { fresh: 0, dup: 0 }, purchases = false, csv = false;
    const st = $("#i-status", sheet), go = $("#i-go", sheet), upd = $("#i-upd", sheet);
    const showCounts = () => {
      if (purchases) { // file di acquisti: nuovi in Da leggere, desideri spostati, il resto invariato
        const valid = pending.filter(b => b && b.title), found = b => state.books.find(x => samePurchase(x, b));
        const fresh = valid.filter(b => !found(b)).length, wish = valid.filter(b => found(b) && found(b).status === "desiderato").length;
        st.textContent = !valid.length ? "" : `Acquisti: ${fresh} nuovi in Da leggere, ${wish} spostati dalla lista dei desideri, ${valid.length - fresh - wish} già presenti (invariati).`;
        go.disabled = !(fresh || wish);
        return;
      }
      const { fresh, dup } = counts, u = upd.checked;
      st.textContent = !pending.length ? "" : (fresh || (u && dup))
        ? `Pronti: ${fresh} libri nuovi` + (dup ? (u ? `, ${dup} da aggiornare` : ` (${dup} già presenti, saltati)`) : "") + "."
        : "Nessun libro nuovo in questo file.";
      go.disabled = !(fresh || (u && dup));
    };
    upd.onchange = showCounts;
    $("#i-close", sheet).onclick = closeSheet;
    $("#i-seed", sheet).onclick = () => { closeSheet(); loadSeed(); };
    const ic = $("#i-covers", sheet); if (ic) ic.onclick = () => { closeSheet(); toast("Cerco le copertine…"); runCoverJob(); };
    $("#i-redo", sheet).onclick = () => { closeSheet(); toast("Rifaccio la ricerca delle copertine…"); runCoverJob(null, { redo: true }); };
    const iv = $("#i-verify", sheet), vs = $("#v-status", sheet);
    if (iv) iv.onclick = async () => {
      vs.textContent = "Verifico le ricerche…"; state.googleDown = null; // la verifica prova sempre Google, anche se prima era giù
      const out = [];
      try { const g = await googleSearch("isbn:9788804731481", { italian: false, max: 1 }); out.push(`Google Books: OK (${g.length} risultati)`); }
      catch (e) { out.push(`Google Books: ${e.code || "errore"}${e.msg ? " — " + e.msg : ""}`); }
      try { const o = await openLibrarySearch("isbn:9788804731481", "", 1); out.push(`Open Library: OK (${o.length} risultati)`); }
      catch (e) { out.push(`Open Library: ${e.code || "errore"}`); }
      vs.textContent = out.join(" · ");
    };
    const ia = $("#i-authors", sheet);
    if (ia) ia.onclick = () => {
      if (!navigator.onLine) { st.textContent = "Connettiti per completare autori e copertine."; return; }
      const ids = state.books.filter(b => !b.author || (!b.cover && !b.noCover)).map(b => b.id);
      closeSheet(); snapshot("Prima di «Completa autori e copertine»").then(() => enrichBooks(ids)); // in sottofondo: la scheda si chiude e l'app resta usabile
    };
    $("#i-export", sheet).onclick = () => state.books.length ? exportBackup(st) : (st.textContent = "La libreria è vuota: niente da esportare.");
    $("#i-file", sheet).onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const txt = String(rd.result);
          purchases = false; csv = false;
          if (/\.json$/i.test(f.name) || txt.trim().startsWith("{") || txt.trim().startsWith("[")) { const j = JSON.parse(txt); pending = Array.isArray(j) ? j : (j.books || []); purchases = !!(j && j.acquisti); }
          else { pending = fromGoodreads(txt); csv = true; }
          if (purchases) { showCounts(); return; }
          const known = new Set(state.books.map(keyOf));
          const valid = pending.filter(b => b && b.title);
          counts = { fresh: valid.filter(b => !known.has(keyOf(b))).length, dup: valid.filter(b => known.has(keyOf(b))).length };
          showCounts();
        } catch { pending = []; go.disabled = true; st.textContent = "File non leggibile. Usa un backup JSON o il CSV di Goodreads."; }
      };
      rd.readAsText(f);
    };
    let busy = false;
    go.onclick = async () => {
      if (busy) return; busy = go.disabled = true;
      await snapshot(purchases ? "Prima dell'import degli acquisti" : csv ? "Prima dell'import del CSV" : "Prima dell'import del backup");
      busy = false; // da qui in poi è tutto sincrono
      if (purchases) {
        const r = addPurchases(pending); pending = []; purchases = false; go.disabled = true;
        closeSheet();
        toast(`Acquisti importati: ${r.added} nuovi, ${r.moved} spostati in Da leggere.`);
        if (r.newIds.length && navigator.onLine) enrichBooks(r.newIds);
        else if (r.newIds.length) toast("Connettiti per completare autori e copertine: lo trovi in Backup.");
        return;
      }
      const { added, updated } = addMany(pending, { update: upd.checked }); pending = []; go.disabled = true;
      st.textContent = `Importati ${added} libri` + (updated ? `, aggiornati ${updated}` : "") + ".";
      fillCopies(); // la copia appena fatta compare in Annulla
    };
  }

  /* ---------- avvio ---------- */
  function swapIn() { const main = $("#main"); main.classList.remove("swap"); void main.offsetWidth; main.classList.add("swap"); }
  function setView(v) { state.view = v; resetLimits(); document.body.classList.remove("bars-off"); swapIn(); render(); window.scrollTo({ top: 0 }); }
  function searchFor(s) {
    $("#q").value = s; state.q = s; state.filter = "tutti"; resetLimits();
    if (state.view !== "libreria") setView("libreria"); else { render(); window.scrollTo({ top: 0 }); }
  }
  function goSearch() {
    if (state.view !== "libreria") setView("libreria");
    document.body.classList.remove("bars-off");
    $("#q").focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  $("#dock").addEventListener("click", e => {
    const t = e.target.closest(".tab"); if (!t) return;
    if (t.dataset.lp === "1") { t.dataset.lp = ""; return; }
    const a = t.dataset.act;
    if (a === "add") openAdd(); else if (a === "more") openMore(); else if (a === "search") goSearch();
    else if (t.dataset.view) setView(t.dataset.view);
  });
  document.addEventListener("click", e => {
    const f = e.target.closest && e.target.closest("[data-filter]");
    if (f) { state.filter = f.dataset.filter; resetLimits(); if (state.view !== "libreria") setView("libreria"); else { swapIn(); render(); } return; }
    const m = e.target.closest && e.target.closest(".viewsw [data-mode]");
    if (m && m.dataset.mode !== state.mode) { state.mode = m.dataset.mode; resetLimits(); setSet({ mode: state.mode }); swapIn(); render(); }
  });
  // Pressione prolungata su Aggiungi: apre subito la fotocamera per l'ISBN.
  (() => {
    const add = $("#dock .add"); let t = null;
    const cancel = () => { clearTimeout(t); t = null; };
    add.addEventListener("pointerdown", () => { cancel(); t = setTimeout(() => { add.dataset.lp = "1"; openAdd({ scan: true }); }, 480); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => add.addEventListener(ev, cancel));
    add.addEventListener("contextmenu", e => e.preventDefault());
  })();
  // Sul telefono le barre si nascondono scorrendo verso il basso e tornano scorrendo verso l'alto.
  let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY, d = y - lastY; if (Math.abs(d) < 8) return;
    const busy = !$("#sort-menu").hidden || document.activeElement === $("#q");
    document.body.classList.toggle("bars-off", d > 0 && y > 160 && !busy);
    lastY = y;
  }, { passive: true });
  let qt; $("#q").oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; resetLimits(); render(); }, 220); };
  // Menu "Ordina" personalizzato
  (() => {
    const dd = $("#sort-dd"), btn = $("#sort-btn"), menu = $("#sort-menu");
    const items = [...menu.querySelectorAll("[role=option]")];
    const open = v => {
      menu.hidden = !v; btn.setAttribute("aria-expanded", String(v)); dd.classList.toggle("open", v);
      if (v) (items.find(i => i.getAttribute("aria-selected") === "true") || items[0]).focus();
    };
    const show = it => { state.sort = it.dataset.v; $("#sort-label").textContent = it.dataset.short || it.textContent.trim(); items.forEach(i => i.setAttribute("aria-selected", String(i === it))); };
    const pick = it => { show(it); setSet({ sort: state.sort }); open(false); btn.focus(); resetLimits(); render(); };
    const saved = items.find(i => i.dataset.v === getSet().sort); if (saved) show(saved); // ordine ricordato sul dispositivo
    btn.onclick = () => open(menu.hidden);
    items.forEach((it, i) => {
      it.onclick = () => pick(it);
      it.onkeydown = e => {
        if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        if (e.key === "Escape") { open(false); btn.focus(); }
      };
    });
    document.addEventListener("pointerdown", e => { if (!menu.hidden && !dd.contains(e.target)) open(false); });
  })();

  // Scorciatoie da tastiera (su computer): / cerca, N nuovo libro, 1 e 2 per le sezioni
  document.addEventListener("keydown", e => {
    if ($("#scrim") || $("#story") || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === "/") { e.preventDefault(); goSearch(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); openAdd(); }
    else if (e.key === "1") setView("libreria");
    else if (e.key === "2") setView("stats");
  });

  // Anteprima al passaggio del mouse sui dorsi (solo dove c'è un mouse)
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const peek = document.createElement("div"); peek.className = "peek"; peek.setAttribute("aria-hidden", "true"); document.body.append(peek);
  let peekT = null;
  function showPeek(el) {
    const b = state.books.find(x => x.id === el.dataset.id); if (!b) return;
    const { pct, tot } = progressOf(b);
    peek.innerHTML = `${coverHTML(b, 160)}<div class="pk-body"><b>${esc(b.title)}</b><span>${esc(b.author || "Autore sconosciuto")}</span>
      <span class="pk-meta">${[b.year, b.pages ? b.pages + " pp." : "", b.genre].filter(Boolean).map(esc).join(" · ")}</span>
      ${b.rating ? `<span class="stars">${starStr(b.rating)}</span>` : ""}
      <span class="pk-st">${b.status === "in-lettura" && tot ? `In lettura · ${pct}%` : STATUS_ONE[b.status]}${b.finished && b.status === "letto" ? " · " + esc(fmtDate(b.finished)) : ""}</span></div>`;
    const r = el.getBoundingClientRect(), W = 280, H = peek.offsetHeight || 150, m = 10;
    let x = r.left + r.width / 2 - W / 2; x = Math.max(m, Math.min(innerWidth - W - m, x));
    let y = r.top - H - 12; const below = y < m; if (below) y = r.bottom + 12;
    peek.style.left = x + "px"; peek.style.top = y + "px"; peek.classList.toggle("below", below); peek.classList.add("on");
  }
  function hidePeek() { clearTimeout(peekT); peek.classList.remove("on"); }
  if (canHover) {
    document.addEventListener("mouseover", e => {
      const el = e.target.closest && e.target.closest("#main .spine[data-id]");
      if (!el) return;
      clearTimeout(peekT); peekT = setTimeout(() => showPeek(el), peek.classList.contains("on") ? 40 : 260);
    });
    document.addEventListener("mouseout", e => { const el = e.target.closest && e.target.closest("#main .spine[data-id]"); if (el && !el.contains(e.relatedTarget)) hidePeek(); });
    addEventListener("scroll", hidePeek, { passive: true });
    document.addEventListener("pointerdown", hidePeek);
  }

  const dock = $("#dock");
  const fitDock = () => document.documentElement.style.setProperty("--dock-h", dock.offsetHeight + "px");
  fitDock(); if ("ResizeObserver" in window) new ResizeObserver(fitDock).observe(dock);

  state.books = load();
  if (getSet().mode === "copertine") state.mode = "copertine";
  try {
    if (localStorage.getItem("libreria-schema") !== "2") {
      state.books.forEach(b => { if (!b.cover) delete b.noCover; });
      persist(); localStorage.setItem("libreria-schema", "2");
    }
  } catch {}
  render();
  // Carico il servizio in sottofondo solo se eri già connesso o se un link di accesso è appena tornato qui.
  try { if (cloudInfo().uid || /oobCode=/.test(location.search) || sessionStorage.getItem("libreria-auth-pending")) loadCloud().catch(() => {}); } catch {}
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then(reg => {
        // Avviso fisso in alto: resta finché non si aggiorna o si sceglie "Più tardi", così nessun altro messaggio lo copre.
        const offer = w => {
          if ($("#upd-bar")) return;
          const b = document.createElement("div"); b.id = "upd-bar"; b.className = "update-bar"; b.setAttribute("role", "alert");
          b.innerHTML = `<span>Nuova versione disponibile.</span><button type="button" data-u="go">Aggiorna</button><button type="button" data-u="later">Più tardi</button>`;
          b.onclick = e => {
            const u = e.target.dataset && e.target.dataset.u;
            if (u === "go") {
              navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
              w.postMessage("skip-waiting");
            } else if (u === "later") b.remove();
          };
          document.body.append(b);
        };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
        });
      }).catch(() => {});
      // Ricarico solo quando una versione nuova sostituisce quella vecchia, non alla primissima installazione.
      let reloaded = false; const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    });
  }
  window.libreriaSeries = Object.freeze({ sameTitle, seriesKey, findSeries });
})();
