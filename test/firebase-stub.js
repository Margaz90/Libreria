/* Finto Firebase per i test: stessa API usata da cloud.js, dati sul finto Firestore di test/lib.mjs (porta 8766).
   Comportamento dell'accesso regolabile da localStorage: fake-popup = ok | blocked | closed, fake-uid = account. */
(() => {
  const API = 'http://localhost:8766', enc = encodeURIComponent;
  const getDoc = path => fetch(`${API}/doc?path=${enc(path)}`).then(r => r.json());
  const put = (path, data) => fetch(`${API}/doc?path=${enc(path)}`, { method: 'PUT', body: JSON.stringify(data === undefined ? null : data) });
  const docRef = path => ({
    id: path.split('/').pop(), path,
    get: () => getDoc(path).then(j => ({ exists: j.exists, id: path.split('/').pop(), data: () => j.data })),
    set: data => put(path, data),
    delete: () => put(path, null),
    onSnapshot: next => {
      let last = null, stopped = false;
      const tick = () => { if (stopped) return; getDoc(path).then(j => { const v = JSON.stringify(j.data || null); if (v !== last) { last = v; next({ exists: j.exists, data: () => j.data }); } setTimeout(tick, 300); }).catch(() => setTimeout(tick, 300)); };
      tick(); return () => { stopped = true; };
    }
  });
  const mk = (id, data) => ({ id, data: () => data });
  const colRef = path => ({
    doc: id => docRef(`${path}/${id}`),
    get: () => fetch(`${API}/col?path=${enc(path)}`).then(r => r.json()).then(items => {
      const docs = items.map(i => mk(i.id, i.data));
      return { docs, empty: !docs.length, size: docs.length, forEach: cb => docs.forEach(cb) };
    }),
    onSnapshot: (opts, next, err) => {
      if (typeof opts === 'function') { err = next; next = opts; }
      const seen = new Map(); let stopped = false;
      const tick = async () => {
        if (stopped) return;
        try {
          const items = await (await fetch(`${API}/col?path=${enc(path)}`)).json();
          const cur = new Map(items.map(i => [i.id, i.data])), changes = [];
          for (const [id, d] of cur) {
            const old = seen.get(id);
            if (old === undefined) changes.push({ type: 'added', doc: mk(id, d) });
            else if (JSON.stringify(old) !== JSON.stringify(d)) changes.push({ type: 'modified', doc: mk(id, d) });
          }
          for (const id of seen.keys()) if (!cur.has(id)) changes.push({ type: 'removed', doc: mk(id, null) });
          seen.clear(); for (const [id, d] of cur) seen.set(id, d);
          const docs = [...cur].map(([id, d]) => mk(id, d));
          if (changes.length || !seen.size || true) next({ docChanges: () => changes, docs, metadata: { hasPendingWrites: false, fromCache: false } });
        } catch (e) { err && err(e); }
        setTimeout(tick, 300);
      };
      tick();
      return () => { stopped = true; };
    }
  });
  const db = {
    enablePersistence: () => Promise.resolve(),
    disableNetwork: () => Promise.resolve(),
    enableNetwork: () => Promise.resolve(),
    collection: colRef,
    doc: docRef,
    batch: () => {
      const ops = [];
      return { set: (ref, data) => ops.push({ ref, data }), delete: ref => ops.push({ ref, del: true }),
        commit: () => Promise.all(ops.map(o => o.del ? put(o.ref.path, null) : put(o.ref.path, o.data))) };
    }
  };
  const listeners = []; let cur = JSON.parse(localStorage.getItem('fake-auth') || 'null');
  const setUser = u => { cur = u; if (u) localStorage.setItem('fake-auth', JSON.stringify(u)); else localStorage.removeItem('fake-auth'); listeners.forEach(f => f(cur)); };
  const auth = () => ({
    onAuthStateChanged: cb => { listeners.push(cb); setTimeout(() => cb(cur), 0); return () => {}; },
    signInWithPopup: () => {
      const m = localStorage.getItem('fake-popup') || 'ok'; localStorage.setItem('fake-popup-called', '1');
      if (m === 'blocked') return Promise.reject({ code: 'auth/popup-blocked' });
      if (m === 'closed') return Promise.reject({ code: 'auth/popup-closed-by-user' });
      setUser({ uid: localStorage.getItem('fake-uid') || 'u1', email: 'diego@test.it' }); return Promise.resolve({});
    },
    signInWithRedirect: () => { localStorage.setItem('fake-redirect-called', '1'); setTimeout(() => location.reload(), 50); return new Promise(() => {}); },
    signOut: () => { setUser(null); return Promise.resolve(); },
    getRedirectResult: () => Promise.resolve(null),
    sendSignInLinkToEmail: () => Promise.resolve(),
    signInWithEmailLink: (e, l) => { setUser({ uid: 'u1', email: e }); return Promise.resolve({}); }
  });
  auth.GoogleAuthProvider = function () {}; auth.GoogleAuthProvider.prototype.setCustomParameters = function () {};
  window.firebase = { initializeApp() {}, auth, firestore: () => db };
})();
