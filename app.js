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
  const FIELDS = ["title", "author", "year", "pages", "genre", "status", "rating", "started", "finished", "finishedYear", "notes", "quote", "callNo", "synopsis", "color", "isbn", "cover", "noCover", "spine", "spineRatio", "page", "pageStep", "coverManual", "added", "updated", "spineAt", "series", "seriesNo", "seriesNext", "seriesManual", "finishedAuto"];
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
  const SER = ["series", "seriesNo", "seriesNext"], volNo = x => parseFloat(x.seriesNo);
  const seriesKey = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const serLabel = b => b.series ? b.series + (b.seriesNo ? " · " + b.seriesNo : "") : "";
  const serAria = b => b.seriesNo ? `, ${esc(b.series)} numero ${esc(b.seriesNo)}` : "";
  const snoHTML = b => b.seriesNo ? `<span class="sno${/\.|.../.test(b.seriesNo) ? " long" : ""}" aria-hidden="true">${esc(b.seriesNo)}</span>` : "";
  const surname3 = a => { const p = String(a || "").trim().split(/\s+/); return (p[p.length - 1] || "").replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 3).toUpperCase(); };

  function toast(msg, action, opts = {}) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
    const span = document.createElement("span"); span.textContent = msg; t.append(span);
    let ab;
    if (action) { ab = document.createElement("button"); ab.textContent = action.label; ab.onclick = () => { t.remove(); action.run(); }; t.append(ab); }
    document.body.append(t);
    if (ab && opts.focus) ab.focus();
    setTimeout(() => {
      if (ab && document.activeElement === ab) { // il focus non resta nel vuoto: torna all'hero o al filtro attivo
        const h = $("#hero");
        const to = (!h.hidden && $("button, [tabindex='0']", h)) || $('[data-filter][aria-checked="true"], [data-filter][aria-pressed="true"]');
        if (to) to.focus();
      }
      t.remove();
    }, action ? 10000 : 2800);
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
    if (out.finishedAuto !== true || !out.finished) delete out.finishedAuto; // fine messa dall'app (oggi o stima): la sostituisce la stima dall'inizio
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
    const keep = ["status", "title", "author", "rating", "finished", "started", "added", "genre", "page", "pages", ...(state.sort === "autore" ? ["series", "seriesNo"] : [])]; // la serie sposta il libro solo nell'ordine Autore
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
      const ae = document.activeElement, fk = ae && ae.closest && ae.closest("#hero") ? ["data-add", "data-repeat"].find(a => ae.hasAttribute(a)) : null;
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
  async function fetchInfo(b, errors = {}, rounds = 2) { // rounds: giri di Google per l'ISBN (2 in sottofondo, tutti da «Aggiorna informazioni»)
    const isbn = String(b.isbn || "").replace(/[^\dXx]/g, "");
    const byIsbn = isbn ? await settle([
      () => googleSearch("isbn:" + isbn, { italian: false, max: 3, rounds }).then(tag("Google Books")),
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
  // Riempie i campi vuoti con quanto trovato da fetchInfo; il dorso o la copertina compaiono subito.
  function fillInfo(b, hit) {
    if (!b.author && hit.author) b.author = hit.author;
    if (!b.year && hit.edYear) b.year = hit.edYear;
    if (!b.pages && hit.pages) b.pages = hit.pages;
    if (!b.genre && hit.genre) b.genre = hit.genre;
    if (!b.synopsis && hit.synopsis) b.synopsis = hit.synopsis;
    if (!b.isbn && hit.isbn) b.isbn = hit.isbn;
    if (!b.callNo && b.author) b.callNo = surname3(b.author);
    if (!b.cover && !b.noCover && hit.cover) b.cover = hit.cover;
    b.updated = Date.now(); cloudHook("changed", b.id); patchBook(b.id);
  }
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
        if (hit && (hit.author || hit.cover)) { fillInfo(b, hit); fixed++; } else {
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
    toast(`Informazioni aggiornate per ${fixed} libri su ${ids.length}.` + (missed ? ` Non trovati: ${missed}${err ? " (" + err + ")" : ""}.` : "") + (wdOff ? " Serie non cercate: Wikidata non risponde." : ""));
  }

  // «Cerca le serie»: un libro alla volta; un errore di Wikidata si conta e il giro prosegue.
  async function seriesJob() {
    if (enrich.busy) { toast("Aggiornamento già in corso."); return; }
    const ids = state.books.filter(b => b.title && (b.series ? b.status === "letto" && !b.seriesNext : !b.seriesManual)).map(b => b.id);
    if (!ids.length) { toast("Nessun libro da cercare."); return; }
    const gen = dataGen, line = $("#enrich"), cache = new Map(); let found = 0, bad = 0, down = 0; // down: errori 429/503 di fila
    enrich.busy = true;
    await snapshot("Prima di «Cerca le serie»");
    if (gen !== dataGen) return; // copia ripristinata durante la copia
    for (let k = 0; k < ids.length; k++) {
      if (line) { line.hidden = false; line.textContent = `Ricerca delle serie: ${k + 1} di ${ids.length} · tieni l'app aperta`; }
      const b = state.books.find(x => x.id === ids[k]);
      let err = false;
      const r = b && await findSeries(b, cache).catch(e => { bad++; err = /wikidata-(429|503)/.test(e && e.code); return null; });
      if (gen !== dataGen) return; // copia ripristinata nel frattempo
      down = err ? down + 1 : 0;
      if (down >= 2) break; // Wikidata giù: inutile insistere
      const cur = r && state.books.find(x => x.id === ids[k]);
      if (cur && applySeriesTo(cur, r, true)) found++;
      await sleep(300);
      if (gen !== dataGen) return;
    }
    enrich.busy = false;
    if (line) line.hidden = true;
    if (found) render(); else renderTally(); // un solo ridisegno: l'ordine Autore può cambiare
    const msg = `Serie trovate per ${found} libri su ${ids.length}.`;
    toast(down >= 2 ? `Wikidata non risponde: ricerca interrotta, riprova più tardi. ${msg}` : msg + (bad ? ` Wikidata non risponde ×${bad}.` : ""));
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
  async function googleSearch(q, { italian = true, max = 12, rounds, onTry } = {}) {
    if (/^isbn:/.test(q)) return googleIsbn(q.slice(5), { max, rounds, onTry });
    if (state.googleDown && Date.now() < state.googleDown.until) throw { code: "google-" + state.googleDown.code };
    const url = "https://www.googleapis.com/books/v1/volumes?key=" + GBOOKS_KEY + "&printType=books&maxResults=" + max +
      (italian ? "&langRestrict=it" : "") + "&q=" + encodeURIComponent(q);
    let r;
    try { r = await fetchT(url); } catch { throw { code: "google-rete" }; }
    let retried = false;
    // 503 passeggero: riprovo con la chiave dopo una pausa, poi senza (la quota senza chiave è comune a tutti e quasi sempre finita)
    for (const u of [url, url.replace("key=" + GBOOKS_KEY + "&", "")]) {
      if (r.status !== 503) break;
      retried = true; await sleep(1200);
      try { r = await fetchT(u); } catch { throw { code: "google-rete" }; }
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
  // ISBN su Google: per lo stesso ISBN Google risponde a caso con il libro, con «0 risultati» o con un 503 (misurato
  // sull'iPhone di Diego). Quindi giri di tre richieste in parallelo (ISBN-13, ISBN-10, ISBN-13), distanziati sempre di più
  // (i disturbi di Google durano qualche secondo), fino a `rounds` giri: vince la prima con risultati; 0, 503 e il limite
  // al minuto si ritentano; quota del giorno o chiave rifiutata fermano tutto come nelle altre ricerche.
  // Ogni richiesta ha un quotaUser diverso (parametro standard di Google): l'indirizzo cambia e nessuna cache ripete lo «0».
  const ISBN_WAIT = [0, 800, 1500, 2500, 4000];
  async function googleIsbn(i, { max = 12, rounds = ISBN_WAIT.length, onTry } = {}) { // rounds: 2 nei completamenti in sottofondo (meno richieste)
    if (state.googleDown && Date.now() < state.googleDown.until) throw { code: "google-" + state.googleDown.code };
    const alt = i.length === 13 ? isbn10From13(i) : isbn13From10(i), forms = [i, alt || i, i];
    const url = f => "https://www.googleapis.com/books/v1/volumes?key=" + GBOOKS_KEY + "&printType=books&maxResults=" + max +
      "&quotaUser=ml" + Math.random().toString(36).slice(2, 10) + "&q=" + encodeURIComponent("isbn:" + f);
    const one = f => fetchT(url(f), { cache: "no-store" }).then(async r => {
      if (r.ok) return { r, j: await r.json().catch(() => null) };
      return { r, msg: r.status === 429 || r.status === 403 ? await googleMsg(r) : "" };
    }, () => ({}));
    let answered = false, lastBad = null;
    for (let k = 0; k < rounds; k++) {
      if (k) { if (onTry) onTry(k + 1, rounds); await sleep(ISBN_WAIT[k] || 4000); }
      const res = await Promise.all(forms.map(one));
      const hit = res.find(x => x.j && (x.j.items || []).length);
      if (hit) return hit.j.items.map(normVolume).filter(x => x.title);
      const stop = res.find(x => x.r && (x.r.status === 403 || (x.r.status === 429 && !/minute/i.test(x.msg))));
      if (stop) { state.googleDown = { code: stop.r.status, until: Date.now() + 864e5 }; throw { code: "google-" + stop.r.status, msg: stop.msg }; }
      if (res.some(x => x.j)) answered = true;
      lastBad = res.find(x => x.r && !x.r.ok) || lastBad;
    }
    if (answered) return []; // Google ha risposto (anche solo una volta) senza il libro
    if (lastBad && (lastBad.r.status === 503 || lastBad.r.status === 429)) { state.googleDown = { code: lastBad.r.status, until: Date.now() + 5 * 60e3 }; throw { code: "google-" + lastBad.r.status }; }
    throw { code: lastBad ? "google-" + lastBad.r.status : "google-rete" };
  }

  // --- fonte 2: Apple Books (negozio italiano, via JSONP) ---
  let jsonpN = 0;
  // Ogni richiesta ha un tempo massimo: su iPhone una risposta può non arrivare mai (cambio di rete, app in pausa).
  function fetchT(url, opts = {}) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), window.libreriaNetMs || 20000);
    return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
  }
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
    const isbn = parseIsbn(term); // per un ISBN c'è la ricerca apposita (lookup), più precisa del testo libero
    const j = await jsonp(isbn ? "https://itunes.apple.com/lookup?country=it&isbn=" + (isbn.length === 10 ? isbn13From10(isbn) : isbn)
      : "https://itunes.apple.com/search?media=ebook&entity=ebook&country=it&lang=it_it&limit=" + max + "&term=" + encodeURIComponent(term));
    return (j.results || []).map(r => ({
      title: r.trackName || "", author: r.artistName || "",
      edYear: yearOf(r.releaseDate || ""), pages: undefined,
      genre: (r.genres || []).find(g => !/^(Libri|Books)$/i.test(g)) || "",
      synopsis: String(r.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
      isbn: isbn || "", lang: "", ita: true,
      cover: r.artworkUrl100 ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x900bb.") : ""
    })).filter(x => x.title);
  }

  // --- fonte 3: Open Library ---
  async function openLibrarySearch(title, author, max = 8) {
    const byIsbn = /^isbn:/.test(title);
    const url = "https://openlibrary.org/search.json?limit=" + max + "&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,language" +
      (byIsbn ? "&isbn=" + encodeURIComponent(title.slice(5)) : "&title=" + encodeURIComponent(title) + (author ? "&author=" + encodeURIComponent(author) : ""));
    let r;
    try { r = await fetchT(url); } catch { throw { code: "openlibrary-rete" }; }
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
    try { r = await fetchT(url, { headers: { Accept: "application/sparql-results+json, application/json" } }); } catch { throw { code: "wikidata-rete" }; }
    if (!r.ok) throw { code: "wikidata-" + r.status };
    return r.json();
  }
  const wdSparql = q => wdGet("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q)).then(j => j.results.bindings || []);
  const wv = x => x && !/^Q\d+$/.test(x.value) ? x.value : undefined; // niente codici Q
  // Serie in due passi (una sola interrogazione con etichette e GROUP BY va oltre i 30 s di Wikidata):
  // C1 = opere e dichiarazioni di serie (ordine dei join fissato), C2 = etichette degli elementi trovati.
  const WDL = `"it","en","mul","fr","de","es","pt","nl","sv","da","nb","fi","pl","cs"`;
  const qid = x => { const m = x && /\/(Q\d+)$/.exec(x.value); return m ? m[1] : ""; };
  const wdSer = `?st a wikibase:BestRank. ?st ps:P179 ?ser.
OPTIONAL { ?st pq:P1545 ?no } OPTIONAL { ?st pq:P156 ?nx } OPTIONAL { ?work wdt:P1545 ?n2 } OPTIONAL { ?work wdt:P156 ?x2 }`;
  // Etichette (tutte le lingue di WDL) per gli elementi: Map Q → [[testo, lingua], ...].
  async function wdLabels(ids) {
    const m = new Map();
    for (let i = 0; i < ids.length; i += 300) {
      for (const r of await wdSparql(`SELECT ?x ?nm (LANG(?nm) AS ?lg) WHERE { VALUES ?x { ${ids.slice(i, i + 300).map(x => "wd:" + x).join(" ")} } { ?x rdfs:label ?nm } UNION { ?x skos:altLabel ?nm } FILTER(LANG(?nm) IN (${WDL})) }`)) {
        const k = qid(r.x), v = r.nm && r.nm.value; if (!k || !v) continue;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push([v, (r.lg && r.lg.value) || r.nm["xml:lang"] || ""]);
      }
    }
    return m;
  }
  // Righe di C1 → opere { id, ed, names, series, no, it }, una per (opera, dichiarazione); names: con le etichette delle opere.
  async function wdWorks(q, names) {
    const by = new Map();
    for (const r of await wdSparql(q)) {
      const k = r.work.value + " " + (r.st ? r.st.value : ""), o = by.get(k), no = wv(r.no) || wv(r.n2);
      if (!o || (!o.no && no)) by.set(k, { id: r.work.value, ed: r.ed && r.ed.value, w: qid(r.work), ser: qid(r.ser), no, nx: qid(r.nx) || qid(r.x2) });
    }
    const ws = [...by.values()];
    if (!ws.length) return [];
    const ids = [...new Set(ws.flatMap(w => [names ? w.w : "", w.ser, w.nx]).filter(Boolean))];
    const L = ids.length ? await wdLabels(ids) : new Map(), lab = (k, ...lg) => { const l = L.get(k) || []; for (const g of lg) { const x = l.find(y => y[1] === g); if (x) return x[0]; } };
    return ws.map(w => ({ id: w.id, ed: w.ed, names: names ? [...new Set((L.get(w.w) || []).map(x => x[0]))] : [], series: w.ser ? lab(w.ser, "it", "en", "mul") : undefined, serNames: w.ser ? [...new Set((L.get(w.ser) || []).map(x => x[0]))] : [], no: w.no, it: w.nx ? lab(w.nx, "it") : undefined }));
  }
  const isbnWorks = isbn => wdWorks(`SELECT ?ed ?work ?st ?ser ?no ?nx ?n2 ?x2 WHERE { hint:Query hint:optimizer "None".
${wdIsbn(isbn)} OPTIONAL { ?ed wdt:P629 ?w0 } BIND(COALESCE(?w0, ?ed) AS ?work) FILTER NOT EXISTS { ?work wdt:P629 ?e0 }
OPTIONAL { ?work p:P179 ?st. ${wdSer} } } LIMIT 500`, false);
  // Una sola opera: 0 = nessuna, null = più d'una; t = null: senza titolo (ISBN); ser: serie già del libro (preferita).
  const pickWork = (ws, t, ser) => {
    if (t !== null && !String(t || "").trim()) return 0;
    let h = ws.filter(w => w.series && (t === null || w.names.some(n => sameTitle(n, t))));
    const ex = t === null ? [] : h.filter(w => w.names.some(n => titleCore(n) === titleCore(t)));
    if (ex.length) h = ex;
    const same = h.filter(w => ser && seriesKey(w.series) === seriesKey(ser));
    if (same.length) h = same;
    return new Set(h.map(w => w.id)).size > 1 ? null : h.find(w => w.no) || h[0] || 0;
  };
  async function authorWorks(a, cache) {
    const k = seriesKey(a);
    if (!cache.has(k)) {
      const url = "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=it&uselang=it&type=item&limit=7&origin=*&search=" + encodeURIComponent(a);
      const qs = j => (j.search || []).map(x => x.id).filter(x => /^Q\d+$/.test(x)).slice(0, 3);
      let ids = qs(await wdGet(url));
      if (!ids.length) { await sleep(1500); ids = qs(await wdGet(url)); } // a volte Wikidata rifiuta per un momento: riprovo una volta
      cache.set(k, ids.length ? await wdWorks(`SELECT ?work ?st ?ser ?no ?nx ?n2 ?x2 WHERE { hint:Query hint:optimizer "None".
VALUES ?a { ${ids.map(x => "wd:" + x).join(" ")} } ?work wdt:P50 ?a. ?work p:P179 ?st. ${wdSer}
FILTER NOT EXISTS { ?work wdt:P629 ?e0 } } LIMIT 500`, true) : []);
    }
    return cache.get(k);
  }
  // Titolo originale (Open Library).
  async function olTitle(isbn) {
    try {
      const j = await (await fetchT("https://openlibrary.org/isbn/" + isbn + ".json")).json(), k = j.works && j.works[0] && j.works[0].key;
      return String(j.translation_of || (/^\/works\/OL\d+W$/.test(k) && (await (await fetchT("https://openlibrary.org" + k + ".json")).json()).title) || "");
    } catch { return ""; }
  }
  // Titoli originali dalla ricerca di Open Library per titolo e autore (solo risultati dello stesso autore).
  async function olTitles(t, a) {
    try {
      const j = await (await fetchT("https://openlibrary.org/search.json?limit=3&fields=title,author_name&q=" + encodeURIComponent(t + " " + a))).json(), sn = titleCore(a.split(/\s+/).pop());
      return [...new Set((j.docs || []).filter(d => (d.author_name || []).some(n => titleCore(n).includes(sn))).map(d => String(d.title || "")).filter(x => x && !sameTitle(x, t)))];
    } catch { return []; }
  }
  // Seguito solo con un'edizione italiana.
  async function itEdition(t, a) {
    for (const f of [() => appleSearch(t + " " + a, 5), () => googleSearch(t + " " + a, { max: 5 })]) {
      try { if ((await f()).some(x => sameTitle(x.title, t) && sameAuthor(a, x.author || ""))) return true; } catch {}
    }
    return false;
  }
  // Serie: 1) ISBN, 2) autore, 3) titolo originale.
  async function findSeries(b, cache = new Map()) {
    const isbn = parseIsbn(b.isbn), a = String(b.author || "").split(",")[0].trim();
    let w = 0;
    if (isbn) {
      const ws = await isbnWorks(isbn);
      if (ws.length && !ws.some(x => x.series) && ws.some(x => x.ed && x.ed !== x.id)) return null; // l'ISBN porta a un'opera senza serie
      w = pickWork(ws, null, b.series);
    }
    if (w === 0 && a && b.title) {
      const ws = await authorWorks(a, cache);
      w = pickWork(ws, b.title, b.series);
      if (w === 0 && isbn && ws.length) { const t = await olTitle(isbn); if (t) w = pickWork(ws, t, b.series); }
      if (w === 0 && ws.length) for (const t of await olTitles(b.title, a)) { w = pickWork(ws, t, b.series); if (w !== 0) break; } // senza ISBN (libri Goodreads)
    }
    if (!w) return null;
    const r = { series: w.series };
    if (w.serNames && w.serNames.length) r.names = w.serNames; // la serie in tutte le lingue: per riconoscere il nome già usato in libreria
    if (w.no) r.no = w.no;
    if (w.it && await itEdition(w.it, a)) r.next = w.it;
    return r;
  }
  // Copia con la serie trovata, rispettando seriesManual; onlyNext: solo il seguito (libro che ha già la serie).
  function applySeries(b, r, onlyNext) {
    const o = { ...b }, s = r.series ? seriesName(r.series, r.names || []) : "";
    if (!onlyNext && !b.seriesManual && s) {
      if (seriesKey(s) !== seriesKey(b.series)) { delete o.seriesNo; delete o.seriesNext; }
      o.series = s; if (r.no) o.seriesNo = r.no;
    }
    if (r.next && s && seriesKey(o.series) === seriesKey(s)) o.seriesNext = r.next;
    return o;
  }
  // Salva la serie trovata (upsert: un solo salvataggio e un solo cloudHook); true se è cambiato qualcosa.
  function applySeriesTo(b, r, quiet) { // quiet: niente ridisegno completo, lo fa chi chiama alla fine
    const nb = clean(applySeries(b, r, !!b.series)), ob = clean(b); // confronto dopo clean(): un numero che clean() toglie non è un cambio
    if (!SER.some(k => nb[k] !== ob[k])) return false;
    if (!quiet) { upsert({ ...nb, id: b.id }); return true; }
    state.books[state.books.indexOf(b)] = { ...nb, id: b.id, updated: Date.now() };
    schedulePersist(); patchBook(b.id); cloudHook("changed", b.id); return true;
  }
  // Nuovo libro: serie in sottofondo.
  function seriesLater(id) {
    const b = state.books.find(x => x.id === id);
    if (b && navigator.onLine) findSeries(b).then(r => {
      const cur = state.books.find(x => x.id === id);
      if (!r || !cur) return;
      const had = !!cur.series; // se trovata adesso, lo dico (il nome è quello già usato in libreria, se c'è)
      const nb = applySeriesTo(cur, r) && !had && state.books.find(x => x.id === id);
      if (nb && nb.series) toast(`«${nb.title}»: serie ${nb.series}${nb.seriesNo ? " · " + nb.seriesNo : ""}`);
    }).catch(() => {});
  }
  async function searchBooks(q, { onTry } = {}) { // onTry(n, tot): Google sta ritentando un ISBN (per la riga di stato)
    const errors = []; let out = [];
    const isbn = parseIsbn(q);
    const google = async () => {
      if (isbn) return googleSearch("isbn:" + isbn, { italian: false, onTry }); // un ISBN identifica già l'edizione
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
    const no = x => x.seriesNo ? volNo(x) : 1e9;
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
  function spineHTML(b, tag = "button", dim) { // dim: { w (%), h (px) } per le mensole delle Statistiche
    const p = Math.min(Number(b.pages) || 280, 900);
    const h = dim ? dim.h : Math.round(132 + p / 900 * 72);
    let w = dim ? dim.w : Math.round(26 + p / 900 * 24) + "px";
    const attrs = tag === "button" ? `data-id="${esc(b.id)}" aria-label="${esc(b.title)}${dim ? ", " : " di "}${esc(b.author || "")}${serAria(b)}${!dim && needsDates(b) ? ", " + STALE : ""}"` : `aria-hidden="true"`;
    const stale = !dim && tag === "button" && needsDates(b), sno = snoHTML(b), bd = (stale ? badgeHTML(b) : "") + sno, ser = sno ? " ser" : "";
    const last = String(b.author || "").trim().split(/\s+/).pop() || "";
    if (b.spine) {
      if (b.spineRatio && !dim) w = Math.max(16, Math.min(80, Math.round(h * b.spineRatio))) + "px";
      return `<${tag} class="spine photo${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w};background-image:url('${b.spine}')"><span class="gloss"></span>${bd}</${tag}>`;
    }
    const text = `<span class="t">${esc(b.title)}</span><span class="au">${esc(last)}</span>`;
    if (b.cover) {
      return `<${tag} class="spine fromcover${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w};background:${colorOf(b)}">
        <img src="${esc(thumb(b.cover, 120))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('fromcover');this.remove()"><span class="shade"></span>${text}${bd}</${tag}>`;
    }
    return `<${tag} class="spine${ser}${stale ? " stale" : ""}" ${attrs} style="--h:${h}px;height:${h}px;width:${w};background:${colorOf(b)}">
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
  const nx = { ex: [], list: [], off: false, sel: null };
  function nextList(more) {
    if (more) { nx.ex.push(...nx.list.map(x => x.book.id)); nx.sel = null; }
    const pile = state.books.filter(b => b.status === "da-leggere");
    if (more || !nx.list.length || nx.list.some(x => !pile.some(b => b.id === x.book.id))) {
      nx.list = nextBooks(state.books, nx.ex);
      if (!nx.list.length) { nx.ex = []; nx.list = nextBooks(state.books); }
    }
    return nx.list = nx.list.map(x => ({ ...x, book: pile.find(b => b.id === x.book.id) || x.book })); // dati aggiornati (titolo, copertina…)
  }
  const tabLabel = (list, i) => { const k = list[i].kind; return k === "affine" ? "Affine" : k === "vecchio" ? "Il più vecchio" : list.slice(0, i).some(x => x.kind === "caso") ? "Ancora a caso" : "A caso"; };
  function nextHTML(list, h = "h3", sel = null) {
    const hero = h === "h3", px = hero ? "nh-" : "ns-", n = list.length;
    if (hero && sel === null) sel = nx.sel;
    const more = state.books.filter(b => b.status === "da-leggere").length > n, at = Math.max(0, list.findIndex(x => x.book.id === sel));
    const tabs = n < 2 ? "" : `<div class="ntabs" role="tablist" aria-label="Criteri della proposta" style="--nt:${n}">${list.map(({ book: b }, i) => `<button class="ntab" type="button" role="tab" id="${px}t${i}" aria-controls="${px}p${i}" aria-selected="${i === at}" tabindex="${i === at ? 0 : -1}" data-tab="${esc(b.id)}">${tabLabel(list, i)}</button>`).join("")}</div>`;
    const cards = list.map(({ book: b, reason }, i) => `<div class="ncard" data-next="${esc(b.id)}" ${n < 2 ? 'role="region" aria-label="Proposta"' : `role="tabpanel" id="${px}p${i}" aria-labelledby="${px}t${i}" tabindex="0"`}${i === at ? "" : " hidden"}>
        <div class="nhead"><span class="call">${b.callNo ? `<span class="sr">Segnatura </span>${esc(b.callNo)}` : ""}</span>${n < 2 ? "" : `<span class="n" aria-hidden="true">${i + 1} di ${n}</span>`}</div>
        <div class="nbody"><div><b>${esc(b.title)}</b>${b.author ? `<span class="au">${esc(b.author)}</span>` : ""}</div>${coverHTML(b, 120)}<span class="why">${esc(reason)}</span>${(m => m ? `<span class="meta">${esc(m)}</span>` : "")([serLabel(b), b.pages && b.pages + " pagine", b.genre].filter(Boolean).join(" · "))}</div>
        <span class="hole" aria-hidden="true"></span></div>`).join("");
    const cur = list[at].book;
    return `<section class="next"><${h}>Cosa leggo adesso?</${h}><div class="drawer${n > 1 ? " many" : ""}">${tabs}<div class="nstack">${cards}</div></div>
      <div class="nfoot"><button class="btn primary" type="button" data-start="${esc(cur.id)}" aria-label="Inizia ${esc(cur.title)}">Inizia</button>${more ? `<button class="btn" type="button" data-n="more"${hero ? ' id="n-more"' : ""}>Altre proposte</button>` : "<span></span>"}<button class="btn ghost" type="button" data-n="later"${hero ? ' id="n-later"' : ""}>${hero ? "Non ora" : "Chiudi"}</button></div></section>`;
  }
  function announce(text) {
    let l = $("#n-live"); if (!l) { l = document.createElement("div"); l.id = "n-live"; l.className = "sr"; l.setAttribute("aria-live", "polite"); document.body.append(l); }
    l.textContent = text;
  }
  const flipCard = c => { if (!c) return; c.classList.remove("flip"); void c.offsetWidth; c.classList.add("flip"); };
  function wireNext(root, sheet) {
    const tabs = [...root.querySelectorAll(".ntab")], cards = [...root.querySelectorAll(".ncard")], start = $("[data-start]", root);
    let cur = Math.max(0, tabs.findIndex(t => t.getAttribute("aria-selected") === "true"));
    const pick = (id, anim) => {
      cur = Math.max(0, cards.findIndex(c => c.dataset.next === id));
      cards.forEach((c, i) => c.hidden = i !== cur);
      tabs.forEach((t, i) => { t.setAttribute("aria-selected", i === cur); t.tabIndex = i === cur ? 0 : -1; });
      start.dataset.start = id; start.setAttribute("aria-label", "Inizia " + $("b", cards[cur]).textContent);
      if (!sheet) nx.sel = id;
      if (anim) flipCard(cards[cur]);
    };
    const go = (i, focus) => { i = (i + tabs.length) % tabs.length; pick(tabs[i].dataset.tab, true); if (focus) tabs[i].focus(); };
    tabs.forEach(t => t.onclick = () => pick(t.dataset.tab, true));
    const tl = $("[role=tablist]", root);
    if (tl) tl.onkeydown = e => {
      const i = tabs.indexOf(document.activeElement), to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i < 0 || to === undefined) return;
      e.preventDefault(); go(to, true);
    };
    const stack = $(".nstack", root);
    if (stack && tabs.length > 1) {
      let g = null;
      stack.addEventListener("pointerdown", e => {
        if (g || e.pointerType === "mouse" || e.clientX < 24 || e.clientX > innerWidth - 24) { if (g) g = null; return; } // un secondo dito annulla il gesto
        g = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }, { passive: true });
      stack.addEventListener("pointercancel", () => { g = null; }, { passive: true });
      stack.addEventListener("pointerup", e => {
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y; g = null;
        if (Math.abs(dx) >= 48 && Math.abs(dx) >= 2 * Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
    start.onclick = () => startNext(start.dataset.start, sheet);
    const m = $("[data-n=more]", root);
    if (m) m.onclick = () => {
      nextList(true); if (sheet) fillNext(root); else renderHero();
      flipCard($(".ncard", root)); announce("Nuove proposte: " + nx.list.map(x => x.book.title).join(", "));
      const n = $("[data-n=more]", root); if (n) n.focus();
    };
    $("[data-n=later]", root).onclick = () => {
      if (sheet) { closeSheet(); return; }
      nx.off = true; renderHero();
      toast("Proposte nascoste", { label: "Annulla", run: () => { nx.off = false; renderHero(); const f = $("#hero [role=tab][aria-selected=true]") || $("#hero [data-start]"); if (f) f.focus(); } }, { focus: true });
    };
  }
  function fillNext(sheet) { sheet.innerHTML = nextHTML(nextList(), "h2"); wireNext(sheet, true); }
  // «Inizia» con Annulla: rimette i campi di lettura com'erano prima (assenti restano assenti).
  const NX_FIELDS = ["status", "started", "finished", "finishedYear", "finishedAuto", "page", "pageStep"];
  function startNext(id, sheet) {
    const b = state.books.find(x => x.id === id), before = {};
    if (sheet) closeSheet();
    if (!b || b.status !== "da-leggere") { renderHero(); return; }
    NX_FIELDS.forEach(f => { if (f in b) before[f] = b[f]; });
    setStatus(b, "in-lettura");
    const short = b.title.length > 40 ? b.title.slice(0, 40) + "…" : b.title;
    toast("In lettura: «" + short + "»", { label: "Annulla", run: () => {
      const k = state.books.findIndex(x => x.id === id), cur = state.books[k];
      if (!cur || cur.status !== "in-lettura") { toast("Non annullato: «" + short + "» è cambiato nel frattempo"); return; }
      const nb = { ...cur }; NX_FIELDS.forEach(f => delete nb[f]);
      state.books[k] = { ...clean({ ...nb, ...before }), id, updated: Date.now() };
      schedulePersist(); cloudHook("changed", id); nx.sel = id;
      refreshChanged([{ id, from: "in-lettura", to: "da-leggere", moved: true }]);
      const f = $("#hero [role=tab][aria-selected=true]") || $("#hero [data-start]"); if (f) f.focus();
    } }, { focus: true });
  }
  // Pagina rapida sotto la barra: cursore (solo con pagine totali), +10 e «+N» (ultimo salto scritto a mano).
  function pquickHTML(b) {
    const id = esc(b.id), t = esc(b.title), step = Number(b.pageStep) || 0;
    return `<span class="pquick"><button class="btn" type="button" data-add="10" data-id-add="${id}" aria-label="Aggiungi 10 pagine a ${t}">+10</button>${step ? `<button class="btn" type="button" data-repeat="${id}" aria-label="Aggiungi ${step} pagine a ${t}">+${step}</button>` : ""}</span>`;
  }
  // Libro in lettura in primo piano: copertina (apre la scheda), titolo, serie e autore; sotto, a tutta larghezza, cursore e pagina (si salvano da soli).
  function readingCards(books) {
    if (!books.length) return "";
    return `<div class="reading">${books.map(b => {
      const { tot, pg, pct } = progressOf(b);
      return `<article class="rcard">
        <button class="rcover" data-id="${esc(b.id)}" aria-label="Apri ${esc(b.title)}">${coverHTML(b)}</button>
        <div class="rbody">
          <span class="rlabel">In lettura adesso</span>
          <h3>${esc(b.title)}</h3><p class="rmeta">${b.series ? `<b>${esc(serLabel(b))}</b>${b.author ? " · " : ""}` : ""}${esc(b.author || "")}</p>
        </div>
        <div class="rctl">
          ${tot ? `<input type="range" min="0" max="${tot}" value="${Math.min(pg, tot)}" style="--pct:${100 * Math.min(pg, tot) / tot}%" data-range="${esc(b.id)}" aria-label="Avanzamento di ${esc(b.title)}" aria-valuetext="pagina ${Math.min(pg, tot)} di ${tot}">` : ""}
          <div class="prow">
            <label class="pin">pag. <input type="number" inputmode="numeric" min="0" ${tot ? `max="${tot}"` : ""} value="${pg || ""}" placeholder="0" data-page="${esc(b.id)}" aria-label="Pagina attuale di ${esc(b.title)}"></label>
            <span class="hint">${tot ? `di ${tot} · ${pct}%` : "pagine totali non note"}</span>
            ${pquickHTML(b)}
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
    if (st === "letto" && b.status !== "letto" && !nb.finished && !nb.finishedYear) { nb.finished = today(); nb.finishedAuto = true; }
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
      authors: groups(read, "author").map(g => ({ name: g.name, count: g.xs.length, pages: sum(g.xs), avgRating: avg(g.xs), books: g.xs.slice().sort(recent).map(x => x.b) }))
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
  // Misure di un dorso sulla mensola: unità (larghezza relativa), larghezza in % della fila, altezza in px.
  function statDim(b) {
    const p = Number(b.pages) || 0, u = p > 0 ? Math.min(44, Math.max(20, Math.round(p / 14))) : 20;
    return { u, w: (u / 3.4).toFixed(2) + "%", h: p > 0 ? Math.round(84 + Math.min(p, 900) / 900 * 32) : 92 };
  }
  // Divide i libri in file da al più 300 unità (mai file vuote).
  function ysRows(list) {
    const rows = []; let cur = [], tot = 0;
    list.forEach(b => { const u = statDim(b).u; if (cur.length && tot + u > 300) { rows.push(cur); cur = []; tot = 0; } cur.push(b); tot += u; });
    if (cur.length) rows.push(cur);
    return rows;
  }
  window.libreriaStats = Object.freeze({ compute: computeStats, dim: statDim, rows: ysRows });

  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const num = n => Number(n).toLocaleString("it-IT");
  // Prossimo volume dopo b (pura): il primo non letto, o il seguito confermato se manca; after = volume precedente.
  function nextInSeries(b, books) {
    const no = volNo, n = no(b), key = seriesKey(b.series);
    if (!key || isNaN(n)) return null;
    const vols = books.filter(x => seriesKey(x.series) === key && no(x) >= n).sort((x, y) => no(x) - no(y));
    const nx = vols.find(x => no(x) > n && x.status !== "letto"), i = nx ? vols.indexOf(nx) : vols.length;
    const top = vols[i - 1] || b, t = no(top); // ultimo prima di nx (o il più alto)
    if (nx && no(nx) - t <= 1) return { book: nx, after: top }; // nessun buco
    if (top.seriesNext && !books.some(x => sameTitle(x.title, top.seriesNext))) return { title: top.seriesNext, after: top, ...(Number.isInteger(t) ? { no: String(t + 1) } : {}) };
    return nx ? { book: nx, after: top } : null;
  }
  // Il prossimo libro: fino a tre proposte dalla pila (affine all'ultimo letto, la più vecchia, a caso). Funzione pura.
  function nextBooks(books, exclude = [], rnd = Math.random) {
    const add = b => { const n = Number(b.added); return isFinite(n) && n > 0 ? n : 0; };
    const pile = books.filter(b => b.status === "da-leggere" && !exclude.includes(b.id)).sort((a, b) => add(a) - add(b));
    const out = [], take = (b, kind, reason) => { out.push({ book: b, kind, reason }); pile.splice(pile.indexOf(b), 1); };
    const k = (b, f) => String(b[f] || "").trim().toLowerCase(); // mai abbinare valori vuoti
    const last = books.filter(b => b.status === "letto").sort((a, b) => String(b.finished || "").localeCompare(String(a.finished || "")) || (b.updated || 0) - (a.updated || 0)).slice(0, 3);
    const gap = []; // serie con un volume mancante: i successivi non sono «affini»
    for (const r of last) { // prima il seguito di una serie (anche solo per titolo)
      const s = nextInSeries(r, books), nb = s ? s.book : r.seriesNext && pile.find(b => sameTitle(b.title, r.seriesNext));
      if (s && (s.title || !pile.includes(s.book))) gap.push(b => seriesKey(b.series) === seriesKey(r.series) && volNo(b) > volNo(s.after));
      if (nb && pile.includes(nb)) { take(nb, "affine", s ? `Il #${nb.seriesNo} di ${r.series}, dopo il #${s.after.seriesNo}` : `Il seguito di «${r.title}»`); break; }
    }
    const aff = pile.filter(b => !gap.some(g => g(b)));
    if (!out.length) for (const f of ["author", "genre"]) {
      const r = last.find(r => k(r, f) && aff.some(b => k(b, f) === k(r, f)));
      if (r) {
        const v = String(r[f]).trim(), who = /,| e |\bvari\b/i.test(v) ? v : v.split(/\s+/).pop(); // più autori: il nome intero, non l'ultima parola
        take(aff.find(b => k(b, f) === k(r, f)), "affine", f === "author" ? `Dopo «${r.title}», ancora ${who}` : `Stesso genere di «${r.title}»: ${v}`); break;
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
  const STARS_IT = ["", "una stella", "due stelle", "tre stelle", "quattro stelle", "cinque stelle"];
  const inMese = m => (/^[aeiou]/.test(m) ? "ad " : "a ") + m;
  const elenco = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
  // Mini-dorsi (uno per libro, al massimo 20) accanto a un autore.
  function miniSpines(books) {
    return `<span class="mini" aria-hidden="true">${books.slice(0, 20).map(b => { const p = Number(b.pages) || 0; return `<i style="height:${p > 0 ? 18 + Math.round(Math.min(p, 900) / 900 * 10) : 20}px;background:${colorOf(b)}"></i>`; }).join("")}</span>`;
  }
  // La frase in cima: ogni pezzo compare solo se vero e significativo.
  function ledeHTML(S) {
    const B = t => `<b>${t}</b>`, one = S.read === 1;
    let t = `Hai letto ${one ? B("un") + " libro" : B(num(S.read)) + " libri"}${S.pages ? `, ${B(num(S.pages))} pagine${one ? "" : " in tutto"}` : ""}.`;
    const rated = Object.values(S.ratings).reduce((x, y) => x + y, 0), mx = Math.max(...Object.values(S.ratings)), tops = [1, 2, 3, 4, 5].filter(n => S.ratings[n] === mx);
    const mid = [];
    if (rated >= 3 && tops.length === 1) mid.push(`il voto che dai più spesso è ${B(STARS_IT[tops[0]])}, a ${B(num(mx))} ${mx === 1 ? "libro" : "libri"}`);
    const A = S.authors;
    if (A[0] && A[0].count >= 2 && (!A[1] || A[0].count > A[1].count)) mid.push(`l'autore che torna di più è ${B(esc(A[0].name))}, con ${B(num(A[0].count))} titoli`);
    if (mid.length) { const m = mid.join("; "); t += " " + m[0].toUpperCase() + m.slice(1) + "."; }
    const mm = Math.max(...S.months), tm = S.months.map((n, i) => n === mm ? i : -1).filter(i => i >= 0);
    if (S.monthsCount >= 3 && tm.length === 1) t += ` Il mese in cui finisci più libri è ${B(MONTHS[tm[0]])}.`;
    return `<p class="stats-lede">${t}</p>`;
  }
  // Mensola di un anno: dorsi toccabili sul legno, file da 300 unità, paginata come gli scaffali.
  function yearHTML(a, racconto) {
    const shown = a.books.slice(0, state.limit["y" + a.year] || PAGE);
    const nums = plural(a.count, "libro", "libri") + (a.pages ? `, ${num(a.pages)} pagine` : "");
    const d = [a.topAuthor && a.topAuthor.count >= 2 ? `Autore dell'anno <b>${esc(a.topAuthor.name)}</b>` : "", a.topGenre && a.topGenre.count >= 2 ? `Genere <b>${esc(a.topGenre.name)}</b>` : "",
      a.best && a.count >= 2 ? `Il preferito: <b>${esc(a.best.title)}</b>, ${STARS_IT[Math.min(5, Math.round(a.best.rating))]}` : ""].filter(Boolean);
    return `<section class="ys" data-year="${a.year}" aria-labelledby="ys-${a.year}">
      <div class="ys-head"><div><h3 class="ys-n" id="ys-${a.year}" tabindex="-1">${a.year}</h3>
        <p class="ys-m">${nums}${a.avgRating ? `, <span aria-hidden="true">★</span><span class="sr">voto medio</span> ${dec(a.avgRating)}` : ""}</p></div>
        ${racconto ? `<button class="story-btn" type="button" data-story="${a.year}" aria-label="Il racconto del ${a.year}">Il racconto</button>` : ""}</div>
      <div class="ys-shelf${racconto ? " ribbon" : ""}" role="group" aria-label="${a.year}: ${nums}">${ysRows(shown).map(r => `<div class="ys-row">${r.map(b => spineHTML(b, "button", statDim(b))).join("")}</div>`).join("")}</div>
      ${pagerHTML("y" + a.year, shown.length, a.books.length)}
      ${d.length ? `<p class="ys-d">${d.join(". ")}.</p>` : ""}
    </section>`;
  }
  let statsLast = null; // ultimi calcoli, per ridisegnare una sola mensola
  function renderStats(st) {
    const S = st.sempre;
    if (!S.read) return `<div class="stats"><p class="stats-empty">Quando segnerai un libro come Letto, qui compariranno le tue statistiche</p></div>`;
    const blk = (key, title, small, body, cls = "") => `<section class="sblk${cls}" data-panel="${key}"><h3>${title}${small ? ` <small>${small}</small>` : ""}</h3>${body}</section>`;
    const maxR = Math.max(...Object.values(S.ratings)), rated = Object.values(S.ratings).reduce((x, y) => x + y, 0), f5 = S.fiveStars.map(b => `<b>${esc(b.title)}</b>`);
    const voti = (rated ? [5, 4, 3, 2, 1].map(n => hbar(`<span class="stars" role="img" aria-label="${n} ${n === 1 ? "stella" : "stelle"}">${"★".repeat(n)}</span>`, S.ratings[n], maxR)).join("") : "") +
      `<p class="hint">${rated ? "" : "Dai un voto dalla scheda del libro per vedere come giudichi le tue letture."}${f5.length ? `Cinque stelle a ${f5.length > 3 ? f5.slice(0, 3).join(", ") + ` e altri ${f5.length - 3}` : elenco(f5)}.` : ""}${S.unrated && rated ? ` ${plural(S.unrated, "libro senza voto", "libri senza voto")}.` : ""}</p>`;
    const D = S.days;
    const tempo = D ? `<div class="tm"><b>${D.avg}</b><span>${D.avg === 1 ? "giorno" : "giorni"} in media per libro</span></div>
        <p class="hint">${D.count === 1 ? `Su un solo libro: <b>${esc(D.fastest.book.title)}</b>.` : `Il più veloce <b>${esc(D.fastest.book.title)}</b>, ${D.fastest.days} ${D.fastest.days === 1 ? "giorno" : "giorni"}. Il più lento <b>${esc(D.slowest.book.title)}</b>, ${D.slowest.days}.`}</p>`
      : `<p class="hint">Aggiungi «Iniziato il» e «Finito il» nella scheda dei libri per sapere quanto tempo ti serve per finirne uno.</p>`;
    const mxm = Math.max(...S.months), tms = S.months.map((n, i) => n === mxm ? MONTHS[i] : "").filter(Boolean);
    const mesi = S.monthsCount ? `${monthsHTML(S.months)}<p class="hint">${tms.length === 1 ? `Leggi di più ${inMese(tms[0])}: ${plural(mxm, "libro", "libri")}.` : tms.length <= 3 ? `Leggi di più ${inMese(elenco(tms))}: ${mxm} libri ciascuno.` : ""}</p>`
      : `<p class="hint">Aggiungi «Finito il» nella scheda dei libri per vedere in quali mesi leggi di più.</p>`;
    const autori = S.authors.length ? `<ul class="list">${S.authors.map(a => `<li><div><b title="${esc(a.name)}">${esc(a.name)}</b><span>${plural(a.count, "libro", "libri")}${a.pages ? `, ${num(a.pages)} pagine` : ""}${a.avgRating ? `, ★ ${dec(a.avgRating)}` : ""}</span></div>${miniSpines(a.books)}</li>`).join("")}</ul>`
      : `<p class="hint">Aggiungi l'autore nella scheda dei libri.</p>`;
    const maxG = S.genres.length ? S.genres[0].count : 0;
    const generi = S.genres.length ? S.genres.map(g => hbar(esc(g.name), g.count, maxG, g.name)).join("") : `<p class="hint">Aggiungi il genere nella scheda dei libri.</p>`;
    return `<div class="stats"><h2 class="stats-title" tabindex="-1">Statistiche</h2>${ledeHTML(S)}
      <div class="stats-cols"><div class="stats-years"><h2 class="sr">Anno per anno</h2>
        ${st.anni.map(a => yearHTML(a, st.racconti.includes(a.year))).join("")}
        ${st.future ? `<p class="hint stats-future">${st.future === 1 ? "1 libro letto ha" : `${num(st.future)} libri letti hanno`} una data di fine nel futuro: correggila dalla scheda del libro per vederlo negli anni.</p>` : ""}
        ${st.noYear ? `<div class="stats-noyear"><b>${st.noYear === 1 ? "1 libro letto senza anno." : `${num(st.noYear)} libri letti senza anno.`}</b> Aggiungi «Finito il» o solo l'anno dalla scheda del libro: comparirà sulla sua mensola.</div>` : ""}
      </div><div class="sempre"><h2 class="sr">Sempre</h2>
        ${blk("voti", "Voti", rated ? `${plural(rated, "libro votato", "libri votati")} · media ${dec(S.avgRating)}` : "nessun voto", voti)}
        ${blk("tempo", "Tempo di lettura", D ? plural(D.count, "libro con le date", "libri con le date") : "", tempo)}
        ${blk("mesi", "Mesi", S.monthsCount ? plural(S.monthsCount, "libro con la data di fine", "libri con la data di fine") : "", mesi)}
        ${blk("autori", "Autori", "", autori, " span2")}
        ${blk("generi", "Generi", "", generi, " span2")}
      </div></div></div>`;
  }

  // Racconto a schermo intero di un anno appena concluso: schermate da sfogliare, senza avanzamento automatico.
  function openStory(year) {
    const now = new Date(), a = computeStats(state.books, now).anni.find(x => x.year === year);
    if (!a) return;
    const Y = computeStats(a.books, now).sempre, opener = document.activeElement;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const slide = (key, body) => `<section class="slide" data-s="${key}">${body}</section>`;
    const list = [slide("copertina", `<p class="big">${year}</p><p class="mid">Hai messo sullo scaffale <b>${a.count === 1 ? "un libro" : a.count + " libri"}</b>.</p><p class="sm">Tocca a destra per continuare</p>`),
      slide("numeri", `<p class="kick">I numeri</p><p class="big">${num(a.count)}</p><p class="mid">${a.count === 1 ? "libro letto" : "libri letti"}</p>${a.pages ? `<p class="big small">${num(a.pages)}</p><p class="mid">pagine</p><p class="sm">In media ${num(Math.max(1, Math.round(a.pages / (leap ? 366 : 365))))} pagine al giorno, tutti i giorni.</p>` : ""}`)];
    if (a.count >= 3) {
      const D = Y.days, topM = a.months.indexOf(Math.max(...a.months));
      if (Y.monthsCount) list.push(slide("mese", `<p class="kick">Il mese più letto</p><p class="big small">${MONTHS[topM][0].toUpperCase() + MONTHS[topM].slice(1)}</p><p class="mid">${plural(a.months[topM], "libro finito", "libri finiti")}</p>${monthsHTML(a.months)}`));
      if (D) list.push(slide("tempo", `<p class="kick">Tempo di lettura</p><p class="big">${D.avg}</p><p class="mid">${D.avg === 1 ? "giorno" : "giorni"} in media per libro</p><p class="sm">Il più veloce: ${esc(D.fastest.book.title)}, in ${plural(D.fastest.days, "giorno", "giorni")}.</p>`));
      if (a.topAuthor) list.push(slide("autore", `<p class="kick">L'autore dell'anno</p><p class="mid name">${esc(a.topAuthor.name)}</p><p class="sm">${plural(a.topAuthor.count, "libro letto", "libri letti")}</p>`));
      if (a.topGenre) list.push(slide("genere", `<p class="kick">Il genere dell'anno</p><p class="mid name">${esc(a.topGenre.name)}</p><p class="sm">${plural(a.topGenre.count, "libro", "libri")} su ${num(a.count)}</p>`));
      if (a.best) list.push(slide("preferito", `<p class="kick">Il preferito del ${year}</p><p class="mid name">${esc(a.best.title)}</p><p class="sm">${esc(a.best.author || "")}</p><p class="stars" role="img" aria-label="${Math.round(a.best.rating)} ${Math.round(a.best.rating) === 1 ? "stella" : "stelle"}">${starStr(Math.round(a.best.rating))}</p>`));
      if (a.avgRating != null) { const mx = Math.max(...Object.values(Y.ratings)); list.push(slide("voti", `<p class="kick">I tuoi voti</p><p class="big">★ ${dec(a.avgRating)}</p><p class="mid">voto medio</p><div class="story-votes">${[5, 4, 3, 2, 1].map(n => hbar(`<span role="img" aria-label="${n} stelle">${"★".repeat(n)}</span>`, Y.ratings[n], mx)).join("")}</div>`)); }
    }
    list.push(slide("chiusura", `<p class="kick">Il tuo ${year}</p><p class="mid">${plural(a.count, "libro", "libri")}, un anno da ricordare.</p><button class="story-done" type="button">Chiudi</button>`));
    // Palco: i libri dell'anno fino a 170 unità (al massimo 12); il preferito c'è sempre, al posto dell'ultimo.
    const stage = []; let tot = 0;
    for (const b of a.books) { const u = statDim(b).u; if (stage.length >= 12 || tot + u > 170) break; stage.push(b); tot += u; }
    if (a.best && !stage.includes(a.best)) { if (stage.length) stage[stage.length - 1] = a.best; else stage.push(a.best); }
    const stageHTML = stage.map((b, k) => spineHTML(b, "span", { w: (statDim(b).u * 0.53).toFixed(2) + "%", h: statDim(b).h }).replace("<span ", `<span${b === a.best && list.some(x => x.includes('data-s="preferito"')) ? " data-best" : ""} `).replace('style="', `style="--i:${k};`)).join("");
    const el = document.createElement("div");
    el.id = "story"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `Il tuo ${year}`); el.tabIndex = -1;
    el.innerHTML = `<div class="story-bars" aria-hidden="true">${list.map(() => "<i></i>").join("")}</div>
      <div class="story-top"><span>Il tuo anno da lettore</span><button class="story-close" type="button" aria-label="Chiudi il racconto">✕</button></div>
      <div class="story-body">${list.join("")}</div><div class="story-stage" aria-hidden="true">${stageHTML}</div><p class="sr story-live" aria-live="polite"></p>
      <div class="story-nav"><button class="story-prev" type="button" aria-label="Schermata precedente">‹</button><span class="story-count"></span><button class="story-next" type="button" aria-label="Schermata successiva">›</button></div>`;
    document.body.append(el); document.body.style.overflow = "hidden";
    const slides = [...el.querySelectorAll(".slide")], bars = [...el.querySelectorAll(".story-bars i")];
    let i = 0;
    const show = n => {
      i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach((x, k) => x.hidden = k !== i);
      bars.forEach((x, k) => x.classList.toggle("on", k <= i));
      const k = slides[i].querySelector(".kick"), body = slides[i].textContent.replace(/\s+/g, " ").trim();
      $(".story-live", el).textContent = `Schermata ${i + 1} di ${slides.length}: ${k ? k.textContent + ". " + body.slice(k.textContent.length).trim() : body}`.slice(0, 240);
      $(".story-count", el).textContent = `${i + 1} di ${slides.length}`;
      const bk = $("[data-best]", el); if (bk) bk.classList.toggle("out", slides[i].dataset.s === "preferito");
      $(".story-prev", el).disabled = i === 0; $(".story-next", el).disabled = i === slides.length - 1;
      const a = document.activeElement; // un pulsante disattivato o nascosto perderebbe il focus: lo riporto sul racconto
      if (a && a !== el && el.contains(a) && (a.disabled || !a.offsetParent)) el.focus();
    };
    const close = () => {
      document.removeEventListener("keydown", keys, true); el.remove(); document.body.style.overflow = "";
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      else { const c = document.querySelector(`[data-story="${year}"]`); if (c) c.focus({ preventScroll: true }); }
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
      if (e.target.closest(".story-nav")) return;
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
    const sk = state.view === "stats" ? statsFocusKey() : null;
    if (state.view === "stats") main.innerHTML = renderStats(statsLast = computeStats(state.books, new Date())); // la ricerca non vale qui: la sua barra è nascosta
    else {
      const list = visible().filter(b => state.filter === "tutti" || b.status === state.filter);
      if (state.mode === "dorsi") main.innerHTML = renderShelves(visible()); // gli scaffali da mostrare li sceglie renderShelves
      else main.innerHTML = list.length ? renderCovers(list) : `<p class="hint">${state.q.trim() ? "Nessun libro corrisponde alla ricerca." : "Nessun libro in questo scaffale."}</p>`;
    }
    $("#toolbar").hidden = state.view === "stats";
    wireMain(main);
    if (sk) statsFocusRestore(sk);
  }
  // Ridisegnando le Statistiche il focus non si perde: torna sul dorso (o sul titolo dell'anno, o su «Statistiche»).
  const sheetOpen = () => !!document.querySelector("#scrim:not(.closing)");
  function statsFocusKey() {
    const inYs = el => el && el.closest && el.closest("#main section.ys");
    const a = document.activeElement;
    const el = inYs(a) ? a : sheetOpen() && inYs(lastFocus) ? lastFocus : null;
    if (!el) return null;
    const sec = el.closest("section.ys");
    return { id: el.dataset ? el.dataset.id || null : null, year: Number(sec.dataset.year) };
  }
  function statsFocusRestore(k) {
    const m = $("#main"), t = (k.id && m.querySelector(`section.ys [data-id="${CSS.escape(k.id)}"]`)) || m.querySelector(`#ys-${k.year}`) || m.querySelector(".stats-title");
    if (!t) return;
    if (sheetOpen()) lastFocus = t; else t.focus({ preventScroll: true });
  }
  function wireMain(root) {
    root.querySelectorAll("[data-story]").forEach(btn => btn.onclick = () => openStory(Number(btn.dataset.story)));
    root.querySelectorAll("[data-choose]").forEach(btn => btn.onclick = () => { const s = openSheet(""); fillNext(s); $("button", s).focus(); });
    root.querySelectorAll("[data-id]").forEach(wireItem);
    root.querySelectorAll("[data-more]").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.more;
      state.limit[key] = (state.limit[key] || PAGE) + PAGE;
      if (/^y\d{4}$/.test(key)) { const n = replaceYear(Number(key.slice(1))); const f = n && (n.querySelector("[data-more]") || n.querySelector("[data-less]")); if (f) f.focus({ preventScroll: true }); return; }
      if (key === "covers") { swapIn(); render(); } else replaceShelf(key);
    });
    root.querySelectorAll("[data-less]").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.less;
      state.limit[key] = PAGE;
      if (/^y\d{4}$/.test(key)) {
        const n = replaceYear(Number(key.slice(1)));
        if (n) { const f = n.querySelector("[data-more]"); if (f) f.focus({ preventScroll: true }); if (n.getBoundingClientRect().top < 0) n.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
        return;
      }
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
      r.oninput = () => { const n = root.querySelector(`[data-page="${CSS.escape(r.dataset.range)}"]`); if (n) n.value = r.value; r.setAttribute("aria-valuetext", `pagina ${r.value} di ${r.max}`); r.style.setProperty("--pct", 100 * r.value / r.max + "%"); };
      r.onchange = () => pageQuick(r.dataset.range, { to: Number(r.value), manual: true });
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
  // Ridisegna una sola mensola dell'anno da statsLast (niente ricalcolo); restituisce la nuova sezione.
  function replaceYear(year) {
    const old = $("#main").querySelector(`section.ys[data-year="${year}"]`), a = statsLast && statsLast.anni.find(x => x.year === year);
    if (!old || !a) return null;
    const t = document.createElement("template"); t.innerHTML = yearHTML(a, statsLast.racconti.includes(year)).trim();
    const n = t.content.firstElementChild; old.replaceWith(n); wireMain(n); return n;
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
      t = setTimeout(() => { t = null; el.dataset.lp = "1"; const b = state.books.find(x => x.id === el.dataset.id); if (el.closest("section.ys")) el.focus({ preventScroll: true }); if (b) openQuick(b); }, 480);
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
  function openSheet(html, cls = "") {
    lastFocus = document.activeElement; sheetGuard = null;
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const layer = $("#layer");
    layer.innerHTML = `<div class="scrim" id="scrim"><div class="sheet${cls ? " " + cls : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
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

  const VERDICTS = ["", "Non mi è piaciuto", "Così così", "Mi è piaciuto", "Bellissimo", "Lo rileggerei"];
  const verdict = (n, status) => n >= 1 && n <= 5 ? VERDICTS[n] : status === "letto" ? "Tocca una stella per dare il voto" : "Il voto, quando vuoi";
  const rateHTML = b => `<div class="field rate-f"><span class="label">Voto</span><div class="rate" id="f-rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${(b.rating || 0) >= n ? "on" : ""}" aria-label="${n} stelle">★</button>`).join("")}</div><p class="verdict" id="f-verdict" aria-live="polite">${verdict(b.rating || 0, b.status || "letto")}</p></div>`;
  // Blocchi della lettura: stato, voto (se Letto), date, pagina; poi citazione, note e voto (se non Letto). Usati dalla scheda del libro e da Nuovo libro.
  function readingHead(b, rate = true) {
    return `<div class="rf rf-head">
      <div class="field"><span class="label" id="f-status-l">Stato</span>
        <input type="hidden" id="f-status" value="${esc(b.status || "da-leggere")}">
        <div class="seg" role="radiogroup" aria-labelledby="f-status-l">${["da-leggere", "in-lettura", "letto"].map(k => `<button type="button" role="radio" data-v="${k}" aria-checked="${b.status === k}">${STATUS_ONE[k]}</button>`).join("")}<span class="seg-ink"></span></div>
      </div>
      ${rate ? rateHTML(b) : ""}
      <div class="period" id="f-period">
        <p class="sr" id="f-period-sr"></p>
        <p class="pline"><span class="pw pl" id="f-pw-lead" aria-hidden="true" hidden></span><span class="pc" id="f-pc-start"><span class="pw" aria-hidden="true"></span><label class="dt"><span class="dv" aria-hidden="true"></span><input id="f-started" type="date" aria-label="Iniziato il" value="${esc(b.started || "")}"></label></span><span class="pc" id="f-pc-end"><span class="pw" aria-hidden="true"></span><label class="dt"><span class="dv" aria-hidden="true"></span><input id="f-finished" type="date" aria-label="Finito il" value="${esc(b.finished || "")}"${b.finishedAuto ? ' data-auto="1"' : ""}${b.status === "letto" ? "" : " disabled"}></label></span></p>
        <p class="psub" id="f-psub" hidden></p>
        <p class="hint" id="f-pend-hint" hidden>La data di fine si sceglie quando lo segni come letto.</p>
        <p class="hint err" id="f-date-err" role="alert" hidden></p>
        <p class="hint" id="f-date-est" hidden>Fine stimata: 20 giorni dopo l'inizio, modificala se serve.</p>
        <div class="field" id="f-year-row"${b.status === "letto" && !b.finished ? "" : " hidden"}><label for="f-year">oppure solo l'anno</label><input id="f-year" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" value="${esc(b.finishedYear || "")}" placeholder="es. 2019" aria-describedby="f-year-err"><p class="hint err" id="f-year-err" role="alert" hidden></p></div>
        ${needsDates(b) ? `<p class="hint stale-note" id="s-stale"><i class="badge inline" aria-hidden="true">!</i><span>Periodo di lettura da aggiornare: ${b.finished || b.finishedYear ? esc(dateProblem(b.started || "", b.finished || "").msg) : "aggiungi la data di fine, o almeno l'anno."}</span></p>` : ""}
      </div>
      <div class="pblk" id="f-pblk">
        <div class="pbig"><label for="f-page">pag.</label> <input id="f-page" type="number" inputmode="numeric" min="0" value="${esc(b.status === "letto" && b.pages ? b.pages : b.page || "")}" placeholder="${b.pages ? "su " + b.pages : ""}"> <span id="f-pof"></span></div>
        <input type="range" id="f-range" min="0" max="${esc(b.pages || 0)}" value="${esc(b.page || 0)}" aria-label="Avanzamento di ${esc(b.title || "")}">
        <div class="pq"><button type="button" class="btn" id="f-p10" aria-label="Aggiungi 10 pagine a ${esc(b.title || "")}">+10</button><button type="button" class="btn" id="f-pstep" data-step="${esc(b.pageStep || "")}" aria-label="Aggiungi ${esc(b.pageStep || "")} pagine a ${esc(b.title || "")}"${b.pageStep ? "" : " hidden"}>+${esc(b.pageStep || "")}</button></div>
      </div>
    </div>`;
  }
  function readingMemo(b) {
    return `<div class="rf rf-memo">
      <div class="field quote"><label class="sr" for="f-quote">Citazione preferita</label><span class="qm" aria-hidden="true">“</span><textarea id="f-quote" placeholder="“Una frase da ricordare”">${esc(b.quote || "")}</textarea><span class="qm qe" aria-hidden="true">”</span></div>
      <div class="field notes"><label for="f-notes">Le tue note</label><textarea id="f-notes" placeholder="Cosa ti è rimasto di questo libro?">${esc(b.notes || "")}</textarea></div>
    </div>`;
  }
  // Trama ridotta a 4 righe: «…» compare solo se il testo non ci sta.
  function synClamp(sheet) {
    const sy = $("#s-syn", sheet), m = $("#s-syn-more", sheet); if (!sy || !m) return;
    requestAnimationFrame(() => { m.hidden = !sy.classList.contains("open") && sy.scrollHeight <= sy.clientHeight + 1; });
  }
  // Copertina del frontespizio e quella di «Sullo scaffale» insieme.
  const lookCover = b => coverHTML(b).replace('class="cover', 'class="looks-cover cover');
  function coverSync(sheet, b) {
    const a = $(".sheet-top .cover", sheet); if (a) a.outerHTML = coverHTML(b);
    const l = $(".looks-cover", sheet); if (l) l.outerHTML = lookCover(b);
  }
  function dataFields(b) {
    return `
      <div class="field"><label for="d-title">Titolo</label><input id="d-title" value="${esc(b.title || "")}" autocomplete="off"></div>
      <div class="field"><label for="d-author">Autore</label><input id="d-author" value="${esc(b.author || "")}" autocomplete="off"></div>
      <div class="grid-serie">
        <div class="field"><label for="d-series">Serie</label><input id="d-series" list="series-list" maxlength="80" value="${esc(b.series || "")}" autocomplete="off"></div>
        <div class="field"><label for="d-series-no">N.</label><input id="d-series-no" inputmode="decimal" maxlength="6" value="${esc(b.seriesNo || "")}" autocomplete="off"></div>
      </div>
      <datalist id="series-list">${[...seriesNames().values()].sort((x, y) => x.localeCompare(y, "it")).map(s => `<option value="${esc(s)}">`).join("")}</datalist>
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
        syncYearRow(sheet); syncPage(sheet); syncPeriod(sheet);
        const vd = $("#f-verdict", sheet); if (vd) vd.textContent = verdict(holder.rating || 0, btn.dataset.v);
      });
      const fin = $("#f-finished", sheet); if (fin) fin.addEventListener("input", () => syncYearRow(sheet));
      wireDates(sheet); wireDateSlots(sheet);
      const dp = $("#d-pages", sheet); if (dp) dp.addEventListener("input", () => syncPage(sheet));
      syncPage(sheet);
      requestAnimationFrame(sync);
    }
    sheet.querySelectorAll("#f-rate button").forEach(btn => btn.onclick = () => {
      const n = Number(btn.dataset.n); holder.rating = holder.rating === n ? 0 : n;
      sheet.querySelectorAll("#f-rate button").forEach(x => x.classList.toggle("on", Number(x.dataset.n) <= holder.rating));
      const vd = $("#f-verdict", sheet); if (vd) vd.textContent = verdict(holder.rating, ($("#f-status", sheet) || { value: "letto" }).value);
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
    const sta = $("#f-started", sheet), fin = $("#f-finished", sheet), err = $("#f-date-err", sheet), est = $("#f-date-est", sheet), yr = $("#f-year", sheet);
    if (!sta || !fin) return;
    const say = (field, msg) => { err.hidden = !msg; err.textContent = msg || ""; [sta, fin].forEach(x => x.removeAttribute("aria-invalid")); if (msg && field) field.setAttribute("aria-invalid", "true"); };
    const limits = () => { const t = today(); sta.max = t; fin.min = sta.value || ""; fin.max = t; }; // l'inizio può superare la fine: la fine si sposta
    [sta, fin].forEach(el => {
      el.dataset.ok = el.value; // ultimo valore coerente: se la nuova scelta non lo è, si torna a questo
      el.addEventListener("change", () => {
        // Nuovo inizio dopo la fine già scritta: tengo l'inizio e sposto la fine (sotto), invece di rifiutare la scelta.
        const moved = el === sta && sta.value && fin.value && !fin.disabled && sta.value > fin.value && sta.value <= today();
        if (moved) fin.value = "";
        const pr = dateProblem(sta.value, fin.value, el === sta ? "started" : "finished");
        if (pr) { el.value = el.dataset.ok; say(el, pr.msg); } else { el.dataset.ok = el.value; say(null); }
        est.hidden = true;
        if (el === fin) delete fin.dataset.auto; // fine scelta a mano: non la tocco più
        // Libro letto senza fine (o con la fine messa dall'app) né anno: dall'inizio stimo la fine 20 giorni dopo (mai oltre oggi).
        if (el === sta && sta.value && !pr && (!fin.value || fin.dataset.auto) && !fin.disabled && !(yr && yr.value)) {
          const d = new Date(sta.value + "T12:00"); d.setDate(d.getDate() + 20);
          const v = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
          fin.value = fin.dataset.ok = v < today() ? v : today(); fin.dataset.auto = "1"; est.hidden = false;
          est.textContent = (moved ? "Fine spostata a 20 giorni dopo il nuovo inizio" : "Fine stimata: 20 giorni dopo l'inizio") + ", modificala se serve.";
        }
        limits(); syncYearRow(sheet); syncPeriod(sheet);
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
  // Riscrive solo testi e `hidden` della frase delle date, del ritmo e dei suggerimenti: i campi data non si ricreano mai.
  function syncPeriod(sheet) {
    const st0 = $("#f-status", sheet), per = $("#f-period", sheet); if (!st0 || !per) { syncColophon(sheet); return; }
    const st = st0.value, yv = $("#f-year", sheet), y = yv ? Number(yv.value.trim()) : 0;
    sheet.dataset.st = st; // lo stile nasconde citazione, note e voto per i Da leggere
    const started = $("#f-started", sheet).value, finished = $("#f-finished", sheet).value, pages = parseInt($("#d-pages", sheet).value, 10) || 0;
    const r = periodText({ status: st, started, finished, year: Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear() ? y : "", pages });
    const lead = $("#f-pw-lead", sheet); lead.textContent = r.lead; lead.hidden = !r.lead;
    [["#f-pc-start", r.showStart, r.startWord, r.startText], ["#f-pc-end", r.showEnd, r.endWord, r.endText]].forEach(([id, show, word, text]) => {
      const c = $(id, sheet); c.hidden = !show; c.querySelector(".pw").textContent = word; c.querySelector(".dv").textContent = text;
    });
    let sub = r.sub;
    if (st === "in-lettura") { const t = today(); sub = paceText(readingPace({ started, page: parseInt($("#f-page", sheet).value, 10) || 0, pages }, t), t); }
    const ps = $("#f-psub", sheet); ps.textContent = sub; ps.hidden = !sub || st === "da-leggere";
    $("#f-pend-hint", sheet).hidden = st !== "in-lettura";
    $("#f-period-sr", sheet).textContent = r.sr + (st === "in-lettura" && sub ? " " + sub : "");
    syncColophon(sheet);
  }
  // Colophon: dati del libro (dai campi della scheda) e chiusa «Finito di leggere…». Non c'è in Nuovo libro.
  const MFMT = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
  function syncColophon(sheet) {
    const colo = $("#s-colo", sheet); if (!colo) return;
    const val = id => ($(id, sheet).value || "").trim(), facts = $("#s-colo-facts", sheet), rows = [];
    const row = (...parts) => { const p = document.createElement("p"); parts.forEach(x => { if (typeof x === "string") p.append(x); else { const b = document.createElement("b"); b.textContent = x.t; if (x.mono) b.className = "mono"; p.append(b); } }); rows.push(p); };
    const year = val("#d-year"), pages = parseInt(val("#d-pages"), 10) || 0, genre = val("#d-genre"), call = val("#d-call"), isbn = colo.dataset.isbn || "";
    if (year) row("Pubblicato nel ", { t: year });
    if (pages && genre) row({ t: String(pages) }, (pages === 1 ? " pagina, " : " pagine, ") + genre.toLowerCase());
    else if (pages) row({ t: String(pages) }, pages === 1 ? " pagina" : " pagine");
    else if (genre) row(genre[0].toUpperCase() + genre.slice(1));
    if (call) row("Segnatura ", { t: call, mono: true });
    if (isbn) row("ISBN ", { t: isbn });
    if (!rows.length) row("Nessun dato del libro: aggiungili con «Modifica i dati del libro».");
    facts.replaceChildren(...rows);
    const f = $("#f-status", sheet), st = f ? f.value : colo.dataset.st, S = f ? $("#f-started", sheet).value : "", F = f ? $("#f-finished", sheet).value : "", yv = $("#f-year", sheet) ? Number($("#f-year", sheet).value.trim()) : 0;
    let l1 = "Nella lista dei desideri";
    if (st === "letto") l1 = isoOk(F) ? "Finito di leggere nel mese di " + MFMT.format(new Date(F + "T12:00")) : Number.isInteger(yv) && yv >= 1900 && yv <= new Date().getFullYear() ? "Finito di leggere nel " + yv : "Finito di leggere (data da aggiungere)";
    else if (st === "in-lettura") l1 = isoOk(S) ? "In lettura dal mese di " + MFMT.format(new Date(S + "T12:00")) : "In lettura";
    else if (st === "da-leggere") l1 = "In attesa di essere letto";
    $(".l1", colo).textContent = l1;
  }
  // Data toccabile: il campo vero è sovrapposto e trasparente; sul computer il clic apre il calendario con showPicker().
  function wireDateSlots(sheet) {
    ["#f-started", "#f-finished"].forEach(id => {
      const el = $(id, sheet); if (!el) return;
      const open = () => { try { el.showPicker(); } catch {} };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(); });
    });
    sheet.querySelectorAll("#f-year, #f-page, [id^=d-]").forEach(el => el.addEventListener("input", () => syncPeriod(sheet)));
    syncPeriod(sheet);
  }
  // «oppure solo l'anno» solo per un libro letto senza data di fine
  function syncYearRow(sheet) { const r = $("#f-year-row", sheet); if (r) r.hidden = !($("#f-status", sheet).value === "letto" && !$("#f-finished", sheet).value); }
  // Un libro letto ha letto tutte le pagine: la pagina attuale segue il totale (e non si cambia a mano).
  function syncPage(sheet) {
    const pg = $("#f-page", sheet); if (!pg) return;
    if (pg.dataset.orig === undefined) pg.dataset.orig = pg.value;
    const tot = parseInt($("#d-pages", sheet) && $("#d-pages", sheet).value, 10) || 0, st = $("#f-status", sheet).value, done = st === "letto" && tot > 0;
    if (done) { pg.readOnly = true; pg.value = tot; } else { if (pg.readOnly) pg.value = pg.dataset.orig; pg.readOnly = false; } // si riprende il valore di apertura solo tornando da Letto
    pg.placeholder = tot ? "su " + tot : "";
    const blk = $("#f-pblk", sheet); if (blk) blk.hidden = st !== "in-lettura";
    const rg = $("#f-range", sheet), cur = parseInt(pg.value, 10) || 0, pct = tot ? Math.min(100, Math.round(cur / tot * 100)) : 0;
    if (rg) { rg.hidden = !tot; rg.max = tot; rg.value = cur; rg.style.setProperty("--pct", (tot ? Math.min(100, cur / tot * 100) : 0) + "%"); rg.setAttribute("aria-valuetext", `pagina ${cur} di ${tot}`); }
    const pof = $("#f-pof", sheet); if (pof) pof.textContent = tot ? `di ${tot} · ${pct}%` : "di ?";
  }
  // Cursore, +10 e +N nella scheda: cambiano solo il campo della pagina (si salva con Salva) e non toccano `pageStep`.
  function wirePageCtl(sheet) {
    const pg = $("#f-page", sheet); if (!pg) return;
    const fire = () => pg.dispatchEvent(new Event("input", { bubbles: true }));
    const add = n => { const tot = parseInt($("#d-pages", sheet).value, 10) || 0, v = (parseInt(pg.value, 10) || 0) + n; pg.value = tot ? Math.min(v, tot) : v; fire(); };
    $("#f-range", sheet).addEventListener("input", e => { pg.value = e.target.value; fire(); });
    $("#f-p10", sheet).onclick = () => add(10);
    const st = $("#f-pstep", sheet); st.onclick = () => add(Number(st.dataset.step) || 0);
    pg.addEventListener("input", () => syncPage(sheet));
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
    b.finishedAuto = $("#f-finished", sheet).dataset.auto ? true : undefined;
    if (b.status !== "letto") b.finished = ""; // la fine vale solo per un libro letto
    const y = $("#f-year", sheet); b.finishedYear = y && b.status === "letto" && !b.finished ? y.value.trim() : undefined;
    b.notes = $("#f-notes", sheet).value.trim(); b.quote = $("#f-quote", sheet).value.trim();
    const pg = parseInt($("#f-page", sheet).value, 10); b.page = pg >= 0 ? pg : undefined;
    const tot = parseInt($("#d-pages", sheet) && $("#d-pages", sheet).value, 10) || b.pages;
    if (b.status === "letto" && tot) b.page = tot; // letto = tutte le pagine
    if (b.status === "letto" && was !== "letto" && !b.finished && !b.finishedYear) { b.finished = today(); b.finishedAuto = true; }
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
  // Nomi già usati (prima forma trovata): un nome uguale prende quella forma. Il confronto largo ignora accenti, punteggiatura,
  // articoli e parole come «saga», «ciclo», «series» («Slough House series» = «Slough House»).
  const seriesLoose = v => { const k = norm(v).replace(/\b(the|il|lo|la|i|gli|le|l|series|serie|saga|ciclo|cycle|trilogia|trilogy|sequence)\b/g, " ").replace(/\s+/g, " ").trim(); return k || seriesKey(v); };
  function seriesNames(key = seriesKey) {
    const m = new Map();
    for (const b of state.books) if (b.series && !m.has(key(b.series))) m.set(key(b.series), b.series);
    return m;
  }
  // Nome scritto a mano: confronto stretto. Nome da Wikidata (alts: la stessa serie in altre lingue): confronto largo,
  // e se uno dei nomi è già in libreria vince quello.
  const seriesName = (v, alts) => {
    if (!alts) return seriesNames().get(seriesKey(v)) || v.trim();
    const m = seriesNames(seriesLoose); for (const x of [v, ...alts]) { const f = m.get(seriesLoose(x)); if (f) return f; } return v.trim();
  };
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
    coverSync(sheet, { ...b, title: hit.title || b.title, author: hit.author || b.author });
    const colo = $("#s-colo", sheet); if (colo) colo.dataset.isbn = b.isbn || "";
    syncPeriod(sheet);
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
        const found = await searchBooks(q, { onTry: (n, tot) => { if (mine === seq) status.textContent = `Cerco… Google risponde a intermittenza: tentativo ${n} di ${tot}, aspetta qualche secondo.`; } });
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

  // «Prossimo della serie» nella scheda di un libro letto.
  const NEXT_ST = { "da-leggere": "in pila", desiderato: "nella lista dei desideri", "in-lettura": "in lettura" };
  function snextHTML(b) {
    const r = b.status === "letto" && nextInSeries(b, state.books), x = r && r.book, no = x ? x.seriesNo : r && r.no;
    if (!r) return "";
    const t = `<b>${no ? "#" + esc(no) + " " : ""}${esc(x ? x.title : r.title)}</b>`;
    return `<div class="snext"><span class="lab">Prossimo della serie</span>${x ? `<button class="snb" type="button" data-next-open="${esc(x.id)}">${t} <span class="st">· ${NEXT_ST[x.status]} <span aria-hidden="true">›</span></span></button>` : `<span>${t} <span class="st">· non ce l'hai</span></span><button class="btn" type="button" data-wish-next="${esc(r.title)}"${r.no ? ` data-no="${esc(r.no)}"` : ""} aria-label="Aggiungi «${esc(r.title)}» alla lista dei desideri">Lista dei desideri</button>`}</div>`;
  }
  // ---- Scheda «Frontespizio»: frasi delle date e ritmo di lettura (funzioni pure) ----
  const DFMT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const isoOk = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T12:00"));
  const longDate = (iso, year = true) => { if (!isoOk(iso)) return ""; const t = DFMT.format(new Date(iso + "T12:00")); return year ? t : t.replace(/\s\d{4}$/, ""); };
  const dayDiff = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const prep = (base, iso) => { const g = isoOk(iso) ? Number(iso.slice(8)) : 0; return g === 8 || g === 11 ? ({ il: "l'", dal: "dall'", al: "all'" })[base] : base + " "; };
  const nPages = n => n + (n === 1 ? " pagina" : " pagine");
  function periodText({ status, started, finished, year, pages }) {
    const S = isoOk(started) ? started : "", F = isoOk(finished) ? finished : "", ph = "scegli la data", pg = Number(pages) > 0 ? Number(pages) : 0;
    const r = { lead: "", startWord: "", startText: ph, endWord: "", endText: ph, showStart: false, showEnd: false, sub: "", sr: "" };
    if (status === "da-leggere") { r.lead = "Ancora da iniziare."; r.sr = r.lead; return r; }
    if (status === "in-lettura") {
      r.showStart = true; r.startWord = "In lettura " + prep("dal", S); if (S) r.startText = longDate(S);
      r.sr = "In lettura dal" + (S ? " " + longDate(S) : ": data da scegliere") + "."; return r;
    }
    if (status !== "letto") return r;
    r.showStart = r.showEnd = true; r.sub = ""; // le pagine stanno già nell'intestazione
    const y = year && !F ? Number(year) : 0, sx = S ? longDate(S) : "", fx = F ? longDate(F) : "";
    if (S && F) {
      const n = dayDiff(S, F) + 1;
      r.startWord = "Letto " + prep("dal", S); r.endWord = " " + prep("al", F);
      r.startText = longDate(S, S.slice(0, 4) !== F.slice(0, 4)); r.endText = fx;
      r.sub = n < 1 ? "" : n === 1 ? "In un giorno" : n + " giorni";
      r.sr = `Letto dal ${sx} al ${fx}${n < 1 ? "" : n === 1 ? ", in un giorno" : ", " + n + " giorni"}.`; return r;
    }
    if (y) r.lead = "Letto nel " + y + ".";
    r.startWord = "Iniziato " + prep("il", S); r.endWord = " e finito " + prep("il", F);
    if (S) r.startText = sx; if (F) r.endText = fx;
    r.sr = (r.lead ? r.lead + " " : "") + `Iniziato il${S ? " " + sx : ": data da scegliere"}; finito il${F ? " " + fx : ": data da scegliere"}.`;
    return r;
  }
  function readingPace({ started, page, pages }, oggi) {
    if (!isoOk(started) || started > oggi) return { why: "no-start" };
    const day = dayDiff(started, oggi) + 1, pt = Number(pages) || 0, pa = Number(page) || 0;
    if (day === 1) return { why: "today", day };
    if (pt <= 0) return { why: "no-pages", day };
    if (pa <= 0) return { why: "no-page", day };
    if (pa >= pt) return { why: "done", day };
    const perDay = pa / day, left = pt - pa, n = Math.ceil(left / perDay);
    if (day > 730 || perDay < 1 || perDay > 300 || n > 365) return { why: "odd", day, perDay, left };
    return { why: "ok", day, perDay, left, eta: addDays(oggi, n) };
  }
  function paceText(r, oggi) {
    const d = `${r.day}º giorno di lettura`;
    switch (r.why) {
      case "no-start": return "Scegli la data di inizio: qui comparirà quando potresti finirlo.";
      case "today": return "Primo giorno di lettura: la stima compare da domani.";
      case "no-pages": return d + ". Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.";
      case "no-page": return d + ". Scrivi a che pagina sei per sapere quando lo finisci.";
      case "done": return d + ": sei all'ultima pagina, segnalo come Letto.";
      case "ok": {
        const when = r.eta === addDays(oggi, 1) ? "domani" : "verso " + prep("il", r.eta) + longDate(r.eta, r.eta.slice(0, 4) !== oggi.slice(0, 4));
        return `${d}, circa ${nPages(Math.round(r.perDay))} al giorno: a questo ritmo lo finisci ${when}.`;
      }
      default: return d + ".";
    }
  }
  function openBook(book) {
    const b = { ...book }, ser0 = { ...book }; // ser0: serie all'apertura
    const synB = `<section class="syn-b" id="s-syn-b"${b.synopsis ? "" : " hidden"}><h3>Trama</h3><p class="synopsis" id="s-syn">${esc(b.synopsis || "")}</p><button class="syn-more" id="s-syn-more" type="button" aria-expanded="false" aria-label="Mostra tutta la trama" hidden>…</button></section>`;
    const colo = `<section class="colo" id="s-colo" data-st="${esc(b.status || "")}" data-isbn="${esc(b.isbn || "")}">
        <div id="s-colo-facts"></div>
        <p id="s-colo-fin"><span class="l1"></span><span class="l2">nella libreria di Diego</span></p>
        <div class="refresh"><button class="btn" id="s-refresh" type="button">Aggiorna informazioni</button><div class="status-line" id="s-ref-status" aria-live="polite"></div></div>
        <details class="edit"><summary>Modifica i dati del libro</summary><div class="inner">
          ${searchBlock(b.title + " " + (b.author || ""))}
          ${dataFields(b)}
          <div class="actions"><button class="btn" id="cv-clear" type="button">${b.cover ? "Usa copertina disegnata" : "Nessuna copertina trovata"}</button></div>
        </div></details>
      </section>`;
    const looks = `<section class="looks"><h3>Sullo scaffale</h3>
        <div class="looks-grid">
          <div class="looks-l">${lookCover(b)}<button class="btn" id="cv-more" type="button">Altra copertina</button></div>
          <div class="looks-r">
            <div class="spine-prev" id="sp-prev">${spineHTML(b, "div")}</div>
            <label class="btn" for="sp-file">${b.spine ? "Cambia foto del dorso" : "Fotografa il dorso"}</label>
            <input type="file" id="sp-file" accept="image/*" hidden>
            <span class="actions"><button class="btn" id="sp-rot" type="button">Ruota</button><button class="btn danger" id="sp-del" type="button">Rimuovi</button></span>
          </div>
        </div>
        <div class="status-line" id="cv-status" aria-live="polite"></div>
        <div class="cover-picks" id="cv-picks" hidden></div>
        <p class="hint">Per il dorso: inquadra solo il dorso, da vicino e con buona luce. Va bene anche in orizzontale: lo raddrizzo io.</p>
      </section>`;
    const nx = snextHTML(b);
    const body = b.status === "desiderato"
      ? `${synB}<div class="wish-box"><p class="hint">Nella lista dei desideri. Quando lo compri:</p><button class="btn primary" id="s-bought" type="button">Ho acquistato: passa a Da leggere</button></div>${colo}${looks}`
      : b.status === "da-leggere" ? `${synB}${readingHead(b, false)}${readingMemo(b)}${colo}${looks}`
      : `${synB}${readingHead(b, false)}${readingMemo(b)}${nx}${colo}${looks}`;
    const sheet = openSheet(`
      <button class="x" id="s-close" type="button" aria-label="Chiudi la scheda">✕</button>
      <header class="sheet-top"><div class="stc">${coverHTML(b)}${rateHTML(b)}</div><div>
        <h2>${esc(b.title)}</h2><div class="sub">${esc(b.author || "Autore sconosciuto")}</div>
        ${b.series ? `<button class="sserie" type="button" data-series>${esc(serLabel(b))}</button>` : ""}
        <div class="kv">${b.callNo ? `<span class="callno">${esc(b.callNo)}</span>` : ""}${b.year ? `<span>${esc(b.year)}</span>` : ""}${b.pages ? `<span>${esc(b.pages)} pp.</span>` : ""}${b.genre ? `<span>${esc(b.genre)}</span>` : ""}</div>
      </div></header>
      <div class="fp-main">${body}</div>
      <div class="sheet-bar"><button class="btn danger" id="s-del">Elimina</button><button class="btn primary" id="s-save">Salva</button></div>`, "book");
    sheet.dataset.st = b.status || "da-leggere"; // il voto si vede solo per i Letto
    wireRating(sheet, b); wirePageCtl(sheet); syncColophon(sheet); synClamp(sheet);
    $("#s-syn-more", sheet).onclick = e => { const o = $("#s-syn", sheet).classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); e.currentTarget.setAttribute("aria-label", o ? "Mostra meno trama" : "Mostra tutta la trama"); e.currentTarget.textContent = o ? "Mostra meno" : "…"; };
    if (!$("#f-status", sheet)) sheet.querySelectorAll("[id^=d-]").forEach(el => el.addEventListener("input", () => syncColophon(sheet))); // Desiderato: niente blocchi della lettura
    wireSearch(sheet, hit => fillData(sheet, hit, b, { keepYear: true }));
    const spPrev = $("#sp-prev", sheet), spRot = $("#sp-rot", sheet), spDel = $("#sp-del", sheet);
    const spSync = () => { spPrev.innerHTML = spineHTML(b, "div"); spRot.hidden = spDel.hidden = !b.spine; };
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
        coverSync(sheet, b);
        spSync(); cvStatus.textContent = "Tocca Salva per tenere questa copertina.";
      });
    };
    cvMore.onclick = async () => {
      if (!navigator.onLine) { cvStatus.textContent = "Serve una connessione per cercare le copertine."; return; }
      cvMore.disabled = true; cvStatus.textContent = "Cerco le copertine…";
      cands = await coverCandidates(b);
      if (b.cover && !cands.some(c => c.cover === b.cover)) cands.unshift({ cover: b.cover, src: "attuale" });
      cvStatus.textContent = cands.length > (b.cover ? 1 : 0) ? "Tocca quella che preferisci." : "Non ho trovato altre copertine: prova a correggere titolo o autore in Modifica i dati del libro.";
      drawPicks(); cvMore.disabled = false; cvMore.textContent = "Cerca di nuovo";
    };
    // Aggiorna informazioni: cerca il libro su tutte le fonti e riempie la scheda; si conferma con Salva.
    const refBtn = $("#s-refresh", sheet), refSt = $("#s-ref-status", sheet);
    refBtn.onclick = async () => {
      if (!navigator.onLine) { refSt.textContent = "Serve una connessione per aggiornare le informazioni."; return; }
      const cur = { ...b }; readData(sheet, cur); // usa titolo e autore come sono ora nei campi
      refBtn.disabled = true; refSt.textContent = "Cerco le informazioni…";
      const errors = {};
      const info0 = await fetchInfo(cur, errors, ISBN_WAIT.length).catch(() => null), info = info0 || {};
      let wdDown = false; // serie scritta a mano con il seguito: niente da cercare
      const sr = cur.seriesManual && cur.seriesNext ? null : await findSeries({ ...cur, author: cur.author || info.author, isbn: cur.isbn || info.isbn }).catch(e => { wdDown = /^wikidata-/.test(e && e.code); return null; });
      const wdNote = wdDown ? " Wikidata non risponde: serie non cercata."
        : !sr && !cur.series ? " Serie: Wikidata non collega questo libro a una serie (se ne fa parte, scrivila in Modifica i dati del libro)." : "";
      refBtn.disabled = false;
      if (!info0 && !sr) {
        const err = Object.keys(errors).join(", ");
        refSt.textContent = `Nessuna informazione trovata${err ? " (" + err + ")" : ""}. Prova a correggere titolo o autore in Modifica i dati del libro.` + wdNote;
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
      if (info.isbn && !b.isbn) { b.isbn = info.isbn; $("#s-colo", sheet).dataset.isbn = b.isbn; got.push("ISBN"); }
      if (info.synopsis && !(b.synopsis || "").includes(info.synopsis)) {
        const head = (b.synopsis || "").split("\n")[0];
        b.synopsis = [/^Titolo originale|^Serie/.test(head) ? head : "", info.synopsis].filter(Boolean).join("\n");
        const syn = $("#s-syn", sheet); syn.textContent = b.synopsis; $("#s-syn-b", sheet).hidden = false; synClamp(sheet); got.push("trama");
      }
      if (sr) { // si tiene con Salva
        const nb = applySeries(cur, sr);
        if (nb.series !== cur.series || nb.seriesNo !== cur.seriesNo) { $("#d-series", sheet).value = b.series = nb.series; $("#d-series-no", sheet).value = b.seriesNo = nb.seriesNo || ""; b.seriesNext = nb.seriesNext; got.push("serie"); }
        if (nb.seriesNext && nb.seriesNext !== b.seriesNext) { b.seriesNext = nb.seriesNext; got.push("seguito"); }
      }
      if (info.cover && info.cover !== b.cover && !b.coverManual) { b.cover = info.cover; delete b.noCover; cvc.disabled = false; got.push("copertina"); }
      coverSync(sheet, { ...b, author: $("#d-author", sheet).value });
      $(".sheet-top .sub", sheet).textContent = $("#d-author", sheet).value || "Autore sconosciuto";
      spSync(); syncPeriod(sheet);
      if (got.some(g => ["autore", "anno", "pagine", "genere", "segnatura", "serie"].includes(g))) $("details.edit", sheet).open = true;
      refSt.textContent = (got.length ? `Aggiornati: ${got.join(", ")}. Tocca Salva per tenerli.` : "Le informazioni sono già aggiornate.") + wdNote;
    };
    const cvc = $("#cv-clear", sheet);
    cvc.disabled = !b.cover;
    cvc.onclick = () => { delete b.cover; b.noCover = true; cvc.disabled = true; coverSync(sheet, b); };
    $("#s-close", sheet).onclick = dismissSheet;
    const ser = $("[data-series]", sheet); // serie → ricerca nella libreria
    if (ser) ser.onclick = () => dismissSheet(() => searchFor(book.series));
    const nxo = $("[data-next-open]", sheet), wn = $("[data-wish-next]", sheet);
    if (nxo) nxo.onclick = () => dismissSheet(() => { const x = state.books.find(y => y.id === nxo.dataset.nextOpen); if (x) openBook(x); });
    if (wn) wn.onclick = () => dismissSheet(() => { // desiderato, poi copertina e dati in sottofondo
      const cur = state.books.find(x => x.id === book.id) || book, get = id => state.books.find(x => x.id === id);
      const id = upsert({ title: wn.dataset.wishNext, author: cur.author, series: cur.series, seriesNo: wn.dataset.no, status: "desiderato", rating: 0 });
      fetchInfo(get(id)).then(h => { const x = get(id); if (x && h && (h.author || h.cover)) { fillInfo(x, h); schedulePersist(); } }).catch(() => {});
      toast("Aggiunto alla lista dei desideri", { label: "Annulla", run: () => removeBook(id) });
    });
    $("#s-save", sheet).onclick = () => {
      if (badYear(sheet) || badDates(sheet)) return;
      readReading(sheet, b); readData(sheet, b);
      const live = state.books.find(x => x.id === b.id); // serie arrivata in sottofondo a scheda aperta: si tiene
      if (live && SER.every(k => (b[k] || "") === (ser0[k] || ""))) SER.forEach(k => { b[k] = live[k]; });
      upsert(b); closeSheet(); toast("Salvato");
    };
    const bought = $("#s-bought", sheet);
    if (bought) bought.onclick = () => { const cur = state.books.find(x => x.id === b.id) || b; closeSheet(); setStatus(cur, "da-leggere"); };
    const del = $("#s-del", sheet);
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Conferma eliminazione"; return; }
      removeBook(b.id); closeSheet(); toast("Libro eliminato");
    };
    guardSheet(sheet, () => $("#s-save", sheet).click(), () => JSON.stringify(b));
  }
  window.libreriaScheda = Object.freeze({ period: periodText, pace: readingPace, paceText });

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
      ${readingHead(b)}${readingMemo(b)}
      <div class="actions"><button class="btn primary" id="a-save">Aggiungi alla libreria</button><button class="btn" id="a-wish" type="button">Lista dei desideri</button><button class="btn ghost" id="a-cancel">Annulla</button></div>`);
    wireRating(sheet, b); wirePageCtl(sheet);
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
    if (!scan) setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || !sheet.contains(a)) $("#s-q", sheet).focus(); }, 50); // non rubo il cursore a un campo già scelto
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

  // La versione del service worker che sta servendo l'app (per capire se l'aggiornamento è arrivato).
  function appVersion() {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return Promise.resolve("");
    return new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = e => res(String(e.data || "")); sw.postMessage("version", [ch.port2]); setTimeout(() => res(""), 1500); });
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
        <div class="actions"><button class="btn" id="i-verify" type="button">Verifica ricerche</button><button class="btn" id="i-series" type="button">Cerca le serie</button></div>
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
      <p class="hint" id="i-ver"></p>
      <div class="actions"><button class="btn ghost" id="i-close">Chiudi</button></div>`);
    appVersion().then(v => { const el = $("#i-ver", sheet); if (el && v) el.textContent = "Versione dell'app: " + v; });
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
    $("#i-series", sheet).onclick = () => {
      if (!navigator.onLine) { st.textContent = "Connettiti per cercare le serie."; return; }
      closeSheet(); seriesJob(); // in sottofondo: la scheda si chiude
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
  window.libreriaSeries = Object.freeze({ sameTitle, seriesKey, findSeries, next: nextInSeries });
  window.libreriaSearch = Object.freeze({ search: searchBooks }); // per diagnosi-serie.html (prova ISBN)
})();
