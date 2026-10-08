/* Libreria di Diego — PWA
   Dati salvati sul dispositivo (localStorage), ricerca libri e copertine da Google Books e Open Library. */
(() => {
  "use strict";

  const LS_KEY = "libreria-diego-v1";
  const BINDINGS = ["#7E2E2A", "#2D4F45", "#23395B", "#A06A1F", "#4B5563", "#5B3557", "#1F6266", "#9A4A28", "#3F4A2B", "#6B2F3F"];
  const STATUS = { "in-lettura": "In lettura", "letto": "Letti", "da-leggere": "Da leggere" };
  const STATUS_ONE = { "in-lettura": "In lettura", "letto": "Letto", "da-leggere": "Da leggere" };
  const FIELDS = ["title", "author", "year", "pages", "genre", "status", "rating", "started", "finished", "notes", "quote", "callNo", "synopsis", "color", "isbn", "cover", "noCover", "spine", "spineRatio", "added"];
  const GENRES_EN = { "Fiction": "Narrativa", "Biography & Autobiography": "Biografia", "History": "Storia", "Science": "Scienza", "Juvenile Fiction": "Ragazzi", "Young Adult Fiction": "Ragazzi", "True Crime": "True crime", "Poetry": "Poesia", "Philosophy": "Filosofia", "Business & Economics": "Economia", "Travel": "Viaggi", "Psychology": "Psicologia", "Comics & Graphic Novels": "Fumetti", "Cooking": "Cucina", "Religion": "Religione", "Political Science": "Politica", "Self-Help": "Crescita personale", "Social Science": "Scienze sociali", "Literary Criticism": "Saggistica", "Music": "Musica", "Sports & Recreation": "Sport", "Art": "Arte", "Drama": "Teatro" };

  const state = { books: [], view: "scaffale", q: "", sort: "recenti", coverJob: null };

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

  /* ---------- archivio sul dispositivo ---------- */
  function load() {
    try { const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.books)); return true; }
    catch { toast("Spazio esaurito sul dispositivo: esporta un backup ed elimina qualche libro."); return false; }
  }
  function clean(b) {
    const out = {};
    for (const k of FIELDS) if (b[k] !== undefined && b[k] !== null && b[k] !== "") out[k] = b[k];
    out.title = String(out.title || "Senza titolo");
    out.status = STATUS_ONE[out.status] ? out.status : "da-leggere";
    if (out.year) out.year = Number(out.year) || undefined;
    if (out.pages) out.pages = Number(out.pages) || undefined;
    out.rating = Math.max(0, Math.min(5, Number(out.rating) || 0));
    if (!out.added) out.added = Date.now();
    return out;
  }
  function upsert(b) {
    const data = clean(b);
    if (b.id) {
      const i = state.books.findIndex(x => x.id === b.id);
      if (i >= 0) state.books[i] = { ...data, id: b.id }; else state.books.push({ ...data, id: b.id });
    } else state.books.push({ ...data, id: newId() });
    persist(); render();
  }
  function addMany(list) {
    const known = new Set(state.books.map(keyOf));
    let added = 0, skipped = 0;
    for (const raw of list) {
      if (!raw || !raw.title) continue;
      if (known.has(keyOf(raw))) { skipped++; continue; }
      const b = { ...clean(raw), id: newId() }; state.books.push(b); known.add(keyOf(b)); added++;
    }
    persist(); render();
    return { added, skipped };
  }
  function removeBook(id) { state.books = state.books.filter(x => x.id !== id); persist(); render(); }

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
      isbn, cover, lang: i.language || ""
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
      isbn: "", lang: "it",
      cover: r.artworkUrl100 ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x900bb.") : ""
    })).filter(x => x.title);
  }

  // --- fonte 3: Open Library ---
  async function openLibrarySearch(title, author, max = 8) {
    const url = "https://openlibrary.org/search.json?limit=" + max + "&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,language" +
      "&title=" + encodeURIComponent(title) + (author ? "&author=" + encodeURIComponent(author) : "");
    let r;
    try { r = await fetch(url); } catch { throw { code: "openlibrary-rete" }; }
    if (!r.ok) throw { code: "openlibrary-" + r.status };
    const j = await r.json();
    return (j.docs || []).map(d => ({
      title: d.title || "", author: (d.author_name || []).join(", "),
      edYear: d.first_publish_year, pages: d.number_of_pages_median, genre: "", synopsis: "",
      isbn: (d.isbn || [])[0] || "", lang: (d.language || []).includes("ita") ? "it" : "",
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
      () => isbn ? Promise.resolve([]) : appleSearch(q),
      () => isbn ? Promise.resolve([]) : openLibrarySearch(q, "")
    ];
    for (const t of tries) {
      try { out = out.concat(await t()); } catch (e) { errors.push(e && e.code); }
      if (out.filter(x => x.cover).length >= 6) break;
    }
    if (!out.length && errors.length === tries.length) throw { code: errors.join(", ") };
    return out.slice(0, 15);
  }

  function originalTitle(b) {
    const m = /Titolo originale: (.+?)\.(?:\s|$)/.exec(b.synopsis || "");
    return m && !/nessuna edizione/.test(m[1]) ? m[1] : "";
  }
  async function findCover(b, errors) {
    const last = String(b.author || "").split(/\s+/).pop();
    const orig = originalTitle(b);
    const pick = list => list.find(x => x.cover && sameAuthor(b.author, x.author));
    const attempts = [
      () => appleSearch(`${b.title} ${last}`, 8),
      () => googleSearch(`intitle:"${b.title}"` + (last ? ` inauthor:${last}` : ""), { max: 6 }),
      () => openLibrarySearch(b.title, last),
      () => orig ? googleSearch(`intitle:"${orig}"` + (last ? ` inauthor:${last}` : ""), { italian: false, max: 6 }) : Promise.resolve([]),
      () => orig ? openLibrarySearch(orig, last) : Promise.resolve([])
    ];
    for (const a of attempts) {
      try { const hit = pick(await a()); if (hit) return hit; }
      catch (e) { if (e && e.code) errors[e.code] = (errors[e.code] || 0) + 1; }
      await sleep(150);
    }
    return null;
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
    // alterna le fonti, così compaiono edizioni diverse
    const bySrc = {}; all.filter(x => x.cover && sameAuthor(b.author, x.author)).forEach(x => (bySrc[x.src] = bySrc[x.src] || []).push(x));
    const queues = Object.values(bySrc);
    while (out.length < 6 && queues.some(q => q.length)) {
      for (const q of queues) { const x = q.shift(); if (x && !seen.has(x.cover)) { seen.add(x.cover); out.push(x); } if (out.length >= 6) break; }
    }
    return out;
  }

  async function runCoverJob(onProgress) {
    if (state.coverJob) return;
    if (!navigator.onLine) { toast("Serve una connessione per cercare le copertine."); return; }
    const todo = state.books.filter(b => !b.cover && !b.noCover);
    if (!todo.length) { toast("Tutti i libri hanno già una copertina."); return; }
    state.coverJob = { done: 0, total: todo.length, found: 0 };
    const errors = {};
    try {
      for (const b of todo) {
        const hit = await findCover(b, errors);
        const cur = state.books.find(x => x.id === b.id);
        if (cur && hit) {
          cur.cover = hit.cover; if (!cur.isbn && hit.isbn) cur.isbn = hit.isbn; if (!cur.pages && hit.pages) cur.pages = hit.pages;
          state.coverJob.found++;
        }
        state.coverJob.done++;
        if (state.coverJob.done % 5 === 0) { persist(); render(); }
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
  function sorted(list) {
    const by = {
      recenti: (a, b) => (b.finished || b.started || "").localeCompare(a.finished || a.started || "") || (b.added || 0) - (a.added || 0),
      autore: (a, b) => (surname3(a.author) + a.author).localeCompare(surname3(b.author) + b.author, "it") || (a.year || 0) - (b.year || 0),
      titolo: (a, b) => a.title.localeCompare(b.title, "it"),
      voto: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, "it")
    }[state.sort];
    return [...list].sort(by);
  }
  function visible() {
    const q = state.q.trim().toLowerCase();
    return q ? state.books.filter(b => (b.title + " " + (b.author || "") + " " + (b.genre || "")).toLowerCase().includes(q)) : state.books;
  }

  function coverHTML(b) {
    const c = colorOf(b);
    const pat = ["repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 2px, transparent 2px 12px)",
                 "radial-gradient(circle at 70% 30%, rgba(255,255,255,.14) 0 18%, transparent 19%)",
                 "repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 9px)",
                 "linear-gradient(160deg, rgba(255,255,255,.12), transparent 55%)"][hash(b.genre || b.title) % 4];
    const img = b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
    return `<div class="cover" style="background:${c}"><div class="pat" style="background:${pat}"></div>
      <div class="ct">${esc(b.title)}</div><div class="ca">${esc(b.author || "")}</div>${img}</div>`;
  }

  function renderTally() {
    const read = state.books.filter(b => b.status === "letto");
    const y = new Date().getFullYear();
    const pages = read.reduce((s, b) => s + (Number(b.pages) || 0), 0);
    $("#tally").innerHTML = `<span><b>${read.length}</b> letti</span><span><b>${read.filter(b => yearOf(b.finished) === y).length}</b> nel ${y}</span>` +
      `<span><b>${pages.toLocaleString("it-IT")}</b> pagine</span><span><b>${state.books.filter(b => b.status === "in-lettura").length}</b> in lettura</span>`;
  }

  function renderNotice() {
    const n = $("#notice");
    if (!state.books.length) {
      n.innerHTML = `<div class="notice"><span><strong>La libreria è vuota.</strong> Carica i 108 libri importati da Goodreads, oppure un backup esportato dal prototipo.</span>
        <span class="actions"><button class="btn primary" id="seed-go">Carica i libri Goodreads</button><button class="btn" id="open-import">Altre opzioni</button></span></div>`;
      $("#seed-go").onclick = loadSeed;
    } else {
      const missing = state.books.filter(b => !b.cover && !b.noCover).length;
      n.innerHTML = `<div class="notice"><span>${missing ? `<strong>${missing} libri senza copertina.</strong>` : "Libreria salvata su questo dispositivo."}</span>
        <span class="actions">${missing && !state.coverJob ? `<button class="btn" id="covers-go">Cerca copertine</button>` : ""}<button class="btn" id="open-import">Importa / esporta</button></span></div>`;
      const cg = $("#covers-go"); if (cg) cg.onclick = () => { cg.disabled = true; cg.textContent = "Cerco…"; runCoverJob(p => { if (p && cg.isConnected) cg.textContent = `${p.done}/${p.total}`; }); };
    }
    $("#open-import").onclick = openImport;
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
        <img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('fromcover');this.remove()"><span class="shade"></span>${text}</${tag}>`;
    }
    return `<${tag} class="spine" ${attrs} style="height:${h}px;width:${w}px;background:${colorOf(b)}">
      <span class="band a"></span>${text}<span class="band b"></span></${tag}>`;
  }

  function renderShelves(list) {
    return Object.keys(STATUS).map(st => {
      const books = sorted(list.filter(b => b.status === st));
      const spines = books.map(b => spineHTML(b)).join("");
      return `<section class="shelf-block"><div class="shelf-head"><h2>${STATUS[st]}</h2><span>${books.length} ${books.length === 1 ? "volume" : "volumi"}</span></div>
        <div class="row">${spines || `<div class="empty-shelf">Scaffale vuoto.</div>`}</div></section>`;
    }).join("");
  }

  function renderCovers(list) {
    return `<div class="covers">${sorted(list).map(b => `<button class="card" data-id="${esc(b.id)}">${coverHTML(b)}
      <div class="ttl">${esc(b.title)}</div>
      <div class="meta"><span class="stars">${starStr(b.rating || 0) || STATUS_ONE[b.status] || ""}</span><span class="callno">${esc(b.callNo || "")}</span></div></button>`).join("")}</div>`;
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

  function render() {
    renderTally(); renderNotice();
    const list = visible(), main = $("#main");
    if (state.view === "scaffale") main.innerHTML = renderShelves(list);
    else if (state.view === "copertine") main.innerHTML = list.length ? renderCovers(list) : `<p class="hint">Nessun libro corrisponde alla ricerca.</p>`;
    else main.innerHTML = renderStats(list);
    $("#searchbar").hidden = state.view === "stats";
    main.querySelectorAll("[data-id]").forEach(el => el.onclick = () => { const b = state.books.find(x => x.id === el.dataset.id); if (b) openBook(b); });
  }

  /* ---------- schede ---------- */
  let lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const layer = $("#layer");
    layer.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    $("#scrim").onclick = e => { if (e.target.id === "scrim") closeSheet(); };
    document.addEventListener("keydown", escClose);
    document.body.style.overflow = "hidden";
    return $(".sheet", layer);
  }
  function escClose(e) { if (e.key === "Escape") closeSheet(); }
  function closeSheet() {
    $("#layer").innerHTML = ""; document.removeEventListener("keydown", escClose); document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function readingFields(b) {
    return `
      <div class="grid2">
        <div class="field"><label for="f-status">Stato</label><select id="f-status">
          ${Object.keys(STATUS_ONE).map(k => `<option value="${k}" ${b.status === k ? "selected" : ""}>${STATUS_ONE[k]}</option>`).join("")}</select></div>
        <div class="field"><span class="label">Voto</span><div class="rate" id="f-rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${(b.rating || 0) >= n ? "on" : ""}" aria-label="${n} stelle">★</button>`).join("")}</div></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="f-started">Iniziato il</label><input id="f-started" type="date" value="${esc(b.started || "")}"></div>
        <div class="field"><label for="f-finished">Finito il</label><input id="f-finished" type="date" value="${esc(b.finished || "")}"></div>
      </div>
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
    sheet.querySelectorAll("#f-rate button").forEach(btn => btn.onclick = () => {
      const n = Number(btn.dataset.n); holder.rating = holder.rating === n ? 0 : n;
      sheet.querySelectorAll("#f-rate button").forEach(x => x.classList.toggle("on", Number(x.dataset.n) <= holder.rating));
    });
  }
  function readReading(sheet, b) {
    b.status = $("#f-status", sheet).value;
    b.started = $("#f-started", sheet).value; b.finished = $("#f-finished", sheet).value;
    b.notes = $("#f-notes", sheet).value.trim(); b.quote = $("#f-quote", sheet).value.trim();
    if (b.status === "letto" && !b.finished) b.finished = new Date().toISOString().slice(0, 10);
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

  function searchBlock(prefill) {
    return `<div class="field"><label for="s-q">Cerca il libro</label>
        <div class="search"><input id="s-q" type="search" value="${esc(prefill || "")}" placeholder="Titolo, autore o ISBN" autocomplete="off"><button class="btn" id="s-go" type="button">Cerca</button></div></div>
      <div class="status-line" id="s-status" aria-live="polite"></div>
      <div class="results" id="s-results"></div>`;
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
      ${readingFields(b)}
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
          <img src="${esc(c.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><span>${esc(c.src || "")}</span></button>`).join("") +
        `<button type="button" class="pick none${!b.cover ? " on" : ""}" data-i="-1">${coverHTML({ ...b, cover: "" })}<span>Disegnata</span></button>`;
      cvPicks.querySelectorAll(".pick").forEach(el => el.onclick = () => {
        const i = Number(el.dataset.i);
        if (i < 0) { delete b.cover; b.noCover = true; } else { b.cover = cands[i].cover; delete b.noCover; }
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
    $("#s-close", sheet).onclick = closeSheet;
    $("#s-save", sheet).onclick = () => { readReading(sheet, b); readData(sheet, b); upsert(b); closeSheet(); toast("Salvato"); };
    const del = $("#s-del", sheet);
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Conferma eliminazione"; return; }
      removeBook(b.id); closeSheet(); toast("Libro eliminato");
    };
  }

  function openAdd() {
    const b = { status: "da-leggere", rating: 0 };
    const sheet = openSheet(`
      <h2>Nuovo libro</h2>
      ${searchBlock("")}
      <div class="sheet-top" hidden id="a-prev"></div>
      ${dataFields(b)}
      ${readingFields(b)}
      <div class="actions"><button class="btn primary" id="a-save">Aggiungi alla libreria</button><button class="btn ghost" id="a-cancel">Annulla</button></div>`);
    wireRating(sheet, b);
    wireSearch(sheet, hit => {
      const prev = $("#a-prev", sheet); prev.hidden = false;
      prev.innerHTML = `${coverHTML({ ...hit })}<div><p class="synopsis">${esc(hit.synopsis || "")}</p></div>`;
      fillData(sheet, hit, b);
    });
    setTimeout(() => $("#s-q", sheet).focus(), 50);
    $("#a-cancel", sheet).onclick = closeSheet;
    $("#a-save", sheet).onclick = () => {
      readData(sheet, b);
      if (!$("#d-title", sheet).value.trim()) { $("#s-status", sheet).textContent = "Il titolo è obbligatorio."; $("#d-title", sheet).focus(); return; }
      readReading(sheet, b);
      if (state.books.some(x => keyOf(x) === keyOf(b))) { toast("Questo libro è già nella libreria."); return; }
      upsert(b); closeSheet(); toast("Aggiunto alla libreria");
    };
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
    const name = `libreria-diego-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Backup Libreria" }); status.textContent = "Backup condiviso."; return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = "Backup scaricato.";
  }

  function openImport() {
    const sheet = openSheet(`
      <h2>Importa ed esporta</h2>
      <p class="hint">Puoi caricare un backup JSON (anche quello esportato dal prototipo) oppure il CSV esportato da Goodreads. I libri già presenti vengono saltati.</p>
      <div class="field"><label for="i-file">File CSV o JSON</label><input id="i-file" type="file" accept=".csv,.json,text/csv,application/json"></div>
      <div class="status-line" id="i-status" aria-live="polite"></div>
      <div class="actions"><button class="btn primary" id="i-go" disabled>Importa</button><button class="btn" id="i-seed">Carica i libri Goodreads</button></div>
      <p class="hint">Fai un backup ogni tanto: i dati stanno solo su questo iPhone.</p>
      <div class="actions"><button class="btn" id="i-export">Esporta backup</button><button class="btn" id="i-covers">Cerca copertine mancanti</button><button class="btn ghost" id="i-close">Chiudi</button></div>`);
    let pending = [];
    const st = $("#i-status", sheet), go = $("#i-go", sheet);
    $("#i-close", sheet).onclick = closeSheet;
    $("#i-seed", sheet).onclick = () => { closeSheet(); loadSeed(); };
    $("#i-covers", sheet).onclick = () => { closeSheet(); runCoverJob(); };
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
          const fresh = pending.filter(b => b && b.title && !known.has(keyOf(b)));
          st.textContent = fresh.length ? `Pronti da importare: ${fresh.length} libri${pending.length - fresh.length ? ` (${pending.length - fresh.length} già presenti)` : ""}.` : "Nessun libro nuovo in questo file.";
          go.disabled = !fresh.length;
        } catch { pending = []; go.disabled = true; st.textContent = "File non leggibile. Usa un backup JSON o il CSV di Goodreads."; }
      };
      rd.readAsText(f);
    };
    go.onclick = () => {
      const { added } = addMany(pending); pending = []; go.disabled = true;
      st.textContent = `Importati ${added} libri.`;
    };
  }

  /* ---------- avvio ---------- */
  document.querySelectorAll("nav.tabs button").forEach(btn => btn.onclick = () => {
    if (btn.dataset.action === "add") { openAdd(); return; }
    state.view = btn.dataset.view;
    document.querySelectorAll("nav.tabs button[data-view]").forEach(x => x.setAttribute("aria-pressed", String(x === btn)));
    render(); window.scrollTo({ top: 0 });
  });
  let qt; $("#q").oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; render(); }, 120); };
  $("#sort").onchange = e => { state.sort = e.target.value; render(); };

  state.books = load();
  try {
    if (localStorage.getItem("libreria-schema") !== "2") {
      state.books.forEach(b => { if (!b.cover) delete b.noCover; });
      persist(); localStorage.setItem("libreria-schema", "2");
    }
  } catch {}
  render();
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
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
    });
  }
})();
