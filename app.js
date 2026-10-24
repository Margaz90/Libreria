/* Libreria di Diego — PWA
   Dati salvati sul dispositivo (localStorage), ricerca libri e copertine da Google Books e Open Library. */
(() => {
  "use strict";

  const LS_KEY = "libreria-diego-v1";
  const BINDINGS = ["#7E2E2A", "#2D4F45", "#23395B", "#A06A1F", "#4B5563", "#5B3557", "#1F6266", "#9A4A28", "#3F4A2B", "#6B2F3F"];
  const STATUS = { "in-lettura": "In lettura", "letto": "Letti", "da-leggere": "Da leggere", "desiderato": "Lista dei desideri" };
  const STATUS_ONE = { "in-lettura": "In lettura", "letto": "Letto", "da-leggere": "Da leggere", "desiderato": "Desiderato" };
  const FIELDS = ["title", "author", "year", "pages", "genre", "status", "rating", "started", "finished", "notes", "quote", "callNo", "synopsis", "color", "isbn", "cover", "noCover", "spine", "spineRatio", "page", "coverManual", "added", "updated", "spineAt"];
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
    if (out.spine && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(out.spine)) { delete out.spine; delete out.spineRatio; }
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
    const keep = ["status", "title", "author", "rating", "finished", "started", "added", "genre", "page", "pages"];
    if (prev && state.view !== "stats" && data.status !== "in-lettura" && keep.every(k => prev[k] === state.books.find(x => x.id === id)[k])) {
      patchBook(id); renderTally();
    } else render();
    cloudHook("changed", id);
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
  function removeBook(id) {
    const t = getTombs(); t[id] = Date.now(); setTombs(t);
    state.books = state.books.filter(x => x.id !== id); schedulePersist(); render(); cloudHook("removed", id);
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
  async function googleSearch(q, { italian = true, max = 12 } = {}) {
    if (state.googleDown) throw { code: "google-" + state.googleDown };
    const url = "https://www.googleapis.com/books/v1/volumes?printType=books&maxResults=" + max +
      (italian ? "&langRestrict=it" : "") + "&q=" + encodeURIComponent(q);
    let r;
    try { r = await fetch(url); } catch { throw { code: "google-rete" }; }
    if (r.status === 429 || r.status === 403) { state.googleDown = r.status; throw { code: "google-" + r.status }; }
    if (!r.ok) throw { code: "google-" + r.status };
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
  async function searchBooks(q) {
    const errors = []; let out = [];
    const isbn = /^[\d-]{10,17}$/.test(q) ? q.replace(/-/g, "") : "";
    const tries = [
      () => googleSearch(isbn ? "isbn:" + isbn : q),
      () => appleSearch(isbn || q),
      () => openLibrarySearch(isbn ? "isbn:" + isbn : q, "")
    ];
    for (const t of tries) {
      try { out = out.concat(await t()); } catch (e) { errors.push(e && e.code); }
      if (out.filter(x => x.cover).length >= 6) break;
    }
    if (!out.length && errors.length === tries.length) throw { code: errors.join(", ") };
    // Prima le edizioni italiane (l'ordine tra le altre resta quello delle fonti).
    const isIt = x => x.lang === "it" || !!x.ita;
    return out.sort((a, b) => (isIt(b) ? 1 : 0) - (isIt(a) ? 1 : 0)).slice(0, 15);
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
    state.coverJob = { done: 0, total: todo.length, found: 0 };
    const errors = {};
    try {
      for (const b of todo) {
        const hit = await findCover(b, errors);
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
      }
    } finally {
      const { found, done } = state.coverJob; state.coverJob = null;
      persist(); render(); onProgress && onProgress(null);
      const errs = Object.entries(errors).map(([k, n]) => `${k} ×${n}`).join(", ");
      toast(`Copertine trovate: ${found} su ${done}.` + (found < done && errs ? ` Errori: ${errs}.` : ""));
    }
  }

  /* ---------- vista ---------- */
  const SHELF_ORDER = { daleggere: ["da-leggere", "in-lettura", "letto", "desiderato"] }; // con "Da leggere prima" cambia anche l'ordine degli scaffali
  const shelfOrder = () => SHELF_ORDER[state.sort] || Object.keys(STATUS);
  function sorted(list) {
    const recenti = (a, b) => (b.finished || b.started || "").localeCompare(a.finished || a.started || "") || (b.added || 0) - (a.added || 0);
    const rank = st => shelfOrder().indexOf(st);
    const by = {
      recenti,
      daleggere: (a, b) => rank(a.status) - rank(b.status) || recenti(a, b),
      autore: (a, b) => (surname3(a.author) + a.author).localeCompare(surname3(b.author) + b.author, "it") || (a.year || 0) - (b.year || 0),
      titolo: (a, b) => a.title.localeCompare(b.title, "it"),
      voto: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, "it")
    }[state.sort];
    // I libri in lettura vengono sempre per primi, qualunque sia l'ordine scelto.
    return [...list].sort((a, b) => (b.status === "in-lettura") - (a.status === "in-lettura") || by(a, b));
  }
  function visible() {
    const q = norm(state.q);
    return q ? state.books.filter(b => norm(b.title + " " + (b.author || "") + " " + (b.genre || "")).includes(q)) : state.books;
  }

  // Le copertine scaricate sono grandi (fino a 600x900): per dorsi e griglia ne chiedo una versione piccola.
  function thumb(url, w) {
    if (!url) return url;
    if (/mzstatic\.com/.test(url)) return url.replace(/\/\d+x\d+bb\./, `/${w}x${Math.round(w * 1.5)}bb.`);
    if (/covers\.openlibrary\.org/.test(url)) return url.replace(/-L\.jpg/, w <= 180 ? "-M.jpg" : "-L.jpg");
    return url;
  }
  function coverHTML(b, w = 300) {
    const c = colorOf(b);
    const pat = ["repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 2px, transparent 2px 12px)",
                 "radial-gradient(circle at 70% 30%, rgba(255,255,255,.14) 0 18%, transparent 19%)",
                 "repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 9px)",
                 "linear-gradient(160deg, rgba(255,255,255,.12), transparent 55%)"][hash(b.genre || b.title) % 4];
    const img = b.cover ? `<img src="${esc(thumb(b.cover, w))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('photo');this.remove()">` : "";
    return `<div class="cover${b.cover ? " photo" : ""}" style="background:${c}"><div class="pat" style="background:${pat}"></div>
      <div class="ct">${esc(b.title)}</div><div class="ca">${esc(b.author || "")}</div>${img}</div>`;
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
    return done >= expected ? `In linea · ne mancano ${left}` : `Ne mancano ${left} · circa ${perMonth} al mese`;
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
  function spineHTML(b, tag = "button") {
    const p = Math.min(Number(b.pages) || 280, 900);
    const h = Math.round(132 + p / 900 * 72);
    let w = Math.round(26 + p / 900 * 24);
    const attrs = tag === "button" ? `data-id="${esc(b.id)}" aria-label="${esc(b.title)} di ${esc(b.author || "")}"` : `aria-hidden="true"`;
    const last = String(b.author || "").trim().split(/\s+/).pop() || "";
    if (b.spine) {
      if (b.spineRatio) w = Math.max(16, Math.min(80, Math.round(h * b.spineRatio)));
      return `<${tag} class="spine photo" ${attrs} style="height:${h}px;width:${w}px;background-image:url('${b.spine}')"><span class="gloss"></span></${tag}>`;
    }
    const text = `<span class="t">${esc(b.title)}</span><span class="au">${esc(last)}</span>`;
    if (b.cover) {
      return `<${tag} class="spine fromcover" ${attrs} style="height:${h}px;width:${w}px;background:${colorOf(b)}">
        <img src="${esc(thumb(b.cover, 120))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('fromcover');this.remove()"><span class="shade"></span>${text}</${tag}>`;
    }
    return `<${tag} class="spine" ${attrs} style="height:${h}px;width:${w}px;background:${colorOf(b)}">
      <span class="band a"></span>${text}<span class="band b"></span></${tag}>`;
  }

  function progressOf(b) {
    const tot = Number(b.pages) || 0, pg = Math.max(0, Number(b.page) || 0);
    return { tot, pg, pct: tot ? Math.min(100, Math.round(pg / tot * 100)) : 0 };
  }
  // Sezione in alto con i libri in lettura (sempre visibile con "Tutti" e "In lettura", in entrambe le viste).
  function renderHero() {
    const hero = $("#hero");
    const reading = sorted(state.books.filter(b => b.status === "in-lettura"));
    const show = reading.length && (state.filter === "tutti" || state.filter === "in-lettura") && state.view === "libreria";
    hero.hidden = !show;
    if (!show) { hero.innerHTML = ""; return; }
    hero.innerHTML = `<h2 class="hero-h">In lettura <span>${reading.length} ${reading.length === 1 ? "libro" : "libri"}</span></h2>${readingCards(reading)}`;
    wireMain(hero);
  }
  function readingCards(books) {
    if (!books.length) return "";
    return `<div class="reading">${books.map(b => {
      const { tot, pg, pct } = progressOf(b);
      return `<article class="rcard">
        <button class="rcover" data-id="${esc(b.id)}" aria-label="Apri ${esc(b.title)}">${coverHTML(b)}</button>
        <div class="rbody">
          <h3>${esc(b.title)}</h3><p class="hint">${esc(b.author || "")}</p>
          <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
          <div class="prow">
            <label class="pin">pag. <input type="number" inputmode="numeric" min="0" ${tot ? `max="${tot}"` : ""} value="${pg || ""}" placeholder="0" data-page="${esc(b.id)}" aria-label="Pagina attuale di ${esc(b.title)}"></label>
            <span class="hint">${tot ? `di ${tot} · ${pct}%` : "pagine totali non note"}</span>
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
    return `<section class="shelf-block" data-shelf="${st}"><div class="shelf-head"><h2>${STATUS[st]}</h2><span>${all.length} ${all.length === 1 ? "volume" : "volumi"}</span></div>
      ${st === "in-lettura" ? readingCards(books) : ""}
      ${st === "in-lettura" && books.length ? "" : `<div class="row">${spines || `<div class="empty-shelf">${st === "in-lettura" ? "Nessun libro in lettura. Tieni premuto un dorso per iniziarne uno." : st === "desiderato" ? "Nessun desiderio. Con + Libro puoi salvare un libro nella lista dei desideri." : "Scaffale vuoto."}</div>`}</div>`}
      ${moreBtn}</section>`;
  }
  function setStatus(b, st) {
    const nb = { ...b, status: st };
    if (st === "letto" && !nb.finished) nb.finished = today();
    if (st === "in-lettura" && !nb.started) nb.started = today();
    if (st === "letto" && nb.pages) nb.page = nb.pages;
    upsert(nb);
    toast(`Spostato in ${STATUS[st]}`);
  }

  function cardHTML(b) {
    return `<button class="card" data-id="${esc(b.id)}" aria-label="${esc(b.title)} di ${esc(b.author || "")}">${coverHTML(b, 300)}
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

  function renderStats(list) {
    const read = list.filter(b => b.status === "letto");
    const pages = read.reduce((s, b) => s + (Number(b.pages) || 0), 0);
    const rated = read.filter(b => b.rating > 0);
    const avg = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0;
    const years = {}; read.forEach(b => { const y = yearOf(b.finished); if (y) years[y] = (years[y] || 0) + 1; });
    const ys = Object.keys(years).map(Number).sort((a, b) => a - b).slice(-8);
    const max = Math.max(1, ...ys.map(y => years[y]));
    const count = key => { const m = {}; read.forEach(b => { if (b[key]) m[b[key]] = (m[b[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6); };
    const undated = read.filter(b => !b.finished).length;
    const bars = ys.length ? `<div class="bars">${ys.map(y => `<div class="bar"><em>${years[y]}</em><i style="height:${Math.round(years[y] / max * 100)}%"></i></div>`).join("")}</div>
      <div class="bar-labels">${ys.map(y => `<span>${y}</span>`).join("")}</div>` : "";
    const li = rows => rows.map(([a, n]) => `<li><span>${esc(a)}</span><span>${n}</span></li>`).join("") || `<li><span class="hint">Ancora nessun dato</span></li>`;
    return `<div class="stats">
      <section class="panel"><h3>In sintesi</h3><div class="figures">
        <div class="fig"><b>${read.length}</b><span>libri letti</span></div>
        <div class="fig"><b>${pages >= 10000 ? Math.round(pages / 1000) + "k" : pages.toLocaleString("it-IT")}</b><span>pagine</span></div>
        <div class="fig"><b>${avg ? avg.toFixed(1).replace(".", ",") : "–"}</b><span>voto medio</span></div></div></section>
      <section class="panel"><h3>Libri finiti per anno</h3>${bars}${undated ? `<p class="hint">${undated} libri letti non hanno una data di fine: aggiungila dalla scheda del libro per vederli qui.</p>` : ""}</section>
      <section class="panel"><h3>Autori più letti</h3><ul class="list">${li(count("author"))}</ul></section>
      <section class="panel"><h3>Generi</h3><ul class="list">${li(count("genre"))}</ul></section>
    </div>`;
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
    if (state.view === "stats") main.innerHTML = renderStats(state.books); // la ricerca non vale qui: la sua barra è nascosta
    else {
      const list = visible().filter(b => state.filter === "tutti" || b.status === state.filter);
      if (state.mode === "dorsi") main.innerHTML = renderShelves(visible()); // gli scaffali da mostrare li sceglie renderShelves
      else main.innerHTML = list.length ? renderCovers(list) : `<p class="hint">${state.q.trim() ? "Nessun libro corrisponde alla ricerca." : "Nessun libro in questo scaffale."}</p>`;
    }
    $("#toolbar").hidden = state.view === "stats";
    wireMain(main);
  }
  function wireMain(root) {
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
      upsert({ ...b, page: b.pages ? Math.min(v, b.pages) : v });
    });
    root.querySelectorAll("[data-finish]").forEach(btn => btn.onclick = () => { const b = state.books.find(x => x.id === btn.dataset.finish); if (b) setStatus(b, "letto"); });
  }
  // Modifiche arrivate dal cloud: aggiorno solo le parti che cambiano, senza ridisegnare tutta la pagina (niente sfarfallio).
  // list = [{ id, from, to, moved, added }]: from/to sono lo stato prima e dopo, moved se cambia qualcosa che sposta il libro.
  function refreshChanged(list) {
    if (!list.length) return;
    schedulePersist(); // i dati ricevuti vanno salvati sul dispositivo in ogni caso
    if (list.some(x => x.from === "in-lettura" || x.to === "in-lettura" || x.removed)) renderHero();
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
      <div class="actions"><button class="btn" id="q-open">Apri la scheda</button><button class="btn ghost" id="q-close">Chiudi</button></div></div>`);
    sheet.querySelectorAll("[data-st]").forEach(btn => btn.onclick = () => { closeSheet(); setStatus(b, btn.dataset.st); });
    $("#q-open", sheet).onclick = () => { closeSheet(); openBook(b); };
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
  function dismissSheet() {
    const sheet = $("#layer .sheet");
    if (!sheet || !sheetGuard || !sheetGuard.dirty()) { closeSheet(); return; }
    let bar = $(".unsaved", sheet);
    if (!bar) {
      bar = document.createElement("div"); bar.className = "unsaved"; bar.setAttribute("role", "alert");
      bar.innerHTML = `<span>Hai modifiche non salvate.</span><span class="actions"><button class="btn primary" type="button" data-u="save">Salva</button><button class="btn danger" type="button" data-u="drop">Scarta</button><button class="btn ghost" type="button" data-u="back">Continua</button></span>`;
      bar.onclick = e => {
        const u = e.target.dataset && e.target.dataset.u; if (!u) return;
        if (u === "drop") closeSheet();
        else if (u === "back") bar.remove();
        else { bar.remove(); sheetGuard.save(); }
      };
      sheet.append(bar);
    }
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
        <div class="field"><label for="f-finished">Finito il</label><input id="f-finished" type="date" value="${esc(b.finished || "")}"></div>
      </div>
      <div class="field"><label for="f-page">Pagina attuale</label><input id="f-page" type="number" inputmode="numeric" min="0" value="${esc(b.page || "")}" placeholder="${b.pages ? "su " + b.pages : ""}"></div>
      <div class="field"><label for="f-notes">Note</label><textarea id="f-notes" placeholder="Cosa ti è rimasto di questo libro?">${esc(b.notes || "")}</textarea></div>
      <div class="field"><label for="f-quote">Citazione preferita</label><textarea id="f-quote" placeholder="Una frase da ricordare">${esc(b.quote || "")}</textarea></div>`;
  }
  function dataFields(b) {
    return `
      <div class="field"><label for="d-title">Titolo</label><input id="d-title" value="${esc(b.title || "")}" autocomplete="off"></div>
      <div class="field"><label for="d-author">Autore</label><input id="d-author" value="${esc(b.author || "")}" autocomplete="off"></div>
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
      });
      requestAnimationFrame(sync);
    }
    sheet.querySelectorAll("#f-rate button").forEach(btn => btn.onclick = () => {
      const n = Number(btn.dataset.n); holder.rating = holder.rating === n ? 0 : n;
      sheet.querySelectorAll("#f-rate button").forEach(x => x.classList.toggle("on", Number(x.dataset.n) <= holder.rating));
    });
  }
  function readReading(sheet, b) {
    if (!$("#f-status", sheet)) return; // un libro nella lista dei desideri non ha campi di lettura
    b.status = $("#f-status", sheet).value;
    b.started = $("#f-started", sheet).value; b.finished = $("#f-finished", sheet).value;
    b.notes = $("#f-notes", sheet).value.trim(); b.quote = $("#f-quote", sheet).value.trim();
    const pg = parseInt($("#f-page", sheet).value, 10); b.page = pg >= 0 ? pg : undefined;
    if (b.status === "letto" && !b.finished) b.finished = today();
  }
  function readData(sheet, b) {
    b.title = $("#d-title", sheet).value.trim() || b.title;
    b.author = $("#d-author", sheet).value.trim();
    b.year = parseInt($("#d-year", sheet).value, 10) || undefined;
    b.pages = parseInt($("#d-pages", sheet).value, 10) || undefined;
    b.genre = $("#d-genre", sheet).value.trim();
    b.callNo = $("#d-call", sheet).value.trim().toUpperCase();
  }
  function fillData(sheet, hit, b, { keepYear = false } = {}) {
    if (hit.title) $("#d-title", sheet).value = hit.title;
    if (hit.author) $("#d-author", sheet).value = hit.author;
    if (!keepYear && hit.edYear && !$("#d-year", sheet).value) $("#d-year", sheet).value = hit.edYear;
    if (hit.pages) $("#d-pages", sheet).value = hit.pages;
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
    let results = [];
    const go = async () => {
      const q = input.value.trim(); if (!q) { status.textContent = "Scrivi un titolo, un autore o un ISBN."; return; }
      if (!navigator.onLine) { status.textContent = "Sei offline: compila i campi a mano."; return; }
      status.textContent = "Cerco tra le edizioni italiane…"; box.innerHTML = "";
      try {
        results = await searchBooks(q);
        status.textContent = results.length ? "Tocca l'edizione giusta per usarne i dati." : "Nessun risultato: prova con meno parole o compila a mano.";
        box.innerHTML = results.map((r, i) => `<button class="result" type="button" data-i="${i}">
          ${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg"></span>`}
          <div><b>${esc(r.title)}</b><span>${esc(r.author || "Autore sconosciuto")}${r.edYear ? " · " + r.edYear : ""}${r.pages ? " · " + r.pages + " pp." : ""}${r.lang && r.lang !== "it" ? " · " + r.lang.toUpperCase() : ""}</span></div></button>`).join("");
        box.querySelectorAll(".result").forEach(el => el.onclick = () => { onPick(results[Number(el.dataset.i)]); box.innerHTML = ""; status.textContent = "Dati inseriti: controllali prima di salvare."; });
      } catch (e) {
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
        <div class="kv">${b.callNo ? `<span class="callno">${esc(b.callNo)}</span>` : ""}${b.year ? `<span>${esc(b.year)}</span>` : ""}${b.pages ? `<span>${esc(b.pages)} pp.</span>` : ""}${b.genre ? `<span>${esc(b.genre)}</span>` : ""}</div>
        ${b.finished ? `<p class="hint">Finito il ${fmtDate(b.finished)}</p>` : ""}
      </div></div>
      ${b.synopsis ? `<p class="synopsis">${esc(b.synopsis)}</p>` : ""}
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
    const cvc = $("#cv-clear", sheet);
    cvc.disabled = !b.cover;
    cvc.onclick = () => { delete b.cover; b.noCover = true; cvc.disabled = true; const p = $(".sheet-top .cover", sheet); if (p) p.outerHTML = coverHTML(b); };
    $("#s-close", sheet).onclick = dismissSheet;
    $("#s-save", sheet).onclick = () => { readReading(sheet, b); readData(sheet, b); upsert(b); closeSheet(); toast("Salvato"); };
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
      readData(sheet, b);
      if (!$("#d-title", sheet).value.trim()) { $("#s-status", sheet).textContent = "Il titolo è obbligatorio."; $("#d-title", sheet).focus(); return; }
      readReading(sheet, b);
      if (state.books.some(x => keyOf(x) === keyOf(b))) { toast("Questo libro è già nella libreria."); return; }
      upsert(b); closeSheet(); toast("Aggiunto alla libreria");
    };
    $("#a-wish", sheet).onclick = () => {
      readData(sheet, b);
      if (!$("#d-title", sheet).value.trim()) { $("#s-status", sheet).textContent = "Il titolo è obbligatorio."; $("#d-title", sheet).focus(); return; }
      if (state.books.some(x => keyOf(x) === keyOf(b))) { toast("Questo libro è già nella libreria."); return; }
      b.status = "desiderato";
      upsert(b); closeSheet(); toast("Aggiunto alla lista dei desideri");
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
        <button type="button" data-m="goal"><b>Obiettivo ${y}</b><span>${goal ? `${done} di ${goal} libri` : "Non ancora fissato"}</span></button>
        <button type="button" data-m="backup" class="${backupDue() ? "due" : ""}"><b>Backup, importa e copertine</b><span>${days === null ? "Nessun backup ancora" : days === 0 ? "Ultimo backup: oggi" : `Ultimo backup: ${days} ${days === 1 ? "giorno" : "giorni"} fa`}${missing ? ` · ${missing} senza copertina` : ""}</span></button>
        <button type="button" data-m="sync"><b>Accedi e sincronizza</b><span>${cloud.email ? "Collegato come " + esc(cloud.email) : "La stessa libreria su iPhone, iPad e computer"}</span></button>
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
    tally: () => renderTally(),
    status(msg) { const el = $("#sy-status"); if (el) el.textContent = msg; },
    error(msg) { const el = $("#sy-status"); if (el) el.textContent = msg; const info = $("#sy-info"); if (info) info.textContent = msg; else toast(msg); },
    done(msg) { if ($("#sy-status")) closeSheet(); toast(msg); },
    connected(email) { cloud.email = email || ""; },
    goals: () => ({ goals: getSet().goals || {}, updated: getSet().goalsAt || 0 }),
    setGoals(goals, updated) { try { localStorage.setItem(SET_KEY, JSON.stringify({ ...getSet(), goals, goalsAt: updated })); } catch {} },
    info(text) { const el = $("#sy-info"); if (el) el.textContent = text; },
    askMerge
  };
  function openSync() {
    if (cloud.email) return openSyncDone();
    const sheet = openSheet(`<h2>Accedi e sincronizza</h2>
      <p class="hint">La libreria diventa la stessa su iPhone, iPad e computer. Funziona anche offline: le modifiche partono appena torna la rete.</p>
      <div class="actions"><button class="btn primary" id="sy-google" disabled>Accedi con Google</button></div>
      <div class="field"><label for="sy-email">Oppure con un link via email (senza password)</label><input id="sy-email" type="email" autocomplete="email" inputmode="email" placeholder="tua@email.it" value="${esc(cloudInfo().lastEmail || "")}"></div>
      <div class="actions"><button class="btn" id="sy-link" disabled>Invia il link</button></div>
      <div class="field"><label for="sy-paste">Hai ricevuto il link? Copialo (tieni premuto, poi Copia) e incollalo qui senza aprirlo</label><input id="sy-paste" type="url" autocomplete="off" placeholder="https://…"></div>
      <div class="actions"><button class="btn" id="sy-paste-go" disabled>Accedi con il link</button></div>
      <div class="status-line" id="sy-status" aria-live="polite">Preparo l'accesso…</div>
      <div class="actions"><button class="btn ghost" id="sy-close">Chiudi</button></div>`);
    const st = msg => { $("#sy-status", sheet).textContent = msg; };
    $("#sy-close", sheet).onclick = closeSheet;
    loadCloud().then(() => {
      ["#sy-google", "#sy-link", "#sy-paste-go"].forEach(sel => { $(sel, sheet).disabled = false; });
      st("");
    }).catch(() => st("Non riesco a caricare il servizio. Controlla la connessione e riprova."));
    // Il clic su Google deve partire subito (il browser blocca le finestre aperte dopo): per questo il servizio si carica quando la scheda si apre.
    $("#sy-google", sheet).onclick = () => {
      st("Apro l'accesso con Google…");
      window.libreriaCloud.signInGoogle().catch(e => st("Accesso non riuscito (" + ((e && e.code) || "errore") + ")."));
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
    const sheet = openSheet(`
      <h2>Backup e copertine</h2>
      <section class="arch">
        <span class="label">Backup</span>
        <p class="${backupDue() ? "warn" : "hint"}">${days === null ? "Non hai ancora fatto un backup." : days === 0 ? "Ultimo backup: oggi." : `Ultimo backup: ${days} ${days === 1 ? "giorno" : "giorni"} fa.`} I dati stanno solo su questo iPhone: esportalo ogni tanto in File o iCloud.</p>
        <div class="actions"><button class="btn primary" id="i-export">Esporta backup</button></div>
      </section>
      <section class="arch">
        <span class="label">Copertine</span>
        <p class="hint">${missing ? `${missing} libri senza copertina.` : "Tutti i libri hanno una copertina o hai scelto quella disegnata."}</p>
        <div class="actions">${missing ? `<button class="btn" id="i-covers">Cerca copertine mancanti</button>` : ""}<button class="btn" id="i-redo">Rifai tutte preferendo le edizioni italiane</button></div>
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
    let pending = [], counts = { fresh: 0, dup: 0 };
    const st = $("#i-status", sheet), go = $("#i-go", sheet), upd = $("#i-upd", sheet);
    const showCounts = () => {
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
    $("#i-export", sheet).onclick = () => state.books.length ? exportBackup(st) : (st.textContent = "La libreria è vuota: niente da esportare.");
    $("#i-file", sheet).onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const txt = String(rd.result);
          if (/\.json$/i.test(f.name) || txt.trim().startsWith("{") || txt.trim().startsWith("[")) { const j = JSON.parse(txt); pending = Array.isArray(j) ? j : (j.books || []); }
          else pending = fromGoodreads(txt);
          const known = new Set(state.books.map(keyOf));
          const valid = pending.filter(b => b && b.title);
          counts = { fresh: valid.filter(b => !known.has(keyOf(b))).length, dup: valid.filter(b => known.has(keyOf(b))).length };
          showCounts();
        } catch { pending = []; go.disabled = true; st.textContent = "File non leggibile. Usa un backup JSON o il CSV di Goodreads."; }
      };
      rd.readAsText(f);
    };
    go.onclick = () => {
      const { added, updated } = addMany(pending, { update: upd.checked }); pending = []; go.disabled = true;
      st.textContent = `Importati ${added} libri` + (updated ? `, aggiornati ${updated}` : "") + ".";
    };
  }

  /* ---------- avvio ---------- */
  function swapIn() { const main = $("#main"); main.classList.remove("swap"); void main.offsetWidth; main.classList.add("swap"); }
  function setView(v) { state.view = v; resetLimits(); document.body.classList.remove("bars-off"); swapIn(); render(); window.scrollTo({ top: 0 }); }
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
    if ($("#scrim") || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
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
      <span class="pk-st">${b.status === "in-lettura" && tot ? `In lettura · ${pct}%` : STATUS_ONE[b.status]}${b.finished && b.status === "letto" ? " · " + fmtDate(b.finished) : ""}</span></div>`;
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
        const offer = w => toast("Nuova versione disponibile.", { label: "Aggiorna", run: () => w.postMessage("skip-waiting") });
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
})();
