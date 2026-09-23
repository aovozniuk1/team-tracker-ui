(() => {
  'use strict';

  const COLLECTIONS = ['settings', 'people', 'projects', 'activities', 'curriculum', 'learning', 'ci', 'messages'];
  // The log is the lead's own record. It lives in a separate repository nobody else is on, so a
  // team member's token cannot reach it by going around this page.
  const PRIVATE = new Set(['activities']);
  const LS = 'team-tracker:';
  const S = { data: {}, server: false, dataDir: '', localOverride: false, route: { name: 'dashboard', id: null, tab: null } };

  const DEFAULTS = {
    settings: () => ({ teamName: 'Team', leadName: '', oneOnOneCadenceDays: 7, staleProjectDays: 7, staleLearningDays: 14 }),
    people: () => [],
    projects: () => [],
    activities: () => [],
    curriculum: () => ({ courses: [] }),
    learning: () => ({ enrollments: [], progress: {} }),
    ci: () => ({ collectedAt: '', sources: [] }),
    messages: () => [],
  };

  const STATUS = ['active', 'paused', 'parked', 'done'];
  const HEALTH = ['green', 'yellow', 'red', 'unknown'];
  const ENV_STATUS = ['up', 'degraded', 'down', 'unknown'];
  const ACT_TYPES = ['update', 'blocker', 'decision', 'one-on-one', 'review', 'incident', 'learning', 'milestone'];
  const LESSON_STATUS = ['not-started', 'in-progress', 'done', 'gate-passed', 'stuck'];
  const LESSON_GLYPH = { 'not-started': '', 'in-progress': '…', 'done': '✓', 'gate-passed': '★', 'stuck': '!' };
  const TRACKS = ['basic', 'accelerated', 'slow'];
  const ROLES = ['mentee', 'lead', 'other'];

  // ---------- utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const daysSince = d => d ? daysBetween(d, today()) : null;
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const localIso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  const dayOf = at => { if (!at || isDay(at)) return at || ''; const d = new Date(at); return isNaN(d) ? String(at).slice(0, 10) : localIso(d).slice(0, 10); };
  const whenLocal = at => { if (!at || isDay(at)) return at || ''; const d = new Date(at); return isNaN(d) ? String(at) : localIso(d).slice(0, 16).replace('T', ' '); };
  const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const nowIso = () => new Date().toISOString();
  const ago = d => { const n = daysSince(d); if (n == null || isNaN(n)) return 'never'; if (n === 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 0) return `in ${-n}d`; return `${n}d ago`; };
  const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || '').localeCompare(a.id || '');
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const label = s => cap(String(s || '').replace(/-/g, ' '));
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text || href)}</a>` : esc(text || '');
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const nl = arr => (arr || []).join('\n');
  const parseLines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const parseRecords = (s, cols) => parseLines(s).map(line => { const parts = line.split('|').map(x => x.trim()); const o = {}; cols.forEach((c, i) => { o[c] = i === cols.length - 1 ? parts.slice(i).join(' | ') : (parts[i] || ''); }); return o; });
  const recordsToLines = (arr, cols) => (arr || []).map(o => cols.map(c => o[c] || '').join(' | ').replace(/( \| )+$/, '')).join('\n');
  // The form shows a few columns of each record; anything else it holds is carried over from the
  // record of the same name, not dropped.
  const keepUnshown = (next, prev, cols) => (next || []).map(r => {
    const was = (prev || []).find(x => String(x[cols[0]] || '') === String(r[cols[0]] || ''));
    return was ? { ...was, ...r } : r;
  });

  let toastTimer;
  function toast(msg, ms = 1800) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- persistence
  function normalize(c, obj) {
    const d = DEFAULTS[c]();
    if (Array.isArray(d)) return Array.isArray(obj) ? obj : d;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return d;
    if (c === 'learning') { obj.enrollments = Array.isArray(obj.enrollments) ? obj.enrollments : []; obj.progress = obj.progress && typeof obj.progress === 'object' && !Array.isArray(obj.progress) ? obj.progress : {}; }
    if (c === 'curriculum') obj.courses = Array.isArray(obj.courses) ? obj.courses : [];
    if (c === 'ci') obj.sources = Array.isArray(obj.sources) ? obj.sources : [];
    return obj;
  }

  // ---------- GitHub backend: data/*.json in a (private) repo, read and written with the viewer's own token
  const GH_DEFAULT = { owner: 'aovozniuk1', repo: 'team-tracker', branch: 'main', token: '', privateRepo: 'team-tracker-private' };
  // Where site data cannot be kept at all, a token taken back from the password manager lives
  // for this visit only.
  let memToken = '';
  function ghConfig() {
    let cfg;
    try { cfg = { ...GH_DEFAULT, ...JSON.parse(localStorage.getItem(LS + 'gh') || '{}') }; } catch { cfg = { ...GH_DEFAULT }; }
    if (!cfg.token && memToken) cfg.token = memToken;
    return cfg;
  }
  function ghStore(cfg) {
    try {
      localStorage.setItem(LS + 'gh', JSON.stringify(cfg));
      return localStorage.getItem(LS + 'gh') === JSON.stringify(cfg);
    } catch { return false; }
  }
  function storageWorks() {
    try { localStorage.setItem(LS + 'probe', '1'); const ok = localStorage.getItem(LS + 'probe') === '1'; localStorage.removeItem(LS + 'probe'); return ok; }
    catch { return false; }
  }
  const ghReady = () => { const g = ghConfig(); return !!(g.token && g.owner && g.repo && g.branch); };

  // A browser set to clear site data on close wipes the token every time it closes. Saved
  // passwords are not site data, so the token is also handed to the browser's password manager
  // and taken back from there whenever the page finds itself disconnected.
  const passwordStoreWorks = () => typeof window.PasswordCredential === 'function' && !!(navigator.credentials && navigator.credentials.store);
  async function keepInPasswordStore(cfg) {
    if (!passwordStoreWorks() || !cfg.token) return false;
    try {
      await navigator.credentials.store(new PasswordCredential({ id: `${cfg.owner}/${cfg.repo}`, password: cfg.token, name: 'Team Tracker' }));
      return true;
    } catch { return false; }
  }
  async function fromPasswordStore(mediation) {
    if (!passwordStoreWorks()) return '';
    try {
      const c = await navigator.credentials.get({ password: true, mediation });
      return (c && c.password) || '';
    } catch { return ''; }
  }
  function restoreToken(token) {
    if (!token) return false;
    if (!ghStore({ ...ghConfig(), token })) memToken = token;
    return true;
  }
  // The log's repository is not a setting: a name the viewer could change would let any
  // repository they can write to pass for the lead's.
  const LOG_REPO = GH_DEFAULT.privateRepo;
  const ghUrl = c => {
    const g = ghConfig();
    const repo = PRIVATE.has(c) ? LOG_REPO : g.repo;
    return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(repo)}/contents/data/${c}.json`;
  };
  const ghHeaders = () => ({ Authorization: `Bearer ${ghConfig().token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  const b64encode = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
  const b64decode = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), ch => ch.charCodeAt(0)));
  async function ghError(r) {
    let msg = ''; try { msg = (await r.json()).message || ''; } catch { /* no body */ }
    if (r.status === 401) return 'token rejected (401)';
    if (r.status === 403 && /rate limit/i.test(msg)) return 'GitHub rate limit reached, try again later';
    if (r.status === 404) return 'repository or file not found, or the token has no access (404)';
    return `${r.status}${msg ? ' ' + msg : ''}`;
  }
  async function ghGet(c) {
    const g = ghConfig();
    const r = await fetch(`${ghUrl(c)}?ref=${encodeURIComponent(g.branch)}`, { headers: ghHeaders(), cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await ghError(r));
    const j = await r.json();
    if (j.encoding !== 'base64' || typeof j.content !== 'string') throw new Error(`data/${c}.json is too large for the GitHub contents API (1 MB limit)`);
    S.etags[c] = j.sha;
    try { return JSON.parse(b64decode(j.content)); } catch { throw new Error(`data/${c}.json in the repository is not valid JSON`); }
  }
  async function ghPut(c, obj) {
    const g = ghConfig();
    const body = { message: `Tracker: update ${c}`, content: b64encode(JSON.stringify(obj, null, 2) + '\n'), branch: g.branch };
    if (S.etags[c]) body.sha = S.etags[c];
    const r = await fetch(ghUrl(c), { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { const e = await ghError(r); if (r.status === 409 || /sha/i.test(e)) return { conflict: true }; return { error: e }; }
    if (!r.ok) return { error: await ghError(r) };
    const j = await r.json(); if (j.content && j.content.sha) S.etags[c] = j.content.sha;
    return { ok: true };
  }
  async function connectGitHub() {
    if (!ghReady() && restoreToken(await fromPasswordStore('optional'))) { location.reload(); return; }
    const g = ghConfig();
    const v = await form('Connect to GitHub', [
      { key: 'owner', label: 'Repository owner', required: true },
      { key: 'repo', label: 'Repository', required: true, help: 'the repository that holds data/*.json' },
      { key: 'branch', label: 'Branch', required: true },
      { key: 'token', label: 'Personal access token', type: 'password', required: true, help: 'Invited to these repositories: a classic token with the repo scope, because GitHub does not let fine-grained tokens reach another person\u2019s repositories. Owner of them: a fine-grained token with Contents and Actions: read and write. Kept in this browser and its password manager; sent nowhere but api.github.com.' },
    ], { ...g, token: '' });
    if (!v) return;
    const kept = ghStore(v);
    const saved = await keepInPasswordStore(v);
    if (!kept && !saved) {
      alert('This browser refused to keep the connection.\n\nThat happens in a private window, or when the browser is set to block site data. Open the page in a normal window and try again — nothing else is wrong with the token.');
      return;
    }
    if (!kept) memToken = v.token;
    location.reload();
  }
  async function disconnectGitHub() {
    if (!confirm('Forget the GitHub token in this browser?\n\nA copy in the browser\u2019s password manager stays there, but the page stops signing in with it on its own. Delete it in the password manager to remove it for good.')) return;
    ghStore({ ...ghConfig(), token: '' }); memToken = '';
    try { if (navigator.credentials && navigator.credentials.preventSilentAccess) await navigator.credentials.preventSilentAccess(); } catch { /* nothing to prevent */ }
    location.reload();
  }

  async function fetchCollection(c) {
    if (S.backend === 'github') return ghGet(c);
    if (!S.server && /\.github\.io$/.test(location.hostname)) return null; // the Pages copy ships no data
    const r = await fetch(S.server ? `/api/${c}` : `data/${c}.json`, { cache: 'no-store' });
    if (r.ok) { const obj = await r.json(); S.etags[c] = r.headers.get('ETag') || ''; S.broken.delete(c); return obj; }
    if (S.server && r.status !== 404) S.broken.add(c);
    return null;
  }

  async function load() {
    S.broken = new Set(); S.etags = {}; S.ghError = ''; S.ghUser = ''; S.serverLog = false;
    if (!/\.github\.io$/.test(location.hostname)) {
      try {
        const r = await fetch('/api/_meta', { cache: 'no-store' });
        // a server process older than the log flag is the lead's own, still running
        if (r.ok) { const m = await r.json(); S.server = !!m.server; S.dataDir = m.dataDir || ''; S.serverLog = m.log !== false; }
      } catch { S.server = false; }
    }
    if (!S.server && !ghReady()) S.restoredToken = restoreToken(await fromPasswordStore('silent'));
    S.backend = S.server ? 'server' : ghReady() ? 'github' : 'static';
    if (S.backend === 'github') {
      try {
        const r = await fetch('https://api.github.com/user', { headers: ghHeaders(), cache: 'no-store' });
        if (r.ok) S.ghUser = (await r.json()).login || '';
      } catch { /* the token may not be allowed to name its owner; the manual choice still works */ }
    }
    S.privateOk = S.server ? S.serverLog : null;
    for (const c of COLLECTIONS) {
      let obj = null;
      const priv = PRIVATE.has(c) && S.backend === 'github';
      if (!(S.backend === 'github' && S.ghError && !priv)) {
        try {
          obj = await fetchCollection(c);
          if (priv) S.privateOk = obj !== null;
        } catch (e) {
          if (S.server) S.broken.add(c);
          // A token that cannot reach the lead's repository is not a broken connection. It belongs
          // to a team member, and for them the log does not exist at all.
          if (priv) S.privateOk = false;
          else if (S.backend === 'github') S.ghError = e.message;
        }
      }
      if (S.backend === 'static') {
        try { const ls = localStorage.getItem(LS + c); if (ls) { obj = JSON.parse(ls); S.localOverride = true; } } catch { /* ignore */ }
      }
      S.data[c] = normalize(c, obj);
    }
    S.me = loginHolders(S.ghUser).length === 1 ? loginHolders(S.ghUser)[0].id : '';
    // The lead's own record: the one person carrying the login that owns the tracker.
    S.leadMe = loginHolders(GH_DEFAULT.owner).length === 1 ? loginHolders(GH_DEFAULT.owner)[0].id : '';
  }

  // With `replay`, a conflict only reloads the collection and returns 'conflict', so the caller
  // can apply its change again on top of the newer copy.
  async function save(c, { replay = false } = {}) {
    if (PRIVATE.has(c) && !canSeeHistory()) return false;
    const obj = S.data[c];
    if (S.backend === 'github') {
      if (S.ghError) { toast('Not saved: GitHub could not be read (' + S.ghError + ')'); return false; }
      const res = await ghPut(c, obj);
      if (res.conflict) {
        try { const fresh = await ghGet(c); if (fresh) S.data[c] = normalize(c, fresh); } catch { /* keep */ }
        if (replay) return 'conflict';
        toast('Not saved: this data was changed elsewhere. Reloaded — please redo your change.'); render(); return false;
      }
      if (res.error) { toast('Save failed: ' + res.error); return false; }
      toast('Saved to GitHub'); return true;
    }
    if (S.server) {
      if (S.broken.has(c)) { toast(`Not saved: data/${c}.json is not valid JSON on disk. Fix the file, then reload.`); return false; }
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (S.etags[c]) headers['If-Match'] = S.etags[c];
        const r = await fetch(`/api/${c}`, { method: 'PUT', headers, body: JSON.stringify(obj) });
        if (r.status === 409) {
          try { const fresh = await fetchCollection(c); if (fresh) S.data[c] = normalize(c, fresh); } catch { /* keep */ }
          if (replay) return 'conflict';
          toast('Not saved: this data was changed elsewhere. Reloaded — please redo your change.'); render(); return false;
        }
        if (!r.ok) { let msg = ''; try { msg = (await r.json()).error || ''; } catch { /* ignore */ } toast(`Save failed${msg ? ': ' + msg : ''}`); return false; }
        S.etags[c] = r.headers.get('ETag') || S.etags[c];
        toast('Saved'); return true;
      } catch { toast('Save failed: server unreachable'); return false; }
    }
    try { localStorage.setItem(LS + c, JSON.stringify(obj)); S.localOverride = true; toast('Saved in this browser only'); return true; }
    catch { toast('Could not save'); return false; }
  }

  // ---------- test catalogues: data/catalog/<projectId>.json, shared and read-only here
  // A project without a file has no Tests tab; nothing about that is an error.
  S.catalogs = Object.create(null); S.catPending = new Set(); S.catFilter = Object.create(null);
  const CATALOG_ID = /^[a-z0-9-]+$/;
  let catIndex = null;
  // The server and GitHub both list the folder in one request, so projects without a catalogue are
  // never asked for one. Without a listing (no server) each project is looked up on its own.
  function catalogIndex() {
    if (S.backend !== 'github' && S.backend !== 'server') return Promise.resolve(null);
    return catIndex ||= (async () => {
      const g = ghConfig();
      try {
        const r = S.backend === 'server'
          ? await fetch('/api/catalog', { cache: 'no-store' })
          : await fetch(`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/data/catalog?ref=${encodeURIComponent(g.branch)}`, { headers: ghHeaders(), cache: 'no-store' });
        if (r.status === 404) return new Set();
        if (!r.ok) return null;
        const j = await r.json();
        if (S.backend === 'server') return Array.isArray(j.projects) ? new Set(j.projects.map(String)) : null;
        return Array.isArray(j) ? new Set(j.filter(f => f && f.type === 'file' && /\.json$/.test(f.name || '')).map(f => f.name.slice(0, -5))) : null;
      } catch { return null; }
    })();
  }
  const str = v => typeof v === 'string' ? v : v == null ? '' : String(v);
  const strs = v => Array.isArray(v) ? v.filter(x => x != null && x !== '').map(String) : [];
  function catalogOf(obj) {
    if (!obj) return null;
    if (typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.tests)) return { error: 'the file holds no list of tests', tests: [] };
    const tests = obj.tests.filter(t => t && typeof t === 'object').map(t => {
      const x = {
        nodeid: str(t.nodeid), file: str(t.file), name: str(t.name), kind: str(t.kind).toLowerCase(), area: str(t.area).trim() || 'Other',
        title: str(t.title) || str(t.name), does: str(t.does), checks: strs(t.checks), needs: str(t.needs),
        markers: strs(t.markers), params: strs(t.params), sourceUrl: str(t.sourceUrl),
      };
      x.hay = [x.title, x.does, ...x.checks, x.file, x.nodeid].join('\n').toLowerCase();
      return x;
    });
    return { repo: str(obj.repo), branch: str(obj.branch), commit: str(obj.commit), generatedAt: str(obj.generatedAt), tests };
  }
  async function ensureCatalog(pid) {
    if (pid in S.catalogs) return S.catalogs[pid];
    let cat = null;
    if (CATALOG_ID.test(pid) && !(S.backend === 'github' && S.ghError)) {
      const idx = await catalogIndex();
      if (!idx || idx.has(pid)) {
        try { cat = catalogOf(await fetchCollection(`catalog/${pid}`)); }
        // an unreachable source means no catalogue; a file that is there but unreadable is reported
        catch (e) { cat = e instanceof TypeError ? null : { error: (e && e.message) || 'unknown error', tests: [] }; }
      }
    }
    return (S.catalogs[pid] = cat);
  }
  function wantCatalog(pid) {
    if (pid in S.catalogs || S.catPending.has(pid) || !project(pid)) return;
    S.catPending.add(pid);
    ensureCatalog(pid).catch(() => (S.catalogs[pid] = null)).then(cat => {
      S.catPending.delete(pid);
      const r = S.route;
      if (r.name === 'projects' && r.id === pid && (cat || r.tab === 'tests')) render();
    });
  }

  // ---------- data access
  const settings = () => S.data.settings;
  const people = () => S.data.people;
  const projects = () => S.data.projects;
  // One gate for the whole log: with no access to it every view built on it comes out empty,
  // instead of each one having to remember to ask.
  // Through the local server that means the log's folder is there beside it, which a clone of this
  // repository run by anybody else does not have.
  const canSeeHistory = () => S.privateOk === true;
  const acts = () => canSeeHistory() ? S.data.activities : [];
  // Learning progress is personal: the lead sees everyone's, anybody else only their own. "Own" is the
  // person the GitHub token names; the choice in the menu signs posts and opens nobody's progress.
  // It is settled from people.json as read at load time, and only a login carried by exactly one
  // person counts, so no edit made in this page can move it.
  const signedInAs = () => S.me || '';
  const canSeeLearningOf = pid => canSeeHistory() || (!!pid && pid === signedInAs());
  // A person's thread is between that person and the lead.
  const canSeeThreadOf = pid => canSeeHistory() || (!!pid && pid === signedInAs());
  // The lead edits every project. A project's own lead edits what is written and planned in it;
  // what the project is and who is on it stay the lead's.
  const OWNER_FIELDS = new Set(['summary', 'status', 'health', 'healthReason', 'nextMilestone', 'workstreams', 'keyFacts', 'risks', 'openQuestions', 'nextSteps', 'notes', 'stack', 'systems']);
  const canEditProject = p => !!p && (canSeeHistory() || (!!signedInAs() && p.leadId === signedInAs()));
  function mayChange(p, path) {
    if (canSeeHistory()) return true;
    if (!canEditProject(p)) return false;
    const top = path.split('/')[0];
    return top === 'environments' ? /^environments\/.+\/(notes|status)$/.test(path) : top === 'suggested' || OWNER_FIELDS.has(top);
  }
  function learningLock() {
    if (S.backend !== 'github') return 'Learning progress is shown to the person it belongs to when this page is connected to GitHub with their own token.';
    if (!S.ghUser) return 'GitHub did not say which account this token belongs to, so no learning progress is shown. Reload the page to ask again.';
    if (loginHolders(S.ghUser).length > 1) return `More than one person on the team carries the GitHub username ${S.ghUser}, so none of them is taken to be you and no learning progress is shown.`;
    return `No person on the team carries the GitHub username ${S.ghUser}, so no learning progress is shown.`;
  }
  // A course marked leadOnly (the lead's own track) is not shown to anyone else.
  const courses = () => S.data.curriculum.courses.filter(c => !c.leadOnly || canSeeHistory());
  const learning = () => S.data.learning;
  const person = id => people().find(p => p.id === id);
  const project = id => projects().find(p => p.id === id);
  const course = id => courses().find(c => c.id === id);
  const pname = id => person(id)?.name || (id ? `(${id})` : 'Unassigned');
  const plink = id => id && person(id) ? `<a href="#/people/${esc(id)}">${esc(pname(id))}</a>` : esc(pname(id));
  const prlink = id => project(id) ? `<a href="#/projects/${esc(id)}">${esc(project(id).name)}</a>` : '';
  const activePeople = () => people().filter(p => p.active !== false);
  const mentees = () => activePeople().filter(p => p.role === 'mentee');

  function personProjects(pid) {
    return projects().filter(p => p.leadId === pid || (p.memberIds || []).includes(pid) || (p.workstreams || []).some(w => w.ownerId === pid));
  }
  function personRoleIn(p, pid) {
    if (p.leadId === pid) return 'lead';
    const ws = (p.workstreams || []).filter(w => w.ownerId === pid).map(w => w.name);
    if (ws.length) return `owns: ${ws.join(', ')}`;
    if ((p.memberIds || []).includes(pid)) return 'member';
    return '';
  }
  const projectActs = id => acts().filter(a => a.projectId === id).sort(byDateDesc);
  const personActs = id => acts().filter(a => a.personId === id).sort(byDateDesc);
  const lastOneOnOne = pid => personActs(pid).find(a => a.type === 'one-on-one');
  const openBlockers = () => acts().filter(a => a.type === 'blocker' && !a.resolved).sort(byDateDesc);
  const lessonsOf = c => (c.phases || []).flatMap(ph => (ph.lessons || []).map(l => ({ ...l, phaseId: ph.id, phaseName: ph.name })));

  // ---------- who is at this browser, and the thread on a person's page
  const messages = () => S.data.messages || [];
  const visibleMessages = () => messages().filter(m => canSeeThreadOf(m.personId));
  const threadOf = pid => canSeeThreadOf(pid) ? messages().filter(m => m.personId === pid).sort((a, b) => (a.at || '').localeCompare(b.at || '')) : [];
  const mayRemoveMessage = m => canSeeHistory() || (!!m.authorId && m.authorId === signedInAs() && canSeeThreadOf(m.personId));
  const openAsks = pid => threadOf(pid).filter(m => m.question && !m.resolved);
  // Identity comes from the GitHub account the page is connected with, so a post cannot be
  // signed with someone else's name. Without that (local server, no connection) it falls back
  // to a per-browser choice.
  const sameLogin = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
  const loginHolders = login => login ? people().filter(p => sameLogin(p.githubLogin, login)) : [];
  function viewerId() {
    if (S.me) return S.me;
    try { return localStorage.getItem(LS + 'viewer') || ''; } catch { return ''; } }
  function setViewer(id) { try { id ? localStorage.setItem(LS + 'viewer', id) : localStorage.removeItem(LS + 'viewer'); } catch { /* ignore */ } }
  const viewerName = () => person(viewerId())?.name || 'not set';
  const threadReaders = pid => canSeeHistory() && pid === viewerId() ? 'you' : `${pid === viewerId() ? 'you' : pname(pid)} and the lead`;
  async function chooseViewer() {
    if (!people().length) { toast('Add people first'); return; }
    if (S.me) { toast(`You are signed in to GitHub as ${S.ghUser}, so posts are signed as ${viewerName()}.`); return; }
    const v = await form('Who is using this browser?', [
      { key: 'id', label: 'You are', type: 'select', options: peopleOpts(), allowEmpty: true, emptyLabel: 'not set',
        help: 'Kept on this device only, so your posts are signed.' },
    ], { id: viewerId() });
    if (!v) return;
    setViewer(v.id); render();
  }
  async function postMessage(pid, question) {
    if (!canSeeThreadOf(pid)) return;
    if (!viewerId()) { await chooseViewer(); if (!viewerId()) { toast('Say who you are first'); return; } }
    const v = await form(question ? 'Ask a question' : 'Leave a note', [
      { key: 'text', label: question ? 'Your question' : 'Message', type: 'textarea', required: true, rows: 5,
        help: `${question ? 'It stays marked open until it is marked answered. ' : ''}Only ${threadReaders(pid)} can read it.` },
    ], {});
    if (!v) return;
    messages().push({ id: uid('m'), personId: pid, authorId: viewerId(), at: new Date().toISOString(), text: v.text, question: !!question, resolved: false });
    await save('messages'); render();
  }
  async function toggleAnswered(id) {
    const m = messages().find(x => x.id === id); if (!m || !canSeeThreadOf(m.personId)) return;
    m.resolved = !m.resolved;
    m.resolvedBy = m.resolved ? viewerId() : '';
    m.resolvedAt = m.resolved ? new Date().toISOString() : '';
    await save('messages'); render();
  }
  async function deleteMessage(id) {
    const m = messages().find(x => x.id === id); if (!m || !mayRemoveMessage(m)) return;
    if (!confirm('Remove this message?')) return;
    S.data.messages = messages().filter(x => x.id !== id);
    await save('messages'); render();
  }

  // ---------- CI snapshot (data/ci.json, written by tools/collect_ci.py)
  const ci = () => S.data.ci || { collectedAt: '', sources: [] };
  const ciSource = pid => ci().sources.find(s => s.projectId === pid);
  const runsOf = s => ((s && s.runs) || []).slice().sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  const lastRun = s => runsOf(s)[0];
  // "Tests on deploy" fires many times a day; the headline of a project is its regression.
  const headlineRun = s => { const rs = runsOf(s); return rs.find(r => r.kind === 'regression') || rs[0]; };
  const failingGroups = s => (s && s.groups || []).filter(g => { const r = runsOf(s).find(x => x.group === g.id); return r && /fail|error|timed/.test(runResult(r)); });
  const runResult = r => (r.result || (r.status === 'completed' ? 'unknown' : r.status) || 'unknown').toLowerCase();
  const resultPill = r => { const res = runResult(r); const cls = /success/.test(res) ? 'green' : /fail|error|timed/.test(res) ? 'red' : /progress|queued|pending|running/.test(res) ? 'yellow' : 'grey'; return pill(cls, label(res.replace(/_/g, ' '))); };
  const KIND = { github: 'GitHub', bitbucket: 'Bitbucket', local: 'Local folder' };
  const kindName = k => KIND[k] || label(k);
  const fmtDur = s => s == null || isNaN(s) ? '' : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  const fmtWhen = iso => iso ? String(iso).slice(0, 16).replace('T', ' ') : '';
  const agoIso = iso => iso ? ago(String(iso).slice(0, 10)) : 'never';
  const countsText = c => c ? `${c.passed ?? '?'} passed${c.failed ? `, ${c.failed} failed` : ''}${c.broken ? `, ${c.broken} broken` : ''}${c.skipped ? `, ${c.skipped} skipped` : ''} of ${c.total ?? '?'}` : '';
  const ciAge = () => { const t = ci().collectedAt; if (!t) return null; const h = (Date.now() - new Date(t).getTime()) / 36e5; return { hours: h, stale: h > 3 }; };
  const isLive = r => /queued|in_progress|pending|waiting|requested|running|building/i.test(r.status || '');
  const liveRuns = s => runsOf(s).filter(isLive);
  const allLive = () => ci().sources.flatMap(s => liveRuns(s).map(r => ({ s, r })));
  // Durations of a run that was going at collection time are measured UP TO that collection,
  // never up to now: the run may well have finished since, and a ticking clock would lie.
  const snapAt = () => ci().collectedAt || '';
  const elapsed = (iso, until) => {
    if (!iso) return '';
    const end = until || snapAt();
    const endMs = end ? new Date(end).getTime() : Date.now();
    return fmtDur(Math.max(0, Math.round((endMs - new Date(iso).getTime()) / 1000)));
  };
  const snapMinutes = () => { const t = snapAt(); return t ? Math.round((Date.now() - new Date(t).getTime()) / 60000) : null; };
  // Bitbucket stamps times with nanoseconds, which Date.parse does not take everywhere.
  const isoMs = iso => Date.parse(String(iso || '').replace(/(\.\d{3})\d+/, '$1'));
  const fmtBytes = b => !(b > 0) ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  const groupOf = (s, gid) => ((s && s.groups) || []).find(g => g.id === gid) || null;
  const groupName = g => g ? `${KIND_TITLE[g.kind] || label(g.kind)}${g.env ? ' · ' + g.env : ''}` : '';
  const isFinished = r => (r.status || '').toLowerCase() === 'completed';

  // ---------- run reports shown inside the page
  const hasInline = rep => {
    const i = rep && rep.inline;
    if (!i) return false;
    if (i.type === 'url') return /^https:\/\//.test(i.src || '');
    return i.type === 'repo' && !!i.ref && /^[\w.\/-]+$/.test(i.path || '') && !/(^|\/)\.\.(\/|$)/.test(i.path);
  };
  const firstInline = r => ((r && r.reports) || []).findIndex(hasInline);
  const newestInline = (s, gid) => runsOfGroup(s, gid).find(r => isFinished(r) && firstInline(r) >= 0) || null;
  const extLink = rep => `<a class="rep-ext" href="${esc(rep.url)}" target="_blank" rel="noopener" title="Open in a new tab" aria-label="Open ${esc(rep.name || 'the report')} in a new tab">↗</a>`;
  function reportBtn(pid, runId, rep, idx, html, cls = 'btn sm primary') {
    const name = rep.name || 'the report', size = fmtBytes(rep.inline && rep.inline.bytes);
    return `<button class="${cls}" data-act="report" data-project="${esc(pid)}" data-run="${esc(runId)}" data-idx="${idx}" title="${esc(`Open ${name} here${size ? ' (' + size + ')' : ''}`)}">${html}</button>`;
  }
  // A report the page can show opens in the viewer; any other stays a link to where it lives.
  function reportLinks(pid, runId, list, text) {
    list = list || [];
    return list.map((rep, i) => hasInline(rep)
      ? `<span class="rep">${reportBtn(pid, runId, rep, i, esc(list.length > 1 || !text ? rep.name || 'Report' : text))}${extLink(rep)}</span>`
      : link(rep.url, rep.name)).join(' ');
  }

  function liveBlock(s, showProject) {
    const live = liveRuns(s);
    if (!live.length) return '';
    const mins = snapMinutes(), old = mins != null && mins > 10;
    return `<div class="card live" style="margin-bottom:14px"><h3><span class="live-dot"></span> Was running at the last check — ${live.length} job${live.length === 1 ? '' : 's'} ${pill(old ? 'red' : 'yellow', mins == null ? 'no snapshot' : mins < 2 ? 'just now' : `${mins} min ago`)}</h3>
      ${live.map(r => `<div class="row"><div class="body"><b>${esc(r.name || '')}</b> ${pill('accent', r.activeEnv || r.env || 'running')} ${pill('yellow', label((r.status || '').replace(/_/g, ' ')))}
        ${(r.activeJobs || []).length ? `<div class="small">on at the time: ${(r.activeJobs || []).map(j => `<span class="mono">${esc(j.name)}</span>${j.startedAt ? ` <span class="muted">${esc(elapsed(j.startedAt))}</span>` : ''}`).join(', ')}</div>` : ''}
        <div class="muted small">started ${esc(fmtWhen(r.startedAt))} UTC · had been running ${esc(elapsed(r.startedAt))} when the snapshot was taken${r.trigger ? ' · ' + esc(r.trigger) : ''}${showProject ? ' · ' + esc(s.repoName || '') : ''}</div></div>
        <div class="ops">${reportLinks(s.projectId, String(r.id), r.reports, 'Report')}${r.url ? link(r.url, 'watch') : ''}</div></div>`).join('')}
      <p class="hint" style="margin-top:6px">${old ? `This is the picture as of ${esc(fmtWhen(snapAt()))} UTC, ${mins} minutes ago — these jobs may have finished since. Press <b>Refresh now</b> for the current state.` : 'Taken at the last collection; “Refresh now” re-reads the sources immediately.'}</p></div>`;
  }

  // Re-read the snapshot while a CI screen is open, so a collection that lands in the
  // background shows up without the person reloading the page.
  let ciTimer = null;
  function stopCiAuto() { if (ciTimer) { clearInterval(ciTimer); ciTimer = null; } }
  function startCiAuto() {
    if (ciTimer) return;
    ciTimer = setInterval(async () => {
      if (!/^#\/(ci|projects\/[^/]+\/ci)/.test(location.hash)) return stopCiAuto();
      const before = ci().collectedAt;
      try {
        const fresh = await fetchCollection('ci');
        if (fresh && fresh.collectedAt !== before) { S.data.ci = normalize('ci', fresh); render(); }
        else if (allLive().length) render();
      } catch { /* keep what is on screen */ }
    }, 60000);
  }

  // GitHub's own scheduler is unreliable for a young repository, so a stale snapshot is also
  // refreshed by whoever opens the page: once per session, quietly, and only when it is old.
  // Every collection is a billed Actions job, so one is never started while another is on.
  // A collection that is already queued or running, whoever started it, answers for a new one.
  async function collectionUnderway(cfg) {
    try {
      const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/actions/workflows/collect-ci.yml/runs?per_page=5`, { headers: ghHeaders(), cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      return (j.workflow_runs || []).some(x => x.status !== 'completed' && Date.now() - Date.parse(x.created_at) < 15 * 60000);
    } catch { return false; }
  }
  async function startCollection() {
    const cfg = ghConfig();
    if (await collectionUnderway(cfg)) { S.collectAt = Date.now(); return { status: 204, joined: true }; }
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/actions/workflows/collect-ci.yml/dispatches`, {
      method: 'POST', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: cfg.branch }),
    });
    if (r.status === 204) S.collectAt = Date.now();
    return r;
  }
  async function awaitSnapshot(before, tries) {
    for (let i = 0; i < tries; i++) {
      await new Promise(res => setTimeout(res, 5000));
      try {
        const fresh = await fetchCollection('ci');
        if (fresh && fresh.collectedAt && fresh.collectedAt !== before) { S.data.ci = normalize('ci', fresh); return true; }
      } catch { /* keep polling */ }
    }
    return false;
  }

  async function autoRefreshIfStale() {
    if (S.autoRefreshed || S.backend !== 'github' || S.collecting) return;
    const t = snapAt();
    if (t && (Date.now() - new Date(t).getTime()) / 36e5 < (settings().autoCollectAfterHours ?? 3)) return;
    S.autoRefreshed = true; S.collecting = true;
    try {
      const r = await startCollection();
      if (r.status !== 204) return;
      toast('The CI snapshot was stale; collecting in the background.');
      if (await awaitSnapshot(t, 24)) render();
    } catch { /* the page still shows how old the snapshot is */ }
    finally { S.collecting = false; }
  }

  async function refreshCI(btn) {
    if (S.backend !== 'github') { toast('Connect this page to GitHub first (Data → Connect to GitHub)'); return; }
    if (S.collecting) { toast('A collection is already running; the page updates when it lands.'); return; }
    const before = ci().collectedAt;
    S.collecting = true; paintWaits();
    if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
    try {
      const r = await startCollection();
      if (r.status !== 204) {
        const err = await ghError(r);
        toast(r.status === 403 || r.status === 404 ? `Cannot refresh from here (${err}). Add “Actions: read and write” to this token.` : 'Refresh failed: ' + err);
        return;
      }
      toast(r.joined ? 'A collection is already running; the page waits for it.' : 'Collecting…');
      if (await awaitSnapshot(before, 40)) { S.collecting = false; toast('Updated'); render(); return; }
      toast('The collector is still running; the page will pick it up on its own.');
    } catch { toast('Could not reach GitHub'); }
    finally { S.collecting = false; paintWaits(); if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = '↻ Refresh now'; } }
  }

  // ---------- a started run, followed until its report is in
  // Collections are billed Actions minutes, so a started run is looked for when it is likely to be
  // over: at the group's usual duration plus 2 minutes (10 minutes with no past runs). Where past runs
  // fall into two clusters, runs that stopped early and runs that went through, it is looked for
  // after each. Then at most 2 more times, a tenth of the usual duration apart (5 minutes at least),
  // within 3 hours of the start, and only while this page is open: at most 4 collections a run. Both
  // rules are self-contained so tools/test_schedule.js can run them on their own.
  function checkPlan(durations) {
    const d = (durations || []).filter(n => typeof n === 'number' && n > 0).sort((x, y) => x - y);
    if (!d.length) return { plan: [10], expectSec: null, earlySec: null };
    const median = a => { const m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };
    const minutes = sec => Math.ceil(sec / 60) + 2;
    let cut = 0, gap = 3;
    for (let i = 1; i < d.length; i++) if (d[i] / d[i - 1] >= gap) { gap = d[i] / d[i - 1]; cut = i; }
    if (!cut) { const m = median(d); return { plan: [minutes(m)], expectSec: m, earlySec: null }; }
    const early = median(d.slice(0, cut)), full = median(d.slice(cut));
    return { plan: [minutes(early), minutes(full)], expectSec: full, earlySec: early };
  }
  function nextCollectAt(w, now) {
    const MIN = 60000, EXTRA = 2, LIMIT = 180 * MIN;
    const at = Date.parse(w && w.at), made = (w && w.made) || 0;
    if (!w || w.finished || !(at > 0)) return null;
    const plan = Array.isArray(w.plan) && w.plan.length ? w.plan : [w.firstMin > 0 ? w.firstMin : 10];
    const last = plan[plan.length - 1], every = Math.max(5, Math.round(last / 10)) * MIN;
    if (made >= plan.length + EXTRA) return null;
    const planned = at + (made < plan.length ? plan[made] * MIN : last * MIN + (made - plan.length + 1) * every);
    const due = made ? Math.max(planned, (Date.parse(w.lastAt) || at) + every) : planned;
    return due - at > LIMIT || now - at > LIMIT ? null : due;
  }

  const WAITS_KEY = LS + 'waits';
  const WAIT_MAX_MS = 3 * 3600000;
  function readWaits() {
    let list = [];
    try { list = JSON.parse(sessionStorage.getItem(WAITS_KEY) || '[]'); } catch { list = []; }
    return (Array.isArray(list) ? list : []).filter(w => w && w.id && w.projectId && w.groupId && Date.now() - Date.parse(w.at) <= WAIT_MAX_MS);
  }
  function writeWaits() {
    try { if (S.waits.length) sessionStorage.setItem(WAITS_KEY, JSON.stringify(S.waits)); else sessionStorage.removeItem(WAITS_KEY); } catch { /* kept for this visit only */ }
  }
  S.waits = readWaits();
  writeWaits();

  function addWait(s, g) {
    // a cancelled run says nothing about how long a run takes
    const p = checkPlan(runsOfGroup(s, g.id).filter(r => isFinished(r) && !/cancel|skip/.test(runResult(r))).map(r => r.durationSec));
    const w = { id: uid('w'), projectId: s.projectId, groupId: g.id, at: nowIso(), expectSec: p.expectSec, earlySec: p.earlySec, plan: p.plan, firstMin: p.plan[0], made: 0, lastAt: '', runId: '', finished: false };
    S.waits = S.waits.filter(x => !(x.projectId === w.projectId && x.groupId === w.groupId)).concat(w);
    writeWaits(); armWaits();
    return w;
  }
  function dismissWait(id) {
    S.waits = S.waits.filter(w => w.id !== id);
    writeWaits(); armWaits(); paintWaits();
  }
  // The run a Run press started: the first of its group from then on, a manual one first.
  function waitRun(w, s) {
    const runs = runsOfGroup(s, w.groupId);
    if (w.runId) return runs.find(r => String(r.id) === w.runId) || null;
    const since = Date.parse(w.at) - 60000;
    const after = runs.filter(r => isoMs(r.startedAt) >= since).sort((a, b) => isoMs(a.startedAt) - isoMs(b.startedAt));
    return after.find(r => /dispatch|manual/i.test(r.trigger || '')) || after[0] || null;
  }
  const waitTitle = w => groupName(groupOf(ciSource(w.projectId), w.groupId)) || w.groupId;
  function syncWaits() {
    const now = Date.now(), before = S.waits.length;
    let changed = false;
    S.waits = S.waits.filter(w => now - Date.parse(w.at) <= WAIT_MAX_MS);
    for (const w of S.waits) {
      const s = ciSource(w.projectId), run = s ? waitRun(w, s) : null;
      if (!run) continue;
      if (!w.runId && /dispatch|manual/i.test(run.trigger || '')) { w.runId = String(run.id); changed = true; }
      if (isFinished(run) && !w.finished) {
        w.finished = true; changed = true;
        toast(firstInline(run) >= 0 ? `Report ready: ${waitTitle(w)}` : `${waitTitle(w)} finished: ${label(runResult(run))}`, 6000);
      }
    }
    if (changed || S.waits.length !== before) writeWaits();
    armWaits(now);
  }
  let waitTimer = null;
  function armWaits(now = Date.now()) {
    clearTimeout(waitTimer); waitTimer = null;
    if (S.backend !== 'github') return;
    const due = S.waits.map(w => nextCollectAt(w, now)).filter(t => t != null);
    if (!due.length) return;
    const wait = Math.min(...due) - now;
    // at least once a minute, so the countdown on the cards stays true
    waitTimer = setTimeout(tickWaits, Math.min(60000, Math.max(S.collecting ? 15000 : 1000, wait)));
  }
  async function tickWaits() {
    waitTimer = null;
    const now = Date.now();
    const due = S.waits.filter(w => { const t = nextCollectAt(w, now); return t != null && t <= now; });
    if (due.length && !S.collecting) {
      const dueAt = Math.min(...due.map(w => nextCollectAt(w, now)));
      due.forEach(w => { w.made = (w.made || 0) + 1; w.lastAt = new Date(now).toISOString(); });
      writeWaits();
      // a collection somebody started a moment ago answers for this check too
      if (!(S.collectAt && now - S.collectAt < 3 * 60000)) {
        S.collecting = true; S.waitError = ''; paintWaits();
        let fresh = false;
        try {
          // and so does a snapshot that landed since the check fell due, whoever collected it
          const latest = await fetchCollection('ci');
          if (latest && latest.collectedAt && latest.collectedAt !== ci().collectedAt) { S.data.ci = normalize('ci', latest); fresh = true; }
          if (!(isoMs(ci().collectedAt) >= dueAt - 2 * 60000)) {
            const r = await startCollection();
            if (r.status === 204) fresh = (await awaitSnapshot(ci().collectedAt, 36)) || fresh;
            else S.waitError = await ghError(r);
          }
        } catch { S.waitError = 'GitHub could not be reached'; }
        finally { S.collecting = false; }
        if (fresh) { render(); return; }
      }
    }
    syncWaits(); paintWaits();
  }

  function waitCard(w, showProject) {
    const now = Date.now(), s = ciSource(w.projectId), run = s ? waitRun(w, s) : null, next = nextCollectAt(w, now);
    const name = `${waitTitle(w)}${showProject ? ' — ' + (project(w.projectId)?.name || w.projectId) : ''}`;
    const expect = w.expectSec ? `expected about ${aboutMin(w.expectSec)}${w.earlySec ? `, or about ${aboutMin(w.earlySec)} if it stops early` : ''}` : 'no past runs to estimate from';
    const utcTime = ms => `${fmtWhen(new Date(ms).toISOString()).slice(11)} UTC`;
    const asked = utcTime(Date.parse(w.at));
    const x = `<button class="btn sm ghost" data-act="wait-dismiss" data-id="${esc(w.id)}" title="Stop following this run" aria-label="Stop following this run">✕</button>`;
    let cls = 'card wait', head, body, ops = '', live = false;
    if (run && isFinished(run)) {
      const i = firstInline(run);
      head = i >= 0 ? 'Report ready' : `Finished — ${label(runResult(run).replace(/_/g, ' '))}`;
      if (i >= 0) { cls += ' ready'; ops = reportBtn(w.projectId, String(run.id), run.reports[i], i, 'Open report', 'btn primary'); }
      body = `${resultPill(run)} ${run.counts ? esc(countsText(run.counts)) + ' · ' : ''}started ${esc(fmtWhen(run.startedAt))} UTC${run.durationSec ? ', took ' + esc(fmtDur(run.durationSec)) : ''}`
        + (i >= 0 ? '' : `<div>No report came with this run. ${run.url ? link(run.url, 'Open the run') : ''} ${reportLinks(w.projectId, String(run.id), run.reports)}</div>`);
    } else if (next == null) {
      cls += ' lost';
      head = run ? 'Still running at the last check' : 'Not seen in the snapshot yet';
      body = `Requested ${esc(asked)}. The page made its ${w.made || 0} checks and stops collecting for it here; “Refresh now” looks again${run && run.url ? `, or ${link(run.url, 'follow it at the source')}` : ''}.`;
    } else {
      live = true;
      head = `${run ? 'Running' : 'Started'} — ${expect}`;
      const mins = Math.max(1, Math.ceil((next - now) / 60000));
      const check = S.backend !== 'github' ? 'this page is not connected to GitHub, so it cannot look for the result itself'
        : S.collecting ? 'collecting now…' : next <= now ? 'checking…' : `next check in ${mins} min, at ${utcTime(next)}`;
      body = `Requested ${esc(asked)}${run ? ` · running since ${esc(fmtWhen(run.startedAt))} UTC` : ''} · ${esc(check)}${w.made ? ` · ${w.made} check${w.made === 1 ? '' : 's'} so far` : ''}`
        + `${S.waitError ? `<div style="color:var(--red-text)">The last collection could not start: ${esc(S.waitError)}</div>` : ''}`
        + `<div class="hint">${esc(planText(w))}</div>`;
      if (run && run.url) ops = link(run.url, 'watch');
    }
    return `<div class="${cls}" data-wait="${esc(w.id)}"><div class="wait-row"><div class="body"><h3>${live ? '<span class="live-dot"></span>' : ''}${esc(head)} <span class="muted small">${esc(name)}</span></h3>
      <div class="small muted">${body}</div></div><div class="ops">${ops}${x}</div></div></div>`;
  }
  // the rule of nextCollectAt, as the card tells it
  function planText(w) {
    const plan = Array.isArray(w.plan) && w.plan.length ? w.plan : [w.firstMin || 10];
    const every = Math.max(5, Math.round(plan[plan.length - 1] / 10));
    return `The page collects ${plan.map(m => aboutMin(m * 60)).join(' and ')} after the start, then at most twice more, ${every} min apart, while it stays open. A collection anyone else starts meanwhile counts as one of these.`;
  }
  const waitCards = pid => S.waits.filter(w => !pid || w.projectId === pid).map(w => waitCard(w, !pid)).join('');
  const waitsBox = pid => `<div class="waits" data-waits="${esc(pid)}">${waitCards(pid)}</div>`;
  function paintWaits() { $$('[data-waits]').forEach(el => { el.innerHTML = waitCards(el.dataset.waits); }); }
  const aboutMin = sec => { const m = Math.max(1, Math.round(sec / 60)); return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };

  // ---------- the report viewer
  const LARGE_REPORT = 10 * 1048576;
  const NOASK_KEY = LS + 'reportNoAsk';
  // Never allow-same-origin on a report the page fetched: a blob: URL runs with this page's
  // origin and could then read the GitHub token kept in localStorage.
  const BLOB_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads';
  let viewer = null;
  function openReportFor(pid, runId, idx) {
    const s = ciSource(pid); if (!s) return;
    const r = runId ? runsOf(s).find(x => String(x.id) === runId) : null;
    const rep = runId && !r ? null : ((r ? r.reports : s.reports) || [])[Number(idx)];
    if (!rep) { toast('That report is no longer in the snapshot'); return; }
    const caption = r
      ? [project(pid)?.name, groupName(groupOf(s, r.group)) || r.name, `${fmtWhen(r.startedAt)} UTC`, label(runResult(r).replace(/_/g, ' '))]
      : [project(pid)?.name, s.repoName];
    openReport(rep, caption.filter(Boolean).join(' · '));
  }
  async function readBody(r, onProgress) {
    if (!r.body || typeof r.body.getReader !== 'function') return [await r.arrayBuffer()];
    const reader = r.body.getReader(), parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return parts;
      parts.push(value); n += value.byteLength; onProgress(n);
    }
  }
  function openReport(rep, caption) {
    if (!rep) return;
    if (!hasInline(rep)) { window.open(rep.url, '_blank', 'noopener'); return; }
    if (viewer) viewer.close();
    const inl = rep.inline, size = fmtBytes(inl.bytes), name = rep.name || 'Report';
    const where = /(^|\.)bitbucket\.org$/.test((() => { try { return new URL(rep.url).hostname; } catch { return ''; } })()) ? 'Open on Bitbucket' : 'Open in a new tab';
    const back = document.activeElement;
    // a background refresh may re-render the page meanwhile; focus then returns to the same control
    const backSel = back && back.dataset && back.dataset.act === 'report' && typeof CSS !== 'undefined' && CSS.escape
      ? ['act', 'project', 'run', 'idx'].map(k => `[data-${k}="${CSS.escape(back.dataset[k] || '')}"]`).join('') : '';
    const bg = document.createElement('div'); bg.className = 'modal-bg report-bg';
    bg.innerHTML = `<div class="modal report-viewer" role="dialog" aria-modal="true" aria-label="${esc(name)}">
      <header><div class="rv-title"><h2>${esc(name)}</h2><div class="muted small">${esc([caption, size].filter(Boolean).join(' · '))}</div></div>
        <div class="actions"><a class="btn sm" data-ext href="${esc(rep.url)}" target="_blank" rel="noopener">${where} ↗</a><button type="button" class="btn sm" data-x aria-label="Close the report">✕ Close</button></div></header>
      <div class="rv-body"><div class="rv-state" role="status" aria-live="polite"></div></div></div>`;
    document.body.appendChild(bg); document.body.classList.add('viewing');
    const body = $('.rv-body', bg), state = $('.rv-state', bg);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let frame = null, blobUrl = '', slow = null, closed = false;
    const show = html => { state.innerHTML = html; state.hidden = false; };
    const spin = html => show(`<div class="spinner" aria-hidden="true"></div><p>${html}</p>`);
    const fail = msg => show(`<p>${esc(msg)}</p><p><a class="btn" href="${esc(rep.url)}" target="_blank" rel="noopener">${where} ↗</a></p>`);
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    const close = () => {
      if (closed) return; closed = true;
      if (ctl) ctl.abort();
      clearTimeout(slow);
      document.removeEventListener('keydown', onKey);
      if (frame) frame.remove();
      bg.remove(); document.body.classList.remove('viewing');
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      viewer = null;
      const to = back && back.isConnected ? back : backSel ? $(backSel) : null;
      if (to && typeof to.focus === 'function') to.focus();
    };
    viewer = { close };
    document.addEventListener('keydown', onKey);
    $('[data-x]', bg).addEventListener('click', close);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });

    const mount = (src, sandbox) => {
      frame = document.createElement('iframe');
      frame.title = name;
      frame.setAttribute('sandbox', sandbox);
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.addEventListener('load', () => { clearTimeout(slow); if (!closed) state.hidden = true; }, { once: true });
      frame.src = src;
      body.prepend(frame);
      slow = setTimeout(() => {
        if (closed || state.hidden) return;
        show(`<div class="spinner" aria-hidden="true"></div><p>Still loading. A large report takes a while; the link above opens it on its own.</p><button type="button" class="btn" data-peek>Show what has loaded</button>`);
        $('[data-peek]', state).addEventListener('click', () => { state.hidden = true; });
      }, 30000);
    };
    const loadUrl = () => {
      spin(`Loading the report${size ? ` (${esc(size)})` : ''}…`);
      let same = true;
      try { same = new URL(inl.src, location.href).origin === location.origin; } catch { /* treat as this origin */ }
      mount(inl.src, same ? BLOB_SANDBOX : BLOB_SANDBOX + ' allow-same-origin allow-forms');
    };
    const loadRepo = async () => {
      const g = ghConfig(), local = S.backend === 'server';
      if (!local && !g.token) {
        fail('This report is kept in the tracker repository on GitHub. Connect this page to GitHub (Data → Connect to GitHub) to open it here.');
        return;
      }
      spin(`Fetching the report from GitHub${size ? ` <span data-progress>(${esc(size)})</span>` : ' <span data-progress></span>'}…`);
      const path = inl.path.split('/').map(encodeURIComponent).join('/');
      let r;
      try {
        r = local
          ? await fetch(`/api/report?ref=${encodeURIComponent(inl.ref)}&path=${encodeURIComponent(inl.path)}`, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
          : await fetch(`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${path}?ref=${encodeURIComponent(inl.ref)}`, {
            headers: { Authorization: `Bearer ${g.token}`, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' },
            signal: ctl ? ctl.signal : undefined,
          });
      } catch { if (!closed) fail(local ? 'The local server could not be reached, so the report did not load.' : 'GitHub could not be reached, so the report did not load.'); return; }
      if (closed) return;
      if (!r.ok && local && r.status !== 404) {
        let msg = ''; try { msg = (await r.json()).error || ''; } catch { /* no body */ }
        fail(`The local server could not fetch the report from GitHub${msg ? ': ' + msg : ''}.`);
        return;
      }
      if (!r.ok) {
        const limited = r.headers.get('x-ratelimit-remaining') === '0';
        fail(r.status === 404 ? 'This report is not in the tracker repository any more. Only the newest reports are kept there, and a new one is added by the next collection.'
          : r.status === 401 ? 'GitHub rejected the token in this browser (401), so the report cannot be fetched. Connect again on the Data page.'
          : r.status === 403 && limited ? 'GitHub’s rate limit for this token is used up. Try again later.'
          : r.status === 403 ? 'The token in this browser cannot read files in the tracker repository (403). It needs Contents: read.'
          : `GitHub answered ${r.status}, so the report did not load.`);
        return;
      }
      let parts;
      try {
        parts = await readBody(r, n => { const p = $('[data-progress]', state); if (p) p.textContent = `(${fmtBytes(n)}${size ? ' of ' + size : ''})`; });
      } catch { if (!closed) fail('The download stopped before the report was complete.'); return; }
      if (closed) return;
      blobUrl = URL.createObjectURL(new Blob(parts, { type: 'text/html;charset=utf-8' }));
      spin('Opening the report…');
      mount(blobUrl, BLOB_SANDBOX);
    };
    const start = () => (inl.type === 'url' ? loadUrl() : loadRepo());
    let noAsk = false;
    try { noAsk = localStorage.getItem(NOASK_KEY) === '1'; } catch { /* ask every time */ }
    if (inl.bytes >= LARGE_REPORT && !noAsk) {
      show(`<p>This report is <b>${esc(size)}</b>. Showing it here downloads all of it${inl.type === 'repo' ? ' through GitHub' : ''}.</p>
        <button type="button" class="btn primary" data-load>Load the report</button>
        <label class="small"><input type="checkbox" data-noask> Load large reports without asking on this device</label>`);
      const go = $('[data-load]', state);
      go.addEventListener('click', () => {
        if ($('[data-noask]', state).checked) { try { localStorage.setItem(NOASK_KEY, '1'); } catch { /* ask next time */ } }
        start();
      });
      go.focus();
    } else {
      start();
      $('[data-x]', bg).focus();
    }
  }
  const progressOf = (pid, lid) => learning().progress[`${pid}|${lid}`] || { status: 'not-started' };
  const enrollmentsOf = pid => learning().enrollments.filter(e => e.personId === pid);
  const visibleLearning = () => canSeeHistory() ? learning() : {
    enrollments: learning().enrollments.filter(e => canSeeLearningOf(e.personId)),
    progress: Object.fromEntries(Object.entries(learning().progress).filter(([k]) => canSeeLearningOf(k.slice(0, k.indexOf('|'))))),
  };

  // Every status change of a lesson is kept in history as {status, at}, with `on` when the day it
  // stands for is not the day it was recorded.
  const FINISHED = new Set(['done', 'gate-passed']);
  const CLICK_THROUGH_MS = 60000;
  // Status runs of one lesson. A status replaced within a minute was only passed through (a matrix
  // cell cycles), so it does not count; a repeated status with `on` corrects the day of its run.
  function marksOf(pr) {
    if (!pr) return [];
    const h = Array.isArray(pr.history) && pr.history.length ? pr.history
      : pr.status && pr.status !== 'not-started' && pr.date ? [{ status: pr.status, at: pr.date }] : [];
    const merge = list => list.reduce((out, e) => {
      const last = out[out.length - 1];
      if (last && last.status === e.status) { if (e.on) last.on = e.on; } else out.push({ status: e.status, at: e.at, on: e.on || '' });
      return out;
    }, []);
    const runs = merge(h.filter(e => e && e.status && e.at));
    const gap = (a, b) => isDay(a) || isDay(b) ? Infinity : Date.parse(b) - Date.parse(a);
    return merge(runs.filter((r, i) => !runs[i + 1] || !(gap(r.at, runs[i + 1].at) < CLICK_THROUGH_MS)))
      .map(r => ({ status: r.status, at: r.at, when: r.on || r.at }));
  }
  function lessonDates(pr) {
    const runs = marksOf(pr);
    const first = f => (runs.find(f) || {}).when || '';
    return { startedAt: first(r => r.status !== 'not-started'), doneAt: first(r => FINISHED.has(r.status)), gatePassedAt: first(r => r.status === 'gate-passed') };
  }
  // An undefined note keeps the note already there.
  function applyMark(l, pid, lid, status, note, at, on) {
    const key = `${pid}|${lid}`, prev = l.progress[key];
    const was = (prev && prev.status) || 'not-started';
    const history = prev && Array.isArray(prev.history) ? prev.history.slice() : [];
    if (!history.length && was !== 'not-started' && prev.date) history.push({ status: was, at: prev.date });
    const changed = status !== was;
    const redated = !changed && !!on && on !== (prev && prev.date) && was !== 'not-started';
    const last = history[history.length - 1];
    if ((changed || redated) && !(last && last.at === at && last.status === status)) history.push(on && (redated || on !== dayOf(at)) ? { status, at, on } : { status, at });
    const text = note === undefined ? (prev && prev.note) || '' : note;
    if (!history.length && status === 'not-started' && !text) { delete l.progress[key]; return; }
    const e = { ...prev, status, date: on || (changed || !(prev && prev.date) ? today() : prev.date), note: text };
    if (history.length) e.history = history; else delete e.history;
    const d = lessonDates(e);
    for (const k of ['startedAt', 'doneAt', 'gatePassedAt']) { if (d[k]) e[k] = d[k]; else delete e[k]; }
    l.progress[key] = e;
  }
  // A conflict reloads the file and applies the change again on top, so nobody's marks are lost.
  async function saveLearning(mutate) {
    for (let i = 0; ; i++) {
      mutate(learning());
      const r = await save('learning', { replay: i < 2 });
      if (r !== 'conflict') return r;
    }
  }

  // Supplements (optional) and practicums that continue a lesson (partOf) are listed but not
  // counted, the way the course author counts lessons.
  const counted = l => !l.optional && !l.partOf;
  function courseSummary(pid, courseId) {
    const c = course(courseId); if (!c) return null;
    const ls = lessonsOf(c).filter(counted);
    const counts = Object.fromEntries(LESSON_STATUS.map(s => [s, 0]));
    let current = null, lastDate = '';
    for (const l of ls) {
      const p = progressOf(pid, l.id); counts[p.status] = (counts[p.status] || 0) + 1;
      if (p.date && p.date > lastDate) lastDate = p.date;
      if (!current && !['done', 'gate-passed'].includes(p.status)) current = l;
    }
    const complete = counts.done + counts['gate-passed'];
    return { course: c, total: ls.length, counts, complete, pct: ls.length ? Math.round(100 * complete / ls.length) : 0, current, lastDate };
  }

  function attention() {
    const out = [], st = settings(), t = today();
    for (const p of projects()) {
      if (p.status !== 'active') continue;
      if (p.health === 'red') out.push({ lvl: 'red', text: `${p.name}: health red — ${p.healthReason || 'no reason recorded'}`, href: `#/projects/${p.id}` });
      else if (p.health === 'yellow') out.push({ lvl: 'yellow', text: `${p.name}: health yellow — ${p.healthReason || 'no reason recorded'}`, href: `#/projects/${p.id}` });
      const due = p.nextMilestone?.due;
      if (due && due < t) out.push({ lvl: 'red', text: `${p.name}: milestone overdue since ${due} — ${p.nextMilestone.text}`, href: `#/projects/${p.id}` });
      if (canSeeHistory()) {
        const la = projectActs(p.id)[0];
        const n = la ? daysSince(la.date) : null;
        if (n == null) out.push({ lvl: 'grey', text: `${p.name}: no activity logged yet`, href: `#/projects/${p.id}` });
        else if (n > (st.staleProjectDays || 7)) out.push({ lvl: 'yellow', text: `${p.name}: no update for ${n} days`, href: `#/projects/${p.id}` });
      }
    }
    for (const p of projects()) {
      if (p.status !== 'active') continue;
      const s = ciSource(p.id);
      if (!s) continue;
      const bad = failingGroups(s);
      const reg = bad.filter(g => g.kind === 'regression').map(g => g.env || g.title);
      const rest = bad.filter(g => g.kind !== 'regression').map(g => `${KIND_TITLE[g.kind] || g.kind} ${g.env || ''}`.trim());
      if (reg.length) out.push({ lvl: 'red', text: `${p.name}: regression failing on ${reg.join(', ')}`, href: `#/projects/${p.id}/ci` });
      if (rest.length) out.push({ lvl: 'yellow', text: `${p.name}: failing ${rest.join('; ')}`, href: `#/projects/${p.id}/ci` });
      if (s.status === 'error') out.push({ lvl: 'yellow', text: `${p.name}: CI collector cannot read ${s.repoName || 'the source'} — ${trunc(s.error, 80)}`, href: `#/ci` });
    }
    const age = ciAge();
    if (age && age.stale) out.push({ lvl: 'yellow', text: `CI snapshot is ${Math.round(age.hours)} hours old`, href: '#/ci' });
    for (const b of openBlockers()) {
      out.push({ lvl: 'red', text: `Blocker${b.projectId ? ' on ' + (project(b.projectId)?.name || '') : ''}${b.personId ? ' (' + pname(b.personId) + ')' : ''}: ${trunc(b.text, 120)}`, href: b.projectId ? `#/projects/${b.projectId}` : '#/activity' });
    }
    for (const p of activePeople().filter(x => canSeeThreadOf(x.id))) {
      const q = openAsks(p.id);
      if (q.length) out.push({ lvl: 'yellow', text: `${p.name}: ${q.length} open question${q.length === 1 ? '' : 's'}, oldest ${ago((q[0].at || '').slice(0, 10))}`, href: `#/people/${p.id}/questions` });
    }
    for (const m of mentees()) {
      if (canSeeHistory()) {
        const o = lastOneOnOne(m.id);
        if (!o) out.push({ lvl: 'grey', text: `${m.name}: no 1:1 logged yet`, href: `#/people/${m.id}` });
        else if (daysSince(o.date) > (st.oneOnOneCadenceDays || 7)) out.push({ lvl: 'yellow', text: `${m.name}: last 1:1 ${ago(o.date)}`, href: `#/people/${m.id}` });
      }
      for (const e of canSeeLearningOf(m.id) ? enrollmentsOf(m.id) : []) {
        const cs = courseSummary(m.id, e.courseId); if (!cs) continue;
        const stuck = lessonsOf(cs.course).filter(l => progressOf(m.id, l.id).status === 'stuck');
        for (const l of stuck) out.push({ lvl: 'red', text: `${m.name}: stuck on ${l.title} (${cs.course.name})`, href: `#/people/${m.id}` });
        if (cs.lastDate && daysSince(cs.lastDate) > (st.staleLearningDays || 14) && cs.pct < 100) out.push({ lvl: 'yellow', text: `${m.name}: no learning progress for ${daysSince(cs.lastDate)} days (${cs.course.name})`, href: `#/people/${m.id}` });
        if (!cs.lastDate && cs.pct === 0) out.push({ lvl: 'grey', text: `${m.name}: enrolled in ${cs.course.name}, nothing marked yet`, href: `#/learning/${cs.course.id}` });
      }
    }
    const rank = { red: 0, yellow: 1, grey: 2 };
    return out.sort((a, b) => rank[a.lvl] - rank[b.lvl]);
  }

  // ---------- generic modal form
  function form(title, fields, values = {}) {
    return new Promise(resolve => {
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      const fid = uid('f');
      const render = f => {
        if (f.type === 'note') return `<p class="hint" style="margin:0">${esc(f.text)}</p>`;
        const v = values[f.key];
        const req = f.required ? ' required' : '';
        const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
        const cid = `${fid}-${f.key}`;
        let ctl = '';
        if (f.type === 'textarea' || f.type === 'lines' || f.type === 'records') {
          const val = f.type === 'lines' ? nl(v) : f.type === 'records' ? recordsToLines(v, f.cols) : (v ?? '');
          ctl = `<textarea name="${f.key}"${req} ${f.rows ? `style="min-height:${f.rows * 22}px"` : ''}>${esc(val)}</textarea>`;
        } else if (f.type === 'select') {
          ctl = `<select name="${f.key}">${(f.allowEmpty ? [{ value: '', label: f.emptyLabel || '—' }] : []).concat(f.options).map(o => `<option value="${esc(o.value)}"${String(o.value) === String(v ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        } else if (f.type === 'multiselect') {
          const set = new Set(v || []);
          ctl = `<div class="checks">${f.options.map(o => `<label><input type="checkbox" name="${f.key}" value="${esc(o.value)}"${set.has(o.value) ? ' checked' : ''}> ${esc(o.label)}</label>`).join('') || '<span class="hint">nothing to pick yet</span>'}</div>`;
        } else if (f.type === 'checkbox') {
          ctl = `<div class="checks"><label><input type="checkbox" name="${f.key}"${v ? ' checked' : ''}> ${esc(f.text || f.label)}</label></div>`;
        } else {
          ctl = `<input type="${f.type || 'text'}" name="${f.key}" value="${esc(v ?? '')}"${req}${f.step ? ` step="${f.step}"` : ''}>`;
        }
        const hasCtl = /^<(input|select|textarea)/.test(ctl);
        return `<div class="field"><label${hasCtl ? ` for="${cid}"` : ''}>${esc(f.label)}</label>${hasCtl ? ctl.replace(/^<(input|select|textarea)/, `<$1 id="${cid}"`) : ctl}${help}</div>`;
      };
      bg.innerHTML = `<form class="modal" id="${fid}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" class="btn ghost" data-x aria-label="Close">✕</button></header>
        <div class="body">${fields.map(render).join('')}</div>
        <footer><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary">Save</button></footer></form>`;
      document.body.appendChild(bg);
      let dirty = false;
      const close = val => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
      const cancel = () => { if (!dirty || confirm('Discard what you typed?')) close(null); };
      const onKey = e => { if (e.key === 'Escape') cancel(); };
      document.addEventListener('keydown', onKey);
      bg.addEventListener('click', e => { if (e.target === bg) cancel(); });
      $$('[data-x]', bg).forEach(b => b.addEventListener('click', cancel));
      const fm = $('#' + fid);
      fm.addEventListener('input', () => { dirty = true; }); fm.addEventListener('change', () => { dirty = true; });
      fm.addEventListener('submit', e => {
        e.preventDefault();
        const out = {};
        for (const f of fields) {
          if (f.type === 'note') continue;
          // a list left as it was comes back as it was, not as the lines it was shown in
          const ta = fm.elements[f.key];
          if ((f.type === 'lines' || f.type === 'records') && Array.isArray(values[f.key]) && ta.value === ta.defaultValue) out[f.key] = clone(values[f.key]);
          else if (f.type === 'multiselect') out[f.key] = $$(`input[name="${f.key}"]:checked`, fm).map(i => i.value);
          else if (f.type === 'checkbox') out[f.key] = $(`input[name="${f.key}"]`, fm).checked;
          else if (f.type === 'lines') out[f.key] = parseLines(fm.elements[f.key].value);
          else if (f.type === 'records') out[f.key] = parseRecords(fm.elements[f.key].value, f.cols);
          else if (f.type === 'number') out[f.key] = fm.elements[f.key].value === '' ? null : Number(fm.elements[f.key].value);
          else out[f.key] = fm.elements[f.key].value.trim();
        }
        close(out);
      });
      const first = fm.querySelector('input:not([type=checkbox]), textarea, select'); if (first) first.focus();
    });
  }

  const opt = (arr, lab = label) => arr.map(v => ({ value: v, label: lab(v) }));
  const peopleOpts = (keep = []) => people().filter(p => p.active !== false || keep.includes(p.id)).map(p => ({ value: p.id, label: p.name + (p.active === false ? ' (inactive)' : '') }));
  const projectOpts = () => projects().map(p => ({ value: p.id, label: p.name }));
  const wsOpts = () => projects().flatMap(p => (p.workstreams || []).map(w => ({ value: `${p.id}:${w.id}`, label: `${p.name} › ${w.name}` })));

  // ---------- actions
  async function editProject(id) {
    const lead = canSeeHistory();
    const p = id ? project(id) : { id: '', status: 'active', health: 'unknown', memberIds: [], workstreams: [] };
    if (!p || (id ? !canEditProject(p) : !lead)) return;
    const base = clone(p), envs = p.environments || [];
    const v = await form(id ? `Edit project — ${p.name}` : 'New project', [
      { type: 'note', text: 'As the project’s lead you edit what is written and planned in it. Its name, client, lead, members, start date, repositories, list of environments and local docs are set by the team lead.', own: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'code', label: 'Short code', help: 'e.g. ALPHA, REPIPE' },
      { key: 'client', label: 'Client / product owner' },
      { key: 'status', label: 'Status', type: 'select', options: opt(STATUS), own: true },
      { key: 'health', label: 'Health', type: 'select', options: opt(HEALTH), own: true },
      { key: 'healthReason', label: 'Health reason', type: 'textarea', rows: 2, help: 'Why green / yellow / red right now', own: true },
      { key: 'leadId', label: 'Lead (your mentee who runs it)', type: 'select', options: peopleOpts([p.leadId]), allowEmpty: true, emptyLabel: 'Unassigned' },
      { key: 'memberIds', label: 'Other members', type: 'multiselect', options: peopleOpts(p.memberIds || []) },
      { key: 'summary', label: 'Summary', type: 'textarea', own: true },
      { key: 'startedOn', label: 'Started on', type: 'date' },
      { key: 'milestoneText', label: 'Next milestone', own: true },
      { key: 'milestoneDue', label: 'Milestone due', type: 'date', own: true },
      { key: 'stackText', label: 'Stack', help: 'comma-separated', own: true },
      { key: 'aliasesText', label: 'Aliases', help: 'comma-separated, other names people use' },
      { key: 'repos', label: 'Repositories', type: 'records', cols: ['name', 'url', 'branch', 'localPath'], help: 'one per line: name | url | branch | local path' },
      { key: 'environments', label: 'Environments', type: 'records', cols: ['name', 'url'], help: 'one per line: name | url' },
      ...envs.flatMap((e, i) => [
        { key: `envStatus${i}`, label: `${e.name} — status`, type: 'select', options: opt([...new Set([...ENV_STATUS, ...(e.status ? [e.status] : [])])]), allowEmpty: true, emptyLabel: 'not set', own: true },
        { key: `envNotes${i}`, label: `${e.name} — notes`, type: 'textarea', own: true },
      ]),
      { key: 'systems', label: 'Systems involved', type: 'records', cols: ['name', 'url', 'role'], help: 'one per line: name | url | role', own: true },
      { key: 'localDocs', label: 'Local docs', type: 'records', cols: ['path', 'what'], help: 'one per line: path | what it is' },
      { key: 'keyFacts', label: 'Key facts', type: 'lines', rows: 5, help: 'one per line', own: true },
      { key: 'risks', label: 'Risks', type: 'lines', help: 'one per line', own: true },
      { key: 'openQuestions', label: 'Open questions', type: 'lines', help: 'one per line', own: true },
      { key: 'nextSteps', label: 'Next steps', type: 'lines', help: 'one per line', own: true },
      { key: 'notes', label: 'Notes', type: 'textarea', own: true },
    ].filter(f => lead ? f.type !== 'note' : f.own), {
      ...p,
      milestoneText: p.nextMilestone?.text || '', milestoneDue: p.nextMilestone?.due || '',
      stackText: (p.stack || []).join(', '), aliasesText: (p.aliases || []).join(', '),
      ...Object.fromEntries(envs.flatMap((e, i) => [[`envStatus${i}`, e.status || ''], [`envNotes${i}`, e.notes || '']])),
    });
    if (!v) return;
    const envList = listEnvs(lead ? v.environments : envs.map(e => ({ name: e.name, url: e.url })), envs, v);
    const np = {
      ...p,
      status: v.status, health: v.health, healthReason: v.healthReason, summary: v.summary,
      nextMilestone: { text: v.milestoneText, due: v.milestoneDue },
      stack: v.stackText.split(',').map(s => s.trim()).filter(Boolean),
      systems: keepUnshown(v.systems, p.systems, ['name']),
      keyFacts: v.keyFacts, risks: v.risks, openQuestions: v.openQuestions, nextSteps: v.nextSteps, notes: v.notes,
      environments: envList.list,
      ...(lead ? {
        id: p.id || slug(v.name),
        name: v.name, code: v.code, client: v.client, leadId: v.leadId || '', memberIds: v.memberIds, startedOn: v.startedOn,
        aliases: v.aliasesText.split(',').map(s => s.trim()).filter(Boolean),
        repos: keepUnshown(v.repos, p.repos, ['name']),
        localDocs: keepUnshown(v.localDocs, p.localDocs, ['path']),
      } : {}),
      updatedOn: today(),
    };
    if (!id) {
      if (await saveProject(np.id, { create: np })) location.hash = `#/projects/${np.id}`;
      render(); return;
    }
    const ops = diffOps(base, np, envList.renames);
    if (!ops.length) { toast('Nothing changed'); return; }
    // A renamed environment keeps its marks; only what was really rewritten is marked.
    const was = renamedEnvs(base, envList.renames);
    await saveProject(id, { base, ops, marks: reviewKeys(was, np).filter(k => !sameText(getPath(was, k), getPath(np, k))) });
    location.hash = `#/projects/${id}`; render();
  }
  // The form lists each environment's name and url; its status and notes have fields of their own.
  // A line with a new name takes over the environment it replaced, found by its url, or by its line
  // when one of the two has no url: a rename, which keeps everything else the environment holds.
  // A new name with a new url is another environment, and starts empty.
  function listEnvs(lines, envs, v) {
    const names = new Set(lines.map(l => l.name)), used = new Set(), gone = e => !names.has(e.name) && !used.has(e);
    const from = lines.map((l, i) => {
      const e = envs.find(x => x.name === l.name) || envs.find(x => gone(x) && x.url && x.url === l.url) || (envs[i] && gone(envs[i]) && (!l.url || !envs[i].url) ? envs[i] : null);
      if (e) used.add(e);
      return e;
    });
    const list = lines.map((l, i) => {
      const e = from[i], k = envs.indexOf(e);
      return e ? { ...e, name: l.name, url: l.url, status: v[`envStatus${k}`], notes: v[`envNotes${k}`] } : { name: l.name, url: l.url };
    });
    return { list, renames: from.map((e, i) => e && e.name !== lines[i].name ? [e.name, lines[i].name] : null).filter(Boolean) };
  }

  // ---------- project saves that keep everyone's changes
  // Fields the weekly review also writes. A change made here is marked in `edited`; the review then
  // leaves that field alone and files its own answer under `suggested` instead.
  const REVIEWED = ['summary', 'healthReason', 'health', 'keyFacts', 'risks', 'openQuestions', 'nextSteps'];
  const envKeys = r => (r.environments || []).flatMap(e => [`environments/${e.name}/notes`, `environments/${e.name}/status`]);
  const reviewKeys = (...rs) => [...new Set([...REVIEWED, ...rs.flatMap(envKeys)])];
  // A path names one field of a project record: `summary`, `environments/<name>/notes`,
  // `environment/<name>` (one environment as a whole), `workstreams/<id>`, `edited/<field>`,
  // `suggested/<field>`, and ENV_ORDER for the order of the environments.
  const ENV_ORDER = 'environmentOrder';
  function splitPath(path) {
    const i = path.indexOf('/'); if (i < 0) return { key: path };
    const top = path.slice(0, i), rest = path.slice(i + 1), j = rest.lastIndexOf('/');
    if (top === 'environments') return { env: rest.slice(0, j), prop: rest.slice(j + 1) };
    if (top === 'environment') return { whole: rest };
    if (top === 'workstreams') return { ws: rest };
    return { map: top, key: rest };
  }
  const envOf = (r, name) => (r.environments || []).find(e => e.name === name);
  const wsOf = (r, id) => (r.workstreams || []).find(w => w.id === id);
  const envNames = r => (r.environments || []).map(e => e.name);
  function getPath(r, path) {
    if (path === ENV_ORDER) return envNames(r);
    const s = splitPath(path);
    if (s.env !== undefined) return envOf(r, s.env)?.[s.prop];
    if (s.whole !== undefined) return envOf(r, s.whole);
    if (s.ws !== undefined) return wsOf(r, s.ws);
    if (s.map) return r[s.map]?.[s.key];
    return r[s.key];
  }
  const putItem = (list, i, v) => { if (v === undefined) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = v; else list.push(v); };
  // An environment that is no longer in the record is left alone; the caller reports it. Names the
  // order does not know keep their place after the ones it does.
  function setPath(r, path, v) {
    if (path === ENV_ORDER) { const at = n => { const i = v.indexOf(n); return i < 0 ? v.length : i; }; r.environments = (r.environments || []).map((e, i) => [e, i]).sort(([x, i], [y, j]) => at(x.name) - at(y.name) || i - j).map(([e]) => e); return; }
    const s = splitPath(path);
    if (s.env !== undefined) { const e = envOf(r, s.env); if (e) { if (v === undefined) delete e[s.prop]; else e[s.prop] = v; } return; }
    if (s.whole !== undefined) { const list = r.environments ||= []; putItem(list, list.findIndex(e => e.name === s.whole), v); return; }
    if (s.ws !== undefined) { const list = r.workstreams ||= []; putItem(list, list.findIndex(w => w.id === s.ws), v); return; }
    if (s.map) { const m = r[s.map] ||= {}; if (v === undefined) delete m[s.key]; else m[s.key] = v; if (!Object.keys(m).length) delete r[s.map]; return; }
    if (v === undefined) delete r[s.key]; else r[s.key] = v;
  }
  // A renamed environment takes its marks and pending suggestions along.
  function renameEnv(r, was, now) {
    envOf(r, was).name = now;
    for (const m of ['edited', 'suggested']) for (const k of Object.keys(r[m] || {})) {
      const s = splitPath(k);
      if (s.env === was) { r[m][`environments/${now}/${s.prop}`] = r[m][k]; delete r[m][k]; }
    }
  }
  const renamedEnvs = (r, renames) => { const c = clone(r); for (const [was, now] of renames) if (envOf(c, was)) renameEnv(c, was, now); return c; };
  const isRename = op => { const s = splitPath(op.path); return s.env !== undefined && s.prop === 'name'; };
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  // Blank is blank however it is stored, and whitespace around text is not a change.
  function canon(v) {
    if (typeof v === 'string') return v.replace(/\r\n?/g, '\n').trim();
    if (Array.isArray(v)) { const a = v.map(canon).filter(x => x !== ''); return a.length ? a : ''; }
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) { const x = canon(v[k]); if (x !== '') o[k] = x; } return Object.keys(o).length ? o : ''; }
    return v == null ? '' : v;
  }
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  // Text that differs only in its spacing or line breaks says the same; the weekly review compares
  // the same way. Such a difference is saved but never marks a field or makes a suggestion.
  const loose = v => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : Array.isArray(v) ? v.map(loose)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, loose(x)])) : v;
  const sameText = (a, b) => same(loose(a), loose(b));
  // What a save changed, field by field, so it can be applied again to a newer copy of the record.
  // Environments are matched by name, renames included, so a change to one never carries the others.
  function diffOps(a, b, renames = []) {
    const ops = [], add = (path, from, to) => { if (!same(from, to)) ops.push({ path, from: clone(from), to: clone(to) }); };
    const ids = r => (r.workstreams || []).map(w => w.id);
    const unique = xs => xs.every(Boolean) && new Set(xs).size === xs.length;
    const byName = unique(envNames(a)) && unique(envNames(b));
    if (byName) {
      const was = renamedEnvs(a, renames);
      for (const [from, to] of renames) ops.push({ path: `environments/${from}/name`, from, to });
      for (const e of b.environments || []) {
        const w = envOf(was, e.name);
        if (!w) { add(`environment/${e.name}`, undefined, e); continue; }
        for (const x of new Set([...Object.keys(w), ...Object.keys(e)])) if (x !== 'name') add(`environments/${e.name}/${x}`, w[x], e[x]);
      }
      for (const e of was.environments || []) if (!envOf(b, e.name)) add(`environment/${e.name}`, e, undefined);
      const kept = envNames(was).filter(n => envOf(b, n)).concat(envNames(b).filter(n => !envOf(was, n)));
      if (kept.join('\n') !== envNames(b).join('\n')) ops.push({ path: ENV_ORDER, from: envNames(was), to: envNames(b) });
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === 'edited' || k === 'suggested' || k === 'updatedOn' || (k === 'environments' && byName)) continue;
      if (k === 'workstreams' && unique(ids(a)) && unique(ids(b))) {
        for (const w of new Set([...ids(a), ...ids(b)])) add(`workstreams/${w}`, wsOf(a, w), wsOf(b, w));
      } else add(k, a[k], b[k]);
    }
    return ops;
  }
  // Settled at load, never from the per-browser choice.
  const editorId = () => S.me || (canSeeHistory() ? S.leadMe : '');
  // Who changed a field between two copies of a record, where the record says so.
  function changedBy(was, now, path) {
    const s = splitPath(path);
    if (s.map === 'suggested') { const g = now.suggested?.[s.key]; return g ? `the weekly review${g.on ? ' on ' + g.on : ''}` : ''; }
    const m = now.edited?.[path];
    if (m && !same(m, was.edited?.[path])) return `${m.by ? pname(m.by) : 'someone'}${m.on ? ' on ' + m.on : ''}`;
    const reviewed = REVIEWED.includes(path) || (s.env !== undefined && ['notes', 'status'].includes(s.prop));
    const seen = s.env !== undefined && getPath(now, `environments/${s.env}/checkedOn`) !== getPath(was, `environments/${s.env}/checkedOn`);
    return reviewed && (seen || !same(now.checkedAgainst, was.checkedAgainst)) ? 'the weekly review' : '';
  }
  const FIELD_NAMES = { name: 'Name', code: 'Short code', client: 'Client', status: 'Status', health: 'Health', healthReason: 'Health reason', leadId: 'Lead', memberIds: 'Other members', summary: 'Summary', startedOn: 'Started on', nextMilestone: 'Next milestone', stack: 'Stack', aliases: 'Aliases', repos: 'Repositories', environments: 'Environments', systems: 'Systems involved', localDocs: 'Local docs', keyFacts: 'Key facts', risks: 'Risks', openQuestions: 'Open questions', nextSteps: 'Next steps', notes: 'Notes', workstreams: 'Workstreams' };
  function fieldLabel(path, hint) {
    if (path === ENV_ORDER) return 'Order of the environments';
    const s = splitPath(path);
    if (s.map === 'suggested') return `Suggestion for ${fieldLabel(s.key)}`;
    if (s.env !== undefined) return `${s.env} — ${s.prop}`;
    if (s.whole !== undefined) return `Environment “${s.whole}”`;
    if (s.ws !== undefined) return `Workstream ${hint && hint.name ? `“${hint.name}”` : s.ws}`;
    return FIELD_NAMES[path] || label(path);
  }
  const recText = o => Object.entries(o).filter(([k, x]) => k !== 'id' && (typeof x === 'string' || typeof x === 'number') && String(x).trim()).map(([k, x]) => k === 'ownerId' ? pname(x) : String(x)).join(' · ');
  function fmtVal(path, v) {
    const s = splitPath(path);
    if (s.map === 'suggested') return v ? fmtVal(s.key, v.value) : '<span class="muted">none: you settled it</span>';
    if (canon(v) === '') return '<span class="muted">empty</span>';
    if (Array.isArray(v)) return `<ul class="plain">${v.map(x => `<li>${esc(x && typeof x === 'object' ? recText(x) : x)}</li>`).join('')}</ul>`;
    if (typeof v === 'object') return esc(recText(v));
    return `<span style="white-space:pre-wrap">${esc(v)}</span>`;
  }

  // Why a suggestion the page showed is no longer there to settle. A dismiss keeps the mark of whoever
  // wrote the field, so only a new mark names a person.
  function settledMeanwhile(was, now, key) {
    const m = now.edited?.[key], old = was.edited?.[key];
    const wrote = !!m && (m.by !== old?.by || m.on !== old?.on || !same(getPath(now, key), getPath(was, key)));
    if (now.suggested?.[key] || (!wrote && same(m, old))) return 'The weekly review changed or withdrew this suggestion; the page now shows the current one.';
    if (!m) return 'This suggestion was already accepted meanwhile; the page now shows the field as it is.';
    if (wrote) return `${m.by ? pname(m.by) : 'Someone'} edited this field meanwhile${m.on ? ' on ' + m.on : ''}, so the suggestion is settled; the page now shows the field as it is.`;
    return 'This suggestion was already dismissed meanwhile; the page now shows the field as it is.';
  }

  // Fields this save and somebody else both changed: the person picks, field by field.
  function askConflicts(p, items) {
    return new Promise(resolve => {
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      const fid = uid('f');
      bg.innerHTML = `<form class="modal" id="${fid}" role="dialog" aria-modal="true" aria-label="Changed while you were editing"><header><h2>Changed while you were editing</h2><button type="button" class="btn ghost" data-x aria-label="Close">✕</button></header>
        <div class="body"><p class="small" style="margin:0">${esc(p.name)} was saved again after you opened it, and ${items.length === 1 ? 'this field was' : 'these fields were'} changed there too. Choose what to keep. Everything else you changed is saved either way.</p>
        ${items.map((it, i) => `<fieldset data-conflict="${esc(it.path)}" style="display:grid;gap:4px;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin:0;min-width:0"><legend class="small"><b>${esc(it.label)}</b></legend>
          <div class="hint">${it.by ? `Changed meanwhile by ${esc(it.by)}.` : 'Changed meanwhile; the record does not say by whom.'}</div>
          <div class="checks"><label><input type="radio" name="c${i}" value="mine" required> Keep yours</label></div><div class="small" style="padding-left:22px">${it.mine}</div>
          <div class="checks"><label><input type="radio" name="c${i}" value="fresh"> Take the saved one</label></div><div class="small" style="padding-left:22px">${it.fresh}</div></fieldset>`).join('')}</div>
        <footer><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary">Save</button></footer></form>`;
      document.body.appendChild(bg);
      const close = val => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      $$('[data-x]', bg).forEach(b => b.addEventListener('click', () => close(null)));
      const fm = $('#' + fid);
      fm.addEventListener('submit', e => { e.preventDefault(); close(Object.fromEntries(items.map((it, i) => [it.path, fm.elements[`c${i}`].value]))); });
      $('input', fm).focus();
    });
  }

  // A project save carries only the fields it changed. When the file moved on meanwhile (another
  // person, or the weekly review), it is read again and those fields are applied to the fresh
  // record; a field changed on both sides is put to the person instead of being overwritten.
  async function saveProject(id, { base = null, ops = [], marks = [], kind = 'edit', create = null, remove = false } = {}) {
    const chosen = {}, sop = kind === 'edit' ? null : ops.find(op => splitPath(op.path).map === 'suggested');
    let unsaved = new Map();
    const unsavedText = () => [...unsaved].map(([k, why]) => `${fieldLabel(k)} (${why})`).join('; ');
    for (let i = 0; ; i++) {
      const list = projects(), cur = list.find(x => x.id === id);
      if (create) {
        if (cur) { toast(`Not saved: a project with the id ${id} was added meanwhile.`, 4000); render(); return false; }
        list.push(clone(create));
      } else if (remove) {
        if (!cur) return true;
        list.splice(list.indexOf(cur), 1);
      } else {
        if (!cur) { toast('Not saved: this project was deleted meanwhile.', 4000); render(); return false; }
        if (!canEditProject(cur)) { toast('Not saved: you no longer lead this project.', 4000); render(); return false; }
        // Accepting or dismissing answers one suggestion; once it has been replaced or settled, nothing is done.
        if (sop && !same(getPath(cur, sop.path), sop.from)) { toast(settledMeanwhile(base || cur, cur, splitPath(sop.path).key), 5000); render(); return false; }
        const r = clone(cur), mine = [], done = new Set(), wrote = new Set();
        unsaved = new Map();
        // renames first, so what else changed finds the environment under its new name
        for (const op of ops.filter(isRename)) {
          const was = splitPath(op.path).env;
          if (!mayChange(cur, op.path)) unsaved.set(op.path, 'only the team lead changes it');
          else if (envOf(r, op.to)) { if (envOf(r, was)) unsaved.set(op.path, 'another environment has that name now'); else done.add(op.path); }
          else if (!envOf(r, was)) unsaved.set(op.path, 'that environment is no longer in the record');
          else { renameEnv(r, was, op.to); done.add(op.path); wrote.add(op.path); }
        }
        for (const op of ops) {
          if (isRename(op)) continue;
          const env = splitPath(op.path).env;
          if (!mayChange(cur, op.path)) unsaved.set(op.path, 'only the team lead changes it');
          else if (env !== undefined && !envOf(r, env)) unsaved.set(op.path, 'that environment is no longer in the record');
          else mine.push(op);
        }
        // the order of the environments is taken as it was set, around whatever was added meanwhile
        const moved = op => { if (op.path === ENV_ORDER) return false; const now = getPath(r, op.path); return !same(now, op.from) && !same(now, op.to); };
        const open = mine.filter(op => moved(op) && !(chosen[op.path] && same(chosen[op.path].seen, getPath(r, op.path))));
        if (open.length) {
          const pick = await askConflicts(cur, open.map(op => ({ path: op.path, label: fieldLabel(op.path, op.to || op.from), by: changedBy(base || cur, r, op.path),
            mine: fmtVal(op.path, op.to), fresh: fmtVal(op.path, getPath(r, op.path)) })));
          if (!pick) { toast('Not saved. The project shows what is saved now.', 4000); render(); return false; }
          for (const op of open) chosen[op.path] = { keep: pick[op.path] === 'mine', seen: clone(getPath(r, op.path)) };
          if (projects() !== list || !list.includes(cur)) continue;
        }
        const keepSaved = op => moved(op) && !chosen[op.path].keep;
        // and it is done whole or not at all
        const none = !!sop && (unsaved.size > 0 || mine.some(keepSaved));
        for (const op of mine) {
          if (none || keepSaved(op)) continue;
          if (!same(getPath(r, op.path), op.to)) { const was = JSON.stringify(r); setPath(r, op.path, clone(op.to)); if (JSON.stringify(r) !== was) wrote.add(op.path); }
          done.add(op.path);
        }
        const whole = [...done].some(k => k === 'environments' || splitPath(k).whole !== undefined);
        const did = k => done.has(k) || done.has(`suggested/${k}`) || (k.startsWith('environments/') && (done.has('environments') || done.has(`environment/${splitPath(k).env}`)));
        for (const k of marks.filter(did)) {
          if (kind === 'edit') setPath(r, `edited/${k}`, { by: editorId(), on: today() });
          if (kind === 'accept') setPath(r, `edited/${k}`, undefined);
          // a dismissed answer is remembered with the mark, so the review does not offer it again
          if (kind === 'dismiss' && r.edited?.[k]) r.edited[k] = { ...r.edited[k], dismissed: clone(sop.from.value) };
          if (kind === 'edit' && r.suggested?.[k] && sameText(r.suggested[k].value, getPath(r, k))) setPath(r, `suggested/${k}`, undefined);
        }
        if (whole) {
          for (const m of ['edited', 'suggested']) for (const k of Object.keys(r[m] || {})) { const s = splitPath(k); if (s.env !== undefined && !envOf(r, s.env)) setPath(r, `${m}/${k}`, undefined); }
        }
        if ([...wrote].some(k => !k.startsWith('suggested/'))) r.updatedOn = today();
        if (JSON.stringify(r) === JSON.stringify(cur)) { toast(unsaved.size ? `Not saved: ${unsavedText()}.` : 'Nothing to save: the project already holds what you chose.', 5000); render(); return !unsaved.size; }
        list.splice(list.indexOf(cur), 1, r);
      }
      const res = await save('projects', { replay: i < 2 });
      if (res === 'conflict') continue;
      if (res && (i || unsaved.size)) toast(unsaved.size ? `Saved, except ${unsavedText()}.` : 'Saved, together with the changes made meanwhile.', 5000);
      return res;
    }
  }

  // Accepting hands the field back to the weekly review; dismissing keeps what is there.
  const LIST_FIELDS = ['keyFacts', 'risks', 'openQuestions', 'nextSteps'];
  function suggestionFits(key, v) {
    if (LIST_FIELDS.includes(key)) return Array.isArray(v) && v.every(x => typeof x === 'string');
    if (key === 'health') return HEALTH.includes(v);
    if (/^environments\/.+\/status$/.test(key)) return ENV_STATUS.includes(v);
    return (REVIEWED.includes(key) || /^environments\/.+\/notes$/.test(key)) && typeof v === 'string';
  }
  async function settleSuggestion(id, key, accept) {
    const p = project(id); if (!canEditProject(p)) return;
    if (!mayChange(p, key)) { toast('Only the team lead settles a suggestion for this field.', 4000); return; }
    const s = p.suggested?.[key]; if (!s) return;
    if (accept && !suggestionFits(key, s.value)) { toast('This suggestion does not fit the field, so it cannot be accepted. Dismiss it instead.', 4000); return; }
    const ops = [{ path: `suggested/${key}`, from: clone(s), to: undefined }];
    if (accept) ops.unshift({ path: key, from: clone(getPath(p, key)), to: clone(s.value) });
    await saveProject(id, { base: clone(p), ops, marks: [key], kind: accept ? 'accept' : 'dismiss' });
    render();
  }

  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ъ: '', ё: 'e' };
  function slug(s) {
    const latin = String(s || '').toLowerCase().split('').map(ch => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('');
    const base = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('p');
    let id = base, n = 2; while (project(id) || person(id)) id = `${base}-${n++}`; return id;
  }

  async function deleteProject(id) {
    const p = project(id); if (!p || !canSeeHistory()) return;
    if (!confirm(`Delete project "${p.name}"? Its activity log entries stay.`)) return;
    await saveProject(id, { remove: true });
    location.hash = '#/projects'; render();
  }

  async function editWorkstream(prId, wsId) {
    const p = project(prId); if (!canEditProject(p)) return;
    const w = wsId ? (p.workstreams || []).find(x => x.id === wsId) : { id: '', status: 'active' };
    if (!w) return;
    const base = clone(p);
    const v = await form(wsId ? `Edit workstream — ${w.name}` : `New workstream in ${p.name}`, [
      { key: 'name', label: 'Name', required: true },
      { key: 'status', label: 'Status', type: 'select', options: opt(STATUS.concat('unknown')) },
      { key: 'ownerId', label: 'Owner', type: 'select', options: peopleOpts([w.ownerId]), allowEmpty: true, emptyLabel: 'Unassigned' },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'next', label: 'Next step' },
    ], w);
    if (!v) return;
    const nw = { ...w, ...v, id: w.id || uid('ws') };
    await saveProject(prId, { base, ops: [{ path: `workstreams/${nw.id}`, from: wsId ? clone(w) : undefined, to: nw }] });
    render();
  }
  async function deleteWorkstream(prId, wsId) {
    const p = project(prId); if (!canEditProject(p)) return;
    const w = (p.workstreams || []).find(x => x.id === wsId);
    if (!w || !confirm(`Remove workstream "${w.name}"?`)) return;
    await saveProject(prId, { base: clone(p), ops: [{ path: `workstreams/${wsId}`, from: clone(w), to: undefined }] });
    render();
  }

  // The GitHub username decides whose thread and learning a token opens, so only the lead sets it,
  // and never to one that another person already carries. People are added, renamed and removed by
  // the lead too, since who a person is decides what they may edit; anyone else edits a few lines of
  // their own profile.
  const canEditPerson = id => canSeeHistory() || (!!id && id === signedInAs());
  async function editPerson(id) {
    const lead = canSeeHistory();
    if (id ? !canEditPerson(id) : !lead) return;
    const p = id ? person(id) : { id: '', role: 'mentee', active: true, track: 'basic' };
    if (!p) return;
    const learn = !id || canSeeLearningOf(id);
    let values = { active: true, ...p }, v;
    for (;;) {
      v = await form(id ? `Edit — ${p.name}` : 'Add person', [
        ...(lead ? [{ key: 'name', label: 'Name', required: true }, { key: 'role', label: 'Role', type: 'select', options: opt(ROLES) }] : []),
        { key: 'title', label: 'Title', help: 'e.g. Manual QA, moving to automation' },
        ...(lead ? [{ key: 'githubLogin', label: 'GitHub username', help: 'When they open the tracker with their own token, everything they post is signed as this person, and their own thread and learning open to them.' }] : []),
        ...(learn ? [{ key: 'track', label: 'Learning track', type: 'select', options: opt(TRACKS), allowEmpty: true, emptyLabel: 'not set' }] : []),
        { key: 'startedOn', label: 'Started with you on', type: 'date' },
        ...(learn ? [{ key: 'weeklyLearningHours', label: 'Learning hours per week', type: 'number', step: '0.5' }] : []),
        { key: 'focus', label: 'Current focus', help: 'What they are on right now, one line. Shows on the dashboard.' },
        ...(lead ? [{ key: 'active', label: 'Active', type: 'checkbox', text: 'Currently on the team' }] : []),
      ], values);
      if (!v) return;
      const taken = lead && loginHolders(v.githubLogin).find(x => x !== p);
      if (!taken) break;
      toast(`${taken.name} already carries the GitHub username ${v.githubLogin}`, 4000);
      values = { ...values, ...v };
    }
    const np = { ...p, ...v, id: p.id || slug(v.name), updatedOn: today() };
    if (id) people().splice(people().indexOf(p), 1, np); else people().push(np);
    await save('people'); location.hash = `#/people/${np.id}`; render();
  }
  async function deletePerson(id) {
    const p = person(id); if (!p || !canSeeHistory() || !confirm(`Remove ${p.name}? Their learning progress and activity stay in the data files.`)) return;
    people().splice(people().indexOf(p), 1); await save('people'); location.hash = '#/people'; render();
  }

  async function editActivity(id, preset = {}) {
    if (!canSeeHistory()) return;
    const a = id ? acts().find(x => x.id === id) : { id: '', date: today(), type: 'update', ...preset };
    const v = await form(id ? 'Edit entry' : (preset.type === 'one-on-one' ? 'Log a 1:1' : preset.type === 'blocker' ? 'Log a blocker' : 'Log activity'), [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'type', label: 'Type', type: 'select', options: opt(ACT_TYPES) },
      { key: 'personId', label: 'Person', type: 'select', options: peopleOpts([a.personId]), allowEmpty: true, emptyLabel: '—' },
      { key: 'projectId', label: 'Project', type: 'select', options: projectOpts(), allowEmpty: true, emptyLabel: '—' },
      { key: 'ws', label: 'Workstream', type: 'select', options: wsOpts(), allowEmpty: true, emptyLabel: '—' },
      { key: 'text', label: 'What happened', type: 'textarea', required: true, help: 'For a 1:1: what was covered / where stuck / what changes. For a blocker: what is blocked and on whom.' },
      { key: 'resolved', label: 'Resolved', type: 'checkbox', text: 'Blocker resolved (only matters for blockers)' },
    ], { ...a, ws: a.projectId && a.workstreamId ? `${a.projectId}:${a.workstreamId}` : '' });
    if (!v) return;
    const [wsP, wsId] = (v.ws || '').split(':');
    const na = { ...a, id: a.id || uid('a'), createdAt: a.createdAt || new Date().toISOString(), date: v.date, type: v.type, personId: v.personId, projectId: wsP || v.projectId || '', workstreamId: wsId || '', text: v.text, resolved: v.resolved };
    if (id) acts().splice(acts().indexOf(a), 1, na); else acts().push(na);
    await save('activities'); render();
  }
  async function deleteActivity(id) {
    const a = acts().find(x => x.id === id); if (!a || !confirm('Delete this entry?')) return;
    acts().splice(acts().indexOf(a), 1); await save('activities'); render();
  }
  async function toggleResolved(id) {
    const a = acts().find(x => x.id === id); if (!a) return;
    a.resolved = !a.resolved; a.resolvedOn = a.resolved ? today() : ''; await save('activities'); render();
  }

  // Enrollments, and the quarter goal on them, are the lead's to set.
  async function enroll(pid, preset = {}) {
    if (!canSeeHistory() || !canSeeLearningOf(pid)) return;
    const list = learning().enrollments;
    const editing = preset.courseId ? list.find(e => e.personId === pid && e.courseId === preset.courseId) : null;
    const v = await form(editing ? `Enrollment — ${pname(pid)}` : `Enroll ${pname(pid)}`, [
      { key: 'courseId', label: 'Course', type: 'select', options: courses().map(c => ({ value: c.id, label: c.name })) },
      { key: 'track', label: 'Track', type: 'select', options: opt(TRACKS), allowEmpty: true, emptyLabel: 'not set' },
      { key: 'startedOn', label: 'Started on', type: 'date' },
      { key: 'goal', label: 'Quarter goal', help: 'one measurable sentence' },
    ], { track: person(pid)?.track || '', startedOn: today(), ...(editing || {}), ...preset });
    if (!v) return;
    const target = list.find(e => e.personId === pid && e.courseId === v.courseId);
    if (editing && target && target !== editing) { toast('Already enrolled in that course'); return; }
    if (editing) Object.assign(editing, v); else if (target) Object.assign(target, v); else list.push({ personId: pid, ...v });
    await save('learning'); render();
  }
  async function unenroll(pid, courseId) {
    if (!canSeeHistory() || !canSeeLearningOf(pid)) return;
    if (!confirm(`Remove ${pname(pid)} from ${course(courseId)?.name}? Lesson marks are kept.`)) return;
    learning().enrollments = learning().enrollments.filter(e => !(e.personId === pid && e.courseId === courseId));
    await save('learning'); render();
  }
  async function setLesson(pid, lid, status) {
    if (!canSeeLearningOf(pid)) return false;
    const at = nowIso();
    return saveLearning(l => applyMark(l, pid, lid, status, undefined, at, ''));
  }
  async function cycleLesson(pid, lid, title) {
    if (!canSeeLearningOf(pid)) return;
    const cur = progressOf(pid, lid).status;
    const next = LESSON_STATUS[(LESSON_STATUS.indexOf(cur) + 1) % LESSON_STATUS.length];
    await setLesson(pid, lid, next);
    S.lastCell = { person: pname(pid), title: title || lid, status: next }; render();
  }
  async function editLesson(pid, lid, title) {
    if (!canSeeLearningOf(pid)) return;
    const cur = progressOf(pid, lid), shown = cur.date || today();
    const v = await form(`${pname(pid)} — ${title}`, [
      { key: 'status', label: 'Status', type: 'select', options: opt(LESSON_STATUS) },
      { key: 'date', label: 'Date', type: 'date', help: 'the day this status was reached; change it only if that was another day' },
      { key: 'note', label: 'Note', type: 'textarea', help: 'what was shown, where stuck, what to revisit' },
    ], { status: cur.status, date: shown, note: cur.note || '' });
    if (!v) return;
    const at = nowIso(), on = v.date && v.date !== shown ? v.date : '';
    await saveLearning(l => applyMark(l, pid, lid, v.status, v.note, at, on));
    render();
  }

  // Starting a run goes through the tracker's own "Run tests" workflow, which holds the
  // project credentials server-side; this browser only ever talks to the tracker repository.
  async function runCI(projectId, groupId) {
    const s = ciSource(projectId), g = (s && (s.groups || []).find(x => x.id === groupId)) || null;
    if (!g) return;
    if (!mayRun(s, g)) { toast(`Only ${(s.allowedActors || []).join(', ') || 'the lead'} can start this one.`); return; }
    if (S.backend !== 'github') { toast('Connect this page to GitHub first (Data → Connect to GitHub)'); return; }
    if (!confirm(`Start “${g.title}” on ${s.repoName}?\n\nThis runs the real suite against that environment.`)) return;
    const cfg = ghConfig();
    try {
      const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/actions/workflows/run-tests.yml/dispatches`, {
        method: 'POST', headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: cfg.branch, inputs: { project: projectId, target: g.dispatchTarget || g.workflowFile } }),
      });
      if (r.status === 204) {
        const w = addWait(s, g);
        toast('Run requested. The card on the CI tab follows it until its report is in.'); render();
        const card = $(`[data-wait="${w.id}"]`); if (card) card.scrollIntoView({ block: 'nearest' });
        return;
      }
      const err = await ghError(r);
      if (r.status === 403 || r.status === 404) { toast(`Cannot start it from here (${err}). Add “Actions: read and write” to this token, or open it on GitHub.`); return; }
      toast('Could not start the run: ' + err);
    } catch { toast('Could not reach GitHub'); }
  }

  async function editSettings() {
    if (!canSeeHistory()) return;
    const v = await form('Settings', [
      { key: 'teamName', label: 'Team name' },
      { key: 'leadName', label: 'Your name' },
      { key: 'staleLearningDays', label: 'Learning counts as stale after (days)', type: 'number' },
      { key: 'autoCollectAfterHours', label: 'Collect CI on open when the snapshot is older than (hours)', type: 'number',
        help: 'Opening the page then starts a collection itself, so the data does not depend on the scheduled job alone.' },
    ], settings());
    if (!v) return;
    Object.assign(settings(), v); await save('settings'); render();
  }

  // ---------- view helpers
  const pill = (cls, text) => `<span class="pill ${esc(cls)}">${esc(text ?? label(cls))}</span>`;
  const dot = h => `<span class="dot ${esc(h)}" title="${esc(h)}"></span>`;
  const envPill = e => e.status ? pill({ up: 'green', degraded: 'yellow', down: 'red' }[e.status] || 'grey',
    e.status + (e.checkedOn ? ` · ${e.checkedOn}` : '')) : '';
  const progressBar = cs => {
    const t = cs.total || 1;
    return `<div class="progress" title="${cs.counts.done} done, ${cs.counts['gate-passed']} gates, ${cs.counts['in-progress']} in progress, ${cs.counts.stuck} stuck of ${cs.total}">
      <span class="p-gate" style="width:${100 * cs.counts['gate-passed'] / t}%"></span><span class="p-done" style="width:${100 * cs.counts.done / t}%"></span><span class="p-prog" style="width:${100 * cs.counts['in-progress'] / t}%"></span><span class="p-stuck" style="width:${100 * cs.counts.stuck / t}%"></span></div>`;
  };
  function actRow(a, { showProject = true, showPerson = true } = {}) {
    const p = a.projectId ? project(a.projectId) : null;
    const ws = p && a.workstreamId ? (p.workstreams || []).find(w => w.id === a.workstreamId) : null;
    const tags = [pill(a.type === 'blocker' ? (a.resolved ? 'done' : 'blocker') : a.type, a.type === 'blocker' && a.resolved ? 'blocker · resolved' : label(a.type))];
    if (showPerson && a.personId) tags.push(`<span class="pill">${plink(a.personId)}</span>`);
    if (showProject && p) tags.push(`<span class="pill">${prlink(p.id)}${ws ? ' › ' + esc(ws.name) : ''}</span>`);
    else if (ws) tags.push(`<span class="pill">${esc(ws.name)}</span>`);
    return `<div class="row"><div class="when" title="${esc(a.date)}">${esc(a.date)}<br><span class="muted">${esc(ago(a.date))}</span></div>
      <div class="body"><div class="txt">${esc(a.text)}</div><div class="tags">${tags.join('')}${a.source ? `<span class="hint mono" title="source">${esc(a.source)}</span>` : ''}</div></div>
      <div class="ops">${a.type === 'blocker' ? `<button class="btn sm" data-act="resolve" data-id="${a.id}" title="toggle resolved">${a.resolved ? '↺' : '✓'}</button>` : ''}<button class="btn sm" data-act="edit-act" data-id="${a.id}">✎</button><button class="btn sm" data-act="del-act" data-id="${a.id}">🗑</button></div></div>`;
  }
  const listOr = (arr, empty) => arr && arr.length ? `<ul class="plain">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="empty">${esc(empty)}</div>`;
  // Everyone sees that a field was set by hand; whoever may edit the project also sees what the
  // weekly review would put there instead, and settles it.
  function editedNote(p, key, what = '') {
    const m = p.edited?.[key]; if (!m) return '';
    return ` <span class="muted small" data-edited="${esc(key)}" title="Set by hand. The weekly review leaves it as it is and suggests instead.">${esc(what ? what + ' ' : '')}edited by ${esc(m.by ? pname(m.by) : 'someone')}${m.on ? ' on ' + esc(m.on) : ''}</span>`;
  }
  // A suggestion is shown to whoever may change its field; one that does not fit the field can only be dismissed.
  const pendingOf = p => canEditProject(p) ? Object.keys(p.suggested || {}).filter(k => mayChange(p, k)) : [];
  function suggestBox(p, key) {
    const s = p.suggested?.[key]; if (!s || !pendingOf(p).includes(key)) return '';
    const b = (act, text, cls) => `<button class="btn sm${cls}" data-act="${act}" data-project="${esc(p.id)}" data-field="${esc(key)}">${text}</button>`;
    return `<div class="suggest" data-suggest="${esc(key)}" style="margin-top:8px;padding:8px 10px;border:1px solid var(--accent);border-radius:10px;background:var(--accent-soft)">
      <div class="small"><b>The weekly review suggests${splitPath(key).env !== undefined || !REVIEWED.includes(key) ? ` for ${esc(fieldLabel(key))}` : ''}</b>${s.on ? ` <span class="muted">· ${esc(s.on)}</span>` : ''}</div>
      <div class="small"><span class="muted">Now:</span> ${fmtVal(key, getPath(p, key))}</div>
      <div class="small"><span class="muted">Suggested:</span> ${fmtVal(key, s.value)}</div>
      <div class="actions" style="margin-top:6px">${suggestionFits(key, s.value) ? b('sugg-accept', 'Accept', ' primary') : '<span class="hint">It does not fit this field, so it can only be dismissed.</span>'}${b('sugg-dismiss', 'Dismiss', '')}</div></div>`;
  }

  // ---------- views
  function vDashboard() {
    const st = settings(), att = attention();
    const act = projects().filter(p => p.status === 'active');
    const overdue11 = mentees().filter(m => { const o = lastOneOnOne(m.id); return !o || daysSince(o.date) > (st.oneOnOneCadenceDays || 7); });
    const pcts = activePeople().filter(p => canSeeHistory() ? p.role === 'mentee' : canSeeLearningOf(p.id)).flatMap(m => enrollmentsOf(m.id).map(e => courseSummary(m.id, e.courseId)?.pct ?? 0));
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    const reds = att.filter(a => a.lvl === 'red').length;
    const hist = canSeeHistory();
    const recent = acts().slice().sort(byDateDesc).slice(0, 12);
    const attRow = a => `<div class="row"><div class="lvl ${a.lvl}"></div><div class="body"><a href="${esc(a.href)}">${esc(a.text)}</a></div></div>`;
    return `<div class="page-head"><div><h1>${esc(st.teamName || 'Team')}</h1><div class="sub">${esc(today())} · ${act.length} active project${act.length === 1 ? '' : 's'} · ${mentees().length} mentee${mentees().length === 1 ? '' : 's'}</div></div>
      <div class="actions"><button class="btn" data-act="summary">Status summary</button>${hist ? `<button class="btn" data-act="log-11">Log 1:1</button><button class="btn" data-act="log-blocker">Log blocker</button><button class="btn primary" data-act="log-act">Log activity</button>` : ''}</div></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${act.length}</div><div class="l">active projects</div></div>
        <div class="kpi ${reds ? 'bad' : 'good'}"><div class="v">${reds}</div><div class="l">red flags</div></div>
        ${hist ? `<div class="kpi ${openBlockers().length ? 'bad' : 'good'}"><div class="v">${openBlockers().length}</div><div class="l">open blockers</div></div>
        <div class="kpi ${overdue11.length ? 'warn' : 'good'}"><div class="v">${overdue11.length}</div><div class="l">1:1s due</div></div>` : ''}
        <div class="kpi"><div class="v">${avg == null ? '—' : avg + '%'}</div><div class="l">${canSeeHistory() ? 'avg learning progress' : 'your learning progress'}</div></div>
      </div>
      <div class="grid ${hist ? 'cols-2' : ''}">
        <div class="section"><div class="section-head"><h2>Needs attention</h2><span class="hint">${att.length} item${att.length === 1 ? '' : 's'}</span></div>
          <div class="card attention">${att.length ? att.slice(0, 10).map(attRow).join('') + (att.length > 10 ? `<details class="more"><summary class="small">show ${att.length - 10} more</summary>${att.slice(10).map(attRow).join('')}</details>` : '') : '<div class="empty">All quiet. Nothing overdue, no blockers, no red health.</div>'}</div></div>
        ${hist ? `<div class="section"><div class="section-head"><h2>Recent activity</h2><a href="#/activity" class="small">all →</a></div>
          <div class="card">${recent.length ? recent.map(a => actRow(a)).join('') : '<div class="empty">Nothing logged yet. Use “Log activity”.</div>'}</div></div>` : ''}
      </div>
      <div class="section"><div class="section-head"><h2>Projects</h2><a href="#/projects" class="small">manage →</a></div>
        <div class="grid auto">${projects().filter(p => p.status !== 'done').map(projectCard).join('') || '<div class="empty">No projects yet.</div>'}</div></div>
      <div class="section"><div class="section-head"><h2>People — right now</h2><a href="#/people" class="small">manage →</a></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Focus</th><th>Projects</th>${hist ? '<th>Last activity</th><th>Last 1:1</th>' : ''}<th>Learning</th></tr></thead><tbody>
        ${activePeople().sort((a, b) => (a.role === 'mentee' ? 0 : 1) - (b.role === 'mentee' ? 0 : 1)).map(p => {
          const la = personActs(p.id)[0], o = lastOneOnOne(p.id);
          const prs = personProjects(p.id).map(pr => `${prlink(pr.id)} <span class="muted small">(${esc(personRoleIn(pr, p.id))})</span>`).join('<br>') || '<span class="muted">—</span>';
          const lr = (canSeeLearningOf(p.id) ? enrollmentsOf(p.id) : []).map(e => courseSummary(p.id, e.courseId)).filter(Boolean).map(cs => `<div class="small"><b>${cs.pct}%</b> ${esc(cs.course.name)}${cs.current ? ` · <span class="muted">now: ${esc(cs.current.title)}</span>` : ' · <span class="muted">complete</span>'}</div>${progressBar(cs)}`).join('') || '<span class="muted">—</span>';
          return `<tr><td>${plink(p.id)}<div class="muted small">${esc(p.title || label(p.role))}</div></td><td>${esc(p.focus || '—')}</td><td>${prs}</td>${hist ? `<td>${la ? `<div class="small">${esc(trunc(la.text, 80))}</div><span class="muted small">${esc(ago(la.date))}</span>` : '<span class="muted">—</span>'}</td><td>${o ? `<span title="${esc(o.date)}">${esc(ago(o.date))}</span>` : '<span class="muted">never</span>'}</td>` : ''}<td style="min-width:180px">${lr}</td></tr>`;
        }).join('') || `<tr><td colspan="${hist ? 6 : 4}" class="empty">No people yet — add your mentees in People.</td></tr>`}
        </tbody></table></div></div>`;
  }

  function projectCard(p) {
    const la = projectActs(p.id)[0];
    const bl = openBlockers().filter(b => b.projectId === p.id).length;
    const ms = p.nextMilestone?.text ? `<div class="small"><span class="muted">Next:</span> ${esc(p.nextMilestone.text)}${p.nextMilestone.due ? ` <span class="${p.nextMilestone.due < today() ? 'pill red' : 'muted'}">${esc(p.nextMilestone.due)}</span>` : ''}</div>` : '';
    const wsA = (p.workstreams || []).filter(w => w.status === 'active').length;
    const s = ciSource(p.id), r = s ? headlineRun(s) : null;
    const ciLine = s ? `<div class="small" style="margin-top:6px">${s.tests ? `<b>${esc(String(s.tests.functions))}</b> tests` : '<span class="muted">tests not counted</span>'}${r ? ` · ${resultPill(r)} <span class="muted">${esc(r.name || '')}, ${esc(agoIso(r.startedAt))}</span>` : ' · <span class="muted">no CI runs</span>'}</div>` : '';
    return `<div class="card clickable" data-href="#/projects/${esc(p.id)}"><h3>${dot(p.health)} <a href="#/projects/${esc(p.id)}">${esc(p.name)}</a> ${pill(p.status)}</h3>
      <div class="meta">Lead: ${p.leadId ? esc(pname(p.leadId)) : '<i>unassigned</i>'}${p.code ? ` · ${esc(p.code)}` : ''}${wsA ? ` · ${wsA} active workstream${wsA === 1 ? '' : 's'}` : ''}${bl ? ` · <span class="pill blocker">${bl} blocker${bl === 1 ? '' : 's'}</span>` : ''}</div>
      <p class="small" style="margin-top:6px">${esc(trunc(p.healthReason || p.summary, 140))}</p>${s && s.verdict ? `<div class="small"><b>${esc(s.verdict)}</b></div>` : ''}${ms}${ciLine}
      ${canSeeHistory() ? `<div class="muted small">${la ? `${esc(trunc(la.text, 90))} — ${esc(ago(la.date))}` : 'no activity logged'}</div>` : ''}</div>`;
  }

  function vProjects() {
    const f = S.filter?.status || '';
    const list = projects().filter(p => !f || p.status === f);
    return `<div class="page-head"><div><h1>Projects</h1><div class="sub">${projects().length} total</div></div><div class="actions">${canSeeHistory() ? '<button class="btn primary" data-act="new-project">New project</button>' : ''}</div></div>
      <div class="filters"><select data-filter="status"><option value="">all statuses</option>${STATUS.map(s => `<option value="${s}"${f === s ? ' selected' : ''}>${label(s)}</option>`).join('')}</select></div>
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Status</th><th>Health</th><th>Lead</th><th>Team</th><th>Next milestone</th>${canSeeHistory() ? '<th>Last activity</th>' : ''}</tr></thead><tbody>
      ${list.map(p => { const la = projectActs(p.id)[0]; return `<tr><td>${prlink(p.id)}<div class="muted small">${esc(p.code || '')}${p.client ? ' · ' + esc(p.client) : ''}</div></td><td>${pill(p.status)}</td><td>${dot(p.health)} <span class="small">${esc(trunc(p.healthReason, 60))}</span></td><td>${p.leadId ? plink(p.leadId) : '<span class="muted">—</span>'}</td><td class="small">${(p.memberIds || []).map(pname).map(esc).join(', ') || '<span class="muted">—</span>'}</td><td class="small">${p.nextMilestone?.text ? esc(p.nextMilestone.text) + (p.nextMilestone.due ? ` <span class="${p.nextMilestone.due < today() ? 'pill red' : 'muted'}">${esc(p.nextMilestone.due)}</span>` : '') : '<span class="muted">—</span>'}</td>${canSeeHistory() ? `<td class="small">${la ? esc(ago(la.date)) : '<span class="muted">—</span>'}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="${canSeeHistory() ? 7 : 6}" class="empty">No projects match.</td></tr>`}
      </tbody></table></div>`;
  }

  function vProject(id) {
    const p = project(id); if (!p) return `<div class="empty">Project not found. <a href="#/projects">Back</a></div>`;
    const pa = projectActs(id), bl = pa.filter(a => a.type === 'blocker' && !a.resolved);
    const kv = [
      ['Client', esc(p.client)], ['Lead', p.leadId ? plink(p.leadId) : '<i class="muted">unassigned</i>'],
      ['Members', (p.memberIds || []).map(plink).join(', ')],
      ['Started', esc(p.startedOn)], ['Stack', (p.stack || []).map(esc).join(', ')], ['Aliases', (p.aliases || []).map(esc).join(', ')],
      ['Repositories', (p.repos || []).map(r => `${link(r.url, r.name)}${r.branch ? ` <span class="muted small">(${esc(r.branch)})</span>` : ''}${r.localPath ? `<div class="mono muted small">${esc(r.localPath)}</div>` : ''}`).join('<br>')],
      ['Environments', (p.environments || []).map(e => { const k = `environments/${e.name}/`;
        return `${link(e.url, e.name)} ${envPill(e)}${e.notes ? ` <span class="muted small">— ${esc(e.notes)}</span>` : ''}${editedNote(p, k + 'notes', 'notes')}${editedNote(p, k + 'status', 'status')}${suggestBox(p, k + 'notes')}${suggestBox(p, k + 'status')}`; }).join('<br>')],
      ['Systems', (p.systems || []).map(s => `${link(s.url, s.name)}${s.role ? ` <span class="muted small">— ${esc(s.role)}</span>` : ''}`).join('<br>')],
      ['Local docs', (p.localDocs || []).map(d => `<span class="mono small">${esc(d.path)}</span> <span class="muted small">— ${esc(d.what)}</span>`).join('<br>')],
      ['Updated', esc(p.updatedOn)],
    ].filter(([, v]) => v);
    const src = ciSource(id), lr = src ? headlineRun(src) : null, tab = ['ci', 'tests'].includes(S.route.tab) ? S.route.tab : '';
    const nLive = src ? liveRuns(src).length : 0, cat = S.catalogs[id];
    const tabs = `<div class="tabs"><button class="${tab ? '' : 'active'}" data-href="#/projects/${esc(id)}">Overview</button><button class="${tab === 'ci' ? 'active' : ''}" data-href="#/projects/${esc(id)}/ci">CI runs${nLive ? ` <span class="pill yellow"><span class="live-dot"></span>${nLive} was running</span>` : lr ? ' ' + resultPill(lr) : ''}</button>${cat ? `<button class="${tab === 'tests' ? 'active' : ''}" data-href="#/projects/${esc(id)}/tests">Tests${cat.error ? '' : ` <span class="pill">${cat.tests.length}</span>`}</button>` : ''}</div>`;
    const verdict = src && src.verdict ? `<div class="sub" style="margin-top:4px"><b>${esc(src.verdict)}</b> <span class="muted">kept current by the collector</span></div>` : '';
    const seen = (p.checkedAgainst || []).filter(Boolean);
    const written = p.updatedOn
      ? `<span class="muted" title="${esc(seen.join(' · '))}"> · description ${seen.length
          ? `rebuilt from ${seen.length} live source${seen.length > 1 ? 's' : ''}`
          : 'written by hand'} ${esc(ago(p.updatedOn))}</span>`
      : '';
    const edit = canEditProject(p), pending = pendingOf(p), nSug = pending.length;
    const head = `<div class="page-head"><div><h1>${dot(p.health)} ${esc(p.name)} ${pill(p.status)}${nSug ? ' ' + pill('purple', `${nSug} suggested`) : ''}</h1><div class="sub">${esc(p.code || '')}${p.healthReason ? ' · ' + esc(p.healthReason) : ''}${written}</div>${verdict}</div>
      <div class="actions">${canSeeHistory() ? `<button class="btn" data-act="log-act" data-project="${esc(id)}">Log update</button><button class="btn" data-act="log-blocker" data-project="${esc(id)}">Log blocker</button>` : ''}${edit ? `<button class="btn primary" data-act="edit-project" data-id="${esc(id)}">Edit</button>` : ''}${canSeeHistory() ? `<button class="btn danger ghost" data-act="del-project" data-id="${esc(id)}">Delete</button>` : ''}</div></div>`;
    const hand = ['health', 'healthReason'].some(k => p.edited?.[k] || (edit && p.suggested?.[k]));
    const health = hand ? `<div class="card" style="margin-bottom:14px"><h3>Health</h3><div>${dot(p.health)} ${esc(label(p.health))}${editedNote(p, 'health')}</div>${p.healthReason ? `<div class="small">${esc(p.healthReason)}${editedNote(p, 'healthReason')}</div>` : ''}${suggestBox(p, 'health')}${suggestBox(p, 'healthReason')}</div>` : '';
    const stray = pending.filter(k => !reviewKeys(p).includes(k));
    const strays = stray.length ? `<div class="card" style="margin-bottom:14px"><h3>Suggestions for fields the weekly review does not write</h3>${stray.map(k => suggestBox(p, k)).join('')}</div>` : '';
    const listCard = (key, title, empty, last) => `<div class="card"${last ? '' : ' style="margin-bottom:14px"'}><h3>${esc(title)}${editedNote(p, key)}</h3>${listOr(p[key], empty)}${suggestBox(p, key)}</div>`;
    if (tab === 'ci') return head + tabs + (src ? latestReports(p, src) : '') + waitsBox(id) + liveBlock(src || { runs: [] }, false) + vProjectCI(p);
    if (tab === 'tests') return head + tabs + vProjectTests(p);
    return head + tabs + `${p.nextMilestone?.text ? `<div class="banner"><b>Next milestone:</b> ${esc(p.nextMilestone.text)}${p.nextMilestone.due ? ` — due ${esc(p.nextMilestone.due)} (${esc(ago(p.nextMilestone.due))})` : ''}</div>` : ''}${health}${strays}
      <div class="grid cols-2">
        <div class="card"><h3>Overview</h3><p>${esc(p.summary || '')}${editedNote(p, 'summary')}</p>${suggestBox(p, 'summary')}<dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${p.notes ? `<h3 style="margin-top:12px">Notes</h3><p class="small" style="white-space:pre-wrap">${esc(p.notes)}</p>` : ''}</div>
        <div>
          ${listCard('keyFacts', 'Key facts', 'none recorded')}
          ${listCard('risks', 'Risks', 'none recorded')}
          ${listCard('openQuestions', 'Open questions', 'none')}
          ${listCard('nextSteps', 'Next steps', 'none', true)}
        </div>
      </div>
      <div class="section" style="margin-top:14px"><div class="section-head"><h2>Workstreams</h2>${edit ? `<button class="btn sm" data-act="new-ws" data-project="${esc(id)}">Add workstream</button>` : ''}</div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Workstream</th><th>Status</th><th>Owner</th><th>Summary</th><th>Next</th><th></th></tr></thead><tbody>
        ${(p.workstreams || []).map(w => `<tr><td><b>${esc(w.name)}</b></td><td>${pill(w.status)}</td><td>${w.ownerId ? plink(w.ownerId) : '<span class="muted">—</span>'}</td><td class="small">${esc(w.summary || '')}</td><td class="small">${esc(w.next || '')}</td><td class="nowrap">${edit ? `<button class="btn sm" data-act="edit-ws" data-project="${esc(id)}" data-id="${esc(w.id)}">✎</button> <button class="btn sm" data-act="del-ws" data-project="${esc(id)}" data-id="${esc(w.id)}">🗑</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No workstreams yet.</td></tr>'}
        </tbody></table></div></div>
      ${canSeeHistory() ? `<div class="section"><div class="section-head"><h2>Activity${bl.length ? ` · <span class="pill blocker">${bl.length} open blocker${bl.length === 1 ? '' : 's'}</span>` : ''}</h2></div>
        <div class="card">${pa.length ? pa.map(a => actRow(a, { showProject: false })).join('') : '<div class="empty">Nothing logged for this project yet.</div>'}</div></div>` : ''}`;
  }

  const KIND_TITLE = { regression: 'Regression', load: 'Load test', suite: 'Targeted suite', deploy: 'On every deploy', other: 'Other' };
  // The page only mirrors the rule; dispatch_run.py is what actually refuses a restricted target.
  const actorLogin = () => (S.ghUser || person(viewerId())?.githubLogin || '').toLowerCase();
  const mayRun = (s, g) => !g.restricted || S.backend === 'server' || (s.allowedActors || []).some(a => a.toLowerCase() === actorLogin());
  const runsOfGroup = (s, gid) => runsOf(s).filter(r => r.group === gid);

  // One click per environment to the newest finished run's report; an older run stands in only
  // when the newest has none the page can show, and its date says so.
  function latestReports(p, s) {
    const items = (s.groups || []).map(g => {
      const done = runsOfGroup(s, g.id).filter(isFinished);
      const r = newestInline(s, g.id) || done.find(x => (x.reports || []).length);
      if (!r) return '';
      const i = firstInline(r), older = done[0] && done[0] !== r;
      const inner = `<span class="rc-name">${esc(groupName(g))}</span>${resultPill(r)}<span class="muted${older ? ' rc-older' : ''}" title="${older ? 'a newer run has no report that opens here' : ''}">${esc(fmtWhen(r.startedAt))}${older ? ' · older run' : ''}</span>`;
      return i >= 0
        ? reportBtn(p.id, String(r.id), r.reports[i], i, `${inner}<span class="rc-go">Report</span>`, 'rchip')
        : `<a class="rchip" href="${esc(r.reports[0].url)}" target="_blank" rel="noopener" title="${esc(r.reports[0].name || 'Report')}, opens in a new tab">${inner}<span class="rc-go">${esc(r.reports[0].name || 'Report')} ↗</span></a>`;
    }).filter(Boolean);
    if (!items.length) return '';
    return `<div class="card latest-reports" style="margin-bottom:14px"><h3>Latest reports</h3><div class="rstrip">${items.join('')}</div>${s.reportsError ? `<div class="small" style="color:var(--yellow-text);margin-top:8px">Some reports could not be stored for viewing here: ${esc(s.reportsError)}</div>` : ''}</div>`;
  }

  function vProjectCI(p) {
    const s = ciSource(p.id);
    if (!s) return `<div class="card"><div class="empty">No CI source is configured for this project. Add it to <span class="mono">ci-sources.json</span> in the tracker repository and run the collector.</div></div>`;
    const t = s.tests || {}, runs = runsOf(s);
    const groups = s.groups || [];
    const latest = groups.map(g => {
      const r = runsOfGroup(s, g.id)[0];
      return r ? `<span style="display:inline-block;margin:0 10px 4px 0">${resultPill(r)} <span class="small">${esc(KIND_TITLE[g.kind] || g.kind)}${g.env ? ' · ' + esc(g.env) : ''}</span> <span class="muted small">${esc(agoIso(r.startedAt))}</span></span>` : '';
    }).join('');
    const head = `<div class="card" style="margin-bottom:14px"><h3>Source — ${esc(kindName(s.kind))}: ${s.url ? link(s.url, s.repoName) : esc(s.repoName || '')} ${s.branch ? `<span class="pill">${esc(s.branch)}</span>` : ''} ${s.status === 'error' ? pill('red', 'could not be read') : s.status === 'ok' ? pill('green', 'read OK') : pill('grey', label(s.status || 'unknown'))}</h3>
      <div class="actions" style="float:right"><button class="btn sm" data-act="refresh-ci">↻ Refresh now</button></div>
      <dl class="kv">
        ${latest ? `<dt>Latest of each</dt><dd>${latest}</dd>` : ''}
        <dt>Tests in the repository</dt><dd>${t.functions != null ? `<b>${esc(String(t.functions))}</b> in ${esc(String(t.files))} files <span class="muted small">(${esc(t.method || '')}${t.commit ? ', commit ' + esc(t.commit) : ''}, counted ${esc(agoIso(t.countedAt))})</span>` : '<span class="muted">not counted yet</span>'}${s.testsError ? `<div class="small" style="color:var(--yellow-text)">could not count: ${esc(s.testsError)}</div>` : ''}</dd>
        <dt>Read from the source</dt><dd>${s.collectedAt ? `${esc(fmtWhen(s.collectedAt))} UTC <span class="muted">(${snapMinutes() != null && snapMinutes() < 180 ? esc(snapMinutes() + ' min ago') : esc(agoIso(s.collectedAt))})</span>${snapMinutes() > 75 ? ' ' + pill('red', 'the hourly collection is not running') : ''}` : '<span class="muted">never</span>'}</dd>
        ${s.error ? `<dt>Error</dt><dd class="small" style="color:var(--red-text)">${esc(s.error)}</dd>` : ''}
        ${s.note ? `<dt>Note</dt><dd class="small">${esc(s.note)}</dd>` : ''}
        ${(s.reports || []).length ? `<dt>Reports</dt><dd class="rep-list">${reportLinks(p.id, '', s.reports)}</dd>` : ''}
        ${(s.downloads || []).length ? `<dt>Downloads</dt><dd>${s.downloads.map(d => `${link(d.url, d.name)} <span class="muted small">${d.size ? Math.round(d.size / 1024) + ' KB' : ''}${d.createdAt ? ' · ' + esc(fmtWhen(d.createdAt)) : ''}</span>`).join('<br>')}</dd>` : ''}
      </dl></div>`;
    const runRow = r => `<tr><td class="nowrap small">${esc(fmtWhen(r.startedAt))}<div class="muted">${esc(agoIso(r.startedAt))}</div></td>
      <td><b>${esc(r.name || '')}</b>${r.title && r.title !== r.name ? `<div class="muted small">${esc(trunc(r.title, 90))}</div>` : ''}${r.number ? `<div class="muted small">#${esc(String(r.number))}</div>` : ''}</td>
      <td class="small">${esc(r.trigger || '')}${r.branch ? `<div class="muted">${esc(r.branch)}</div>` : ''}</td><td>${resultPill(r)}</td>
      <td class="small">${r.counts ? esc(countsText(r.counts)) : '<span class="muted">—</span>'}</td><td class="small nowrap">${esc(fmtDur(r.durationSec))}</td>
      <td class="small nowrap">${reportLinks(p.id, String(r.id), r.reports, 'Report')}${(r.reports || []).length && r.url ? ' · ' : ''}${r.url ? link(r.url, 'run') : ''}</td></tr>`;

    // one block per kind (regression / load / suite / deploy), one row per environment
    const kinds = [...new Set(groups.map(g => g.kind))];
    const blocks = kinds.map(kind => {
      const rows = groups.filter(g => g.kind === kind).map(g => {
        const gr = runsOfGroup(s, g.id), last = gr[0];
        const withRep = last && (last.reports || []).length ? last : gr.find(r => (r.reports || []).length);
        const groupAllure = !withRep ? '<span class="muted">—</span>'
          : withRep === last ? reportLinks(p.id, String(last.id), last.reports, 'Report')
          : `<div class="muted small">last with a report, ${esc(fmtWhen(withRep.startedAt))}:</div>${reportLinks(p.id, String(withRep.id), withRep.reports, 'Report')}`;
        const history = gr.slice(1, 6).map(r => {
          const res = runResult(r), mark = /success/.test(res) ? '●' : /fail|error|timed/.test(res) ? '✕' : '·';
          const cls = /success/.test(res) ? 'var(--green-text)' : /fail|error|timed/.test(res) ? 'var(--red-text)' : 'var(--muted)';
          return `<span style="display:inline-block;text-align:center;margin-right:7px" title="${esc(fmtWhen(r.startedAt))} UTC — ${esc(res)}${r.counts ? ', ' + esc(countsText(r.counts)) : ''}">
            <span class="mono" style="color:${cls}">${mark}</span><br><span class="muted" style="font-size:.7rem">${esc((r.startedAt || '').slice(5, 10))}</span></span>`;
        }).join('');
        return `<tr><td><b>${esc(g.env || g.title)}</b><div class="muted small">${esc(g.workflowFile || '')}</div></td>
          <td class="small nowrap">${last ? `${esc(fmtWhen(last.startedAt))}<div class="muted">${esc(agoIso(last.startedAt))}</div>` : '<span class="muted">never run</span>'}</td>
          <td>${last ? resultPill(last) : ''}</td>
          <td class="small">${last && last.counts ? esc(countsText(last.counts)) : '<span class="muted">—</span>'}</td>
          <td class="small nowrap">${last ? esc(fmtDur(last.durationSec)) : ''}</td>
          <td class="small nowrap">${history || '<span class="muted">—</span>'}</td>
          <td class="small">${groupAllure}</td>
          <td class="nowrap">${mayRun(s, g)
            ? `<button class="btn sm primary" data-act="run-ci" data-project="${esc(p.id)}" data-group="${esc(g.id)}" title="Start this run now">▶ Run</button>`
            : `<button class="btn sm" disabled title="Only ${esc((s.allowedActors || []).join(', ') || 'the lead')} can start this one${s.restrictedNote ? ' — ' + esc(s.restrictedNote) : ''}">🔒 Run</button>`}${g.workflowUrl ? ' ' + link(g.workflowUrl, 'on ' + (s.kind === 'github' ? 'GitHub' : 'Bitbucket')) : ''}</td></tr>`;
      }).join('');
      return `<div class="section"><div class="section-head"><h3>${esc(KIND_TITLE[kind] || label(kind))}</h3></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Environment</th><th>Last run (UTC)</th><th>Result</th><th>Tests</th><th>Duration</th><th>Runs before it</th><th>Report</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('');

    const flat = runs.length ? `<details><summary class="small" style="cursor:pointer;color:var(--accent);padding:8px 0">All ${runs.length} collected runs</summary>
      <div class="card tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>When (UTC)</th><th>Job</th><th>Trigger</th><th>Result</th><th>Tests</th><th>Duration</th><th>Open</th></tr></thead><tbody>${runs.map(runRow).join('')}</tbody></table></div></details>` : '';
    const empty = !groups.length ? `<div class="card"><div class="empty">${s.status === 'error' ? 'The collector could not read this source, so there is nothing to group yet.' : 'No jobs matched the classification rules for this source.'}</div></div>` : '';
    return head + blocks + empty + flat +
      `<p class="hint" style="margin-top:10px">“Report” shows the run's report inside this page; ↗ opens it in a new tab, where it can be saved. “Run” starts the job through the tracker's own workflow, so the token in this browser never needs access to the project's repository. A card at the top then follows the run: while the page stays open, it collects when the run usually ends (and once earlier when past runs often stopped early), then at most twice more, so one press costs at most four collections, and a collection anyone else starts meanwhile counts as one of them. The card turns into “Report ready” when the report is in.</p>`;
  }

  // ---------- the Tests tab: one card per test in the project's catalogue
  const TEST_KIND = { ui: 'UI', http: 'HTTP' };
  const testKind = k => TEST_KIND[k] || label(k) || 'Other';
  const KIND_PILL = { ui: 'accent', http: 'purple' };
  const MARKER = {
    xfail: ['red', 'Expected to fail until a known defect is fixed'],
    skipif: ['grey', 'Skipped when a condition holds'],
    skip: ['grey', 'Skipped'],
    writes: ['yellow', 'Changes data on the environment it runs against'],
  };
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const catTerms = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  // Wraps every search term in <mark>; the text around it is escaped as everywhere else.
  const hl = (s, re) => re ? String(s ?? '').split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('') : esc(s);
  const catFilterOf = pid => S.catFilter[pid] ||= { q: '', kind: '', area: '' };
  const tally = (tests, key) => tests.reduce((m, t) => m.set(t[key], (m.get(t[key]) || 0) + 1), new Map());
  // The source links point into the repository at the catalogued commit; the part up to the
  // commit is the whole tree at that commit.
  function catTreeUrl(cat) {
    const u = (cat.tests.find(t => /^https:\/\//.test(t.sourceUrl)) || {}).sourceUrl || '';
    const i = /^[0-9a-f]{7,40}$/.test(cat.commit) ? u.indexOf(`/${cat.commit}/`) : -1;
    return i > 0 ? u.slice(0, i + cat.commit.length + 2) : '';
  }

  function testCard(t, cat, re) {
    const h = s => hl(s, re);
    const src = /^https:\/\//.test(t.sourceUrl) ? t.sourceUrl : '';
    const chips = [`<span class="pill ${KIND_PILL[t.kind] || ''}">${esc(testKind(t.kind))}</span>`]
      .concat(t.markers.map(m => { const [cls, tip] = MARKER[m] || ['', '']; return `<span class="pill ${cls}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(m)}</span>`; }));
    return `<article class="card tc">
      <h3 class="tc-title">${h(t.title)}</h3>
      <div class="tc-chips">${chips.join('')}</div>
      ${t.does ? `<h4>What it does</h4><p>${h(t.does)}</p>` : ''}
      ${t.checks.length ? `<h4>What it checks</h4><ul class="plain">${t.checks.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : ''}
      ${t.needs ? `<h4>Needs</h4><p>${h(t.needs)}</p>` : ''}
      ${t.params.length ? `<h4>Runs once for each parameter</h4><div class="tc-chips">${t.params.map(x => `<span class="chip mono" title="${esc(`${t.nodeid}[${x}]`)}">${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="tc-foot"><span class="mono tc-path">${h(t.nodeid || t.file)}</span>${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">Source${cat.commit ? ' at ' + esc(cat.commit.slice(0, 7)) : ''} ↗</a>` : ''}</div>
    </article>`;
  }

  function catalogList(pid) {
    const cat = S.catalogs[pid], f = catFilterOf(pid), terms = catTerms(f.q);
    const shown = cat.tests.filter(t => (!f.kind || t.kind === f.kind) && (!f.area || t.area === f.area) && terms.every(w => t.hay.includes(w)));
    const re = terms.length ? new RegExp(`(${terms.slice().sort((a, b) => b.length - a.length).map(reEsc).join('|')})`, 'gi') : null;
    const areas = [...new Set(shown.map(t => t.area))].sort((a, b) => a.localeCompare(b));
    const html = areas.map(a => {
      const ts = shown.filter(t => t.area === a);
      return `<section class="cat-area" data-area="${esc(a)}"><h2>${esc(a)} <span class="muted small">${ts.length}</span></h2>${ts.map(t => testCard(t, cat, re)).join('')}</section>`;
    }).join('') || `<div class="card"><div class="empty">No test matches. <button class="btn sm" data-act="cat-clear" data-project="${esc(pid)}">Clear the search and filters</button></div></div>`;
    const n = cat.tests.length;
    return { html, text: shown.length === n ? `All ${n} test${n === 1 ? '' : 's'}, grouped by area` : `${shown.length} of ${n} tests match` };
  }
  function paintCatalog(pid) {
    const box = $('[data-cat-list]');
    if (!box || !S.catalogs[pid]) return;
    const { html, text } = catalogList(pid);
    box.innerHTML = html;
    const c = $('[data-cat-count]'); if (c) c.textContent = text;
  }

  function vProjectTests(p) {
    const cat = S.catalogs[p.id];
    if (cat === undefined) return '<div class="card"><div class="empty" role="status">Loading the test catalogue…</div></div>';
    if (!cat) return `<div class="card"><div class="empty">This project has no test catalogue. It appears here once <span class="mono">data/catalog/${esc(p.id)}.json</span> is in the tracker repository.</div></div>`;
    if (cat.error) return `<div class="card"><div class="empty">The test catalogue could not be read: ${esc(cat.error)}</div></div>`;
    const f = catFilterOf(p.id), n = cat.tests.length, kinds = tally(cat.tests, 'kind'), areas = tally(cat.tests, 'area');
    if (f.kind && !kinds.has(f.kind)) f.kind = '';
    if (f.area && !areas.has(f.area)) f.area = '';
    const cases = cat.tests.reduce((k, t) => k + Math.max(1, t.params.length), 0);
    const tree = catTreeUrl(cat), short = cat.commit.slice(0, 7);
    const opts = (m, cur, lab) => [...m.keys()].sort((a, b) => a.localeCompare(b)).map(k => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(lab(k))} (${m.get(k)})</option>`).join('');
    const pid = esc(p.id), list = catalogList(p.id);
    const meta = [
      cat.repo ? `${esc(cat.repo)}${cat.branch ? ` <span class="pill">${esc(cat.branch)}</span>` : ''}` : '',
      short ? `commit ${tree ? `<a class="mono" href="${esc(tree)}" target="_blank" rel="noopener" title="${esc(cat.commit)}">${esc(short)}</a>` : `<span class="mono" title="${esc(cat.commit)}">${esc(short)}</span>`}` : '',
      cat.generatedAt ? `<span title="${esc(fmtWhen(cat.generatedAt))} UTC">catalogued ${esc(ago(dayOf(cat.generatedAt)))}, refreshed weekly</span>` : 'refreshed weekly',
    ].filter(Boolean).join(' · ');
    const summary = [...[...kinds].map(([k, c]) => `${c} ${esc(testKind(k))}`), `${areas.size} area${areas.size === 1 ? '' : 's'}`, cases !== n ? `${cases} cases once parameters are expanded` : ''].filter(Boolean).join(' · ');
    return `<div class="catalog">
      <div class="card cat-head">
        <div class="cat-count"><b>${n}</b> test${n === 1 ? '' : 's'} <span class="muted">· ${summary}</span></div>
        <div class="small muted">${meta}</div>
      </div>
      <div class="filters cat-filters" role="search">
        <input type="search" data-cf="q" data-project="${pid}" value="${esc(f.q)}" placeholder="Search titles, descriptions, checks, files" aria-label="Search the tests">
        <select data-cf="kind" data-project="${pid}" aria-label="Kind of test"><option value="">all kinds</option>${opts(kinds, f.kind, testKind)}</select>
        <select data-cf="area" data-project="${pid}" aria-label="Area"><option value="">all areas</option>${opts(areas, f.area, a => a)}</select>
      </div>
      <div class="hint cat-shown" data-cat-count aria-live="polite">${esc(list.text)}</div>
      <div data-cat-list>${list.html}</div>
      <p class="hint">Each card describes a test as its code stands at the commit above; “Source” opens that code.</p>
    </div>`;
  }

  function vCI() {
    const c = ci(), age = ciAge();
    const rows = projects().filter(p => p.status !== 'done').map(p => {
      const s = ciSource(p.id), t = s && s.tests;
      const cells = s ? (s.groups || []).map(g => {
        const r = runsOf(s).find(x => x.group === g.id); if (!r) return '';
        const rr = newestInline(s, g.id), i = firstInline(rr);
        const rep = rr ? ` ${reportBtn(p.id, String(rr.id), rr.reports[i], i, 'Report', 'btn sm')}` : '';
        return `<div class="small ci-cell">${resultPill(r)} <span class="muted">${esc(KIND_TITLE[g.kind] || g.kind)} ${esc(g.env || '')} · ${esc(agoIso(r.startedAt))}</span>${rep}</div>`;
      }).join('') : '';
      return `<tr><td>${prlink(p.id)}<div class="muted small">${esc(p.code || '')}</div></td>
        <td class="small">${s ? `${esc(kindName(s.kind))}: ${s.url ? link(s.url, s.repoName) : esc(s.repoName || '')}${s.note ? `<div class="muted">${esc(trunc(s.note, 90))}</div>` : ''}` : '<span class="muted">no source configured</span>'}</td>
        <td>${t ? `<b>${esc(String(t.functions))}</b> <span class="muted small">in ${esc(String(t.files))} files</span>` : '<span class="muted">—</span>'}</td>
        <td style="min-width:210px">${cells || '<span class="muted">no runs</span>'}</td>
        <td class="small">${s ? (s.status === 'error' ? `${pill('red', 'could not be read')} <span class="muted">${esc(trunc(s.error, 70))}</span>` : esc(agoIso(s.collectedAt))) : ''}</td>
        <td class="nowrap"><a class="btn sm" href="#/projects/${esc(p.id)}/ci">runs</a></td></tr>`;
    }).join('');
    const live = allLive();
    return `<div class="page-head"><div><h1>CI</h1><div class="sub">${c.collectedAt ? `snapshot from ${esc(fmtWhen(c.collectedAt))} UTC (${esc(agoIso(c.collectedAt))})` : 'nothing collected yet'} · collected hourly, or on demand</div></div>
      <div class="actions"><button class="btn primary" data-act="refresh-ci">↻ Refresh now</button></div></div>
      ${age && age.stale ? `<div class="banner">The CI snapshot is ${Math.round(age.hours)} hours old. Check the “Collect CI status” workflow in the tracker repository.</div>` : ''}
      ${waitsBox('')}
      ${live.length ? `<div class="card live" style="margin-bottom:14px"><h3><span class="live-dot"></span> Was running at the last check ${pill(snapMinutes() > 10 ? 'red' : 'yellow', snapMinutes() == null ? 'no snapshot' : `${snapMinutes()} min ago`)}</h3>${live.map(({ s, r }) => `<div class="row"><div class="body"><b>${esc(r.name || '')}</b> ${pill('accent', r.activeEnv || r.env || 'running')} ${(r.activeJobs || []).length ? `<span class="small">on at the time: ${(r.activeJobs || []).map(j => `<span class="mono">${esc(j.name)}</span>`).join(', ')}</span>` : ''}<div class="muted small">${esc(s.repoName || '')} · had been running ${esc(elapsed(r.startedAt))}</div></div><div class="ops">${reportLinks(s.projectId, String(r.id), r.reports, 'Report')}${r.url ? link(r.url, 'watch') : ''}</div></div>`).join('')}</div>` : ''}
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Repository</th><th>Test functions</th><th>Last run</th><th>Collected</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No projects.</td></tr>'}</tbody></table></div>
      <p class="hint" style="margin-top:10px">Test functions = <span class="mono">def test_</span> in the repository's test folder at the counted commit; the last-run numbers are what CI actually executed (parametrized cases count separately).</p>`;
  }

  function vPeople() {
    return `<div class="page-head"><div><h1>People</h1><div class="sub">${mentees().length} mentee${mentees().length === 1 ? '' : 's'} · ${people().length} total</div></div><div class="actions">${canSeeHistory() ? '<button class="btn primary" data-act="new-person">Add person</button>' : ''}</div></div>
      <div class="grid auto">${people().slice().sort((a, b) => (a.active === false) - (b.active === false) || (a.role === 'mentee' ? 0 : 1) - (b.role === 'mentee' ? 0 : 1)).map(p => {
        const o = lastOneOnOne(p.id), prs = personProjects(p.id), nq = canSeeThreadOf(p.id) ? openAsks(p.id).length : 0;
        const lr = canSeeLearningOf(p.id) ? enrollmentsOf(p.id).map(e => courseSummary(p.id, e.courseId)).filter(Boolean) : [];
        return `<div class="card clickable" data-href="#/people/${esc(p.id)}"><h3><a href="#/people/${esc(p.id)}">${esc(p.name)}</a> ${p.active === false ? pill('grey', 'inactive') : ''}${p.role !== 'mentee' ? pill('accent', label(p.role)) : ''}${p.track && canSeeLearningOf(p.id) ? pill('purple', p.track) : ''}</h3>
          <div class="meta">${esc(p.title || '')}${p.startedOn ? ` · since ${esc(p.startedOn)}` : ''}</div>
          ${p.focus ? `<p class="small" style="margin-top:6px"><span class="muted">Focus:</span> ${esc(p.focus)}</p>` : ''}
          <div class="small"><span class="muted">Projects:</span> ${prs.map(x => esc(x.name)).join(', ') || '—'}</div>
          <div class="small">${canSeeHistory() ? `<span class="muted">Last 1:1:</span> ${o ? esc(ago(o.date)) : 'never'}${nq ? ' · ' : ''}` : ''}${nq ? pill('yellow', nq + ' open') : ''}</div>
          ${lr.map(cs => `<div class="small" style="margin-top:6px"><b>${cs.pct}%</b> ${esc(cs.course.name)}${cs.current ? ` · <span class="muted">${esc(cs.current.title)}</span>` : ''}</div>${progressBar(cs)}`).join('')}
        </div>`;
      }).join('') || '<div class="empty">No people yet.</div>'}</div>`;
  }

  // First times, as everywhere; a finish after a reset and the reset itself are shown as well.
  function lessonDatesCell(pr, empty = '<span class="muted">—</span>') {
    const d = lessonDates(pr), runs = marksOf(pr), out = [], lastRun = runs[runs.length - 1];
    let i = runs.length;
    while (i > 0 && FINISHED.has(runs[i - 1].status)) i--;
    const again = i > 0 && i < runs.length ? runs[i].when : '';
    if (pr.status !== 'not-started' && d.startedAt) out.push(['started', d.startedAt]);
    if (FINISHED.has(pr.status) && d.doneAt) out.push(['finished', d.doneAt]);
    if (FINISHED.has(pr.status) && again && dayOf(again) !== dayOf(d.doneAt)) out.push(['finished again', again]);
    if (pr.status === 'gate-passed' && d.gatePassedAt) out.push(['gate passed', d.gatePassedAt]);
    if (pr.status === 'stuck' && pr.date) out.push(['stuck since', pr.date]);
    if (pr.status === 'not-started' && lastRun && lastRun.status === 'not-started') out.push(['reset', lastRun.when]);
    const trail = runs.map(r => `${whenLocal(r.at)} ${label(r.status)}${r.when !== r.at ? ` (for ${dayOf(r.when)})` : ''}`).join('\n');
    return out.length ? `<div class="lesson-dates" title="${esc(trail)}">${out.map(([k, v]) => `<div><span class="muted">${k}</span> <span class="nowrap">${esc(dayOf(v))}</span></div>`).join('')}</div>` : empty;
  }

  function learningBlock(id, e) {
    const cs = courseSummary(id, e.courseId); if (!cs) return '';
    const c = cs.course;
    return `<div class="card" style="margin-bottom:14px"><div class="section-head"><h3>${esc(c.name)} ${e.track ? pill('purple', e.track) : ''}</h3><div class="actions"><a class="btn sm" href="#/learning/${esc(c.id)}">matrix</a>${canSeeHistory() ? `<button class="btn sm" data-act="edit-enroll" data-person="${esc(id)}" data-course="${esc(c.id)}">edit</button><button class="btn sm" data-act="unenroll" data-person="${esc(id)}" data-course="${esc(c.id)}">remove</button>` : ''}</div></div>
      <div class="small muted">${e.startedOn ? `since ${esc(e.startedOn)} \u00b7 ` : ''}${cs.complete}/${cs.total} lessons \u00b7 ${cs.counts['gate-passed']} gates \u00b7 last mark ${esc(ago(cs.lastDate))}</div>
      ${e.goal ? `<div class="small"><span class="muted">Quarter goal:</span> ${esc(e.goal)}</div>` : ''}
      <div style="margin:6px 0 10px">${progressBar(cs)}</div>
      ${cs.current ? `<div class="small" style="margin-bottom:8px"><span class="muted">Now on:</span> <b>${esc(cs.current.title)}</b> <span class="muted">(${esc(cs.current.phaseName)})</span></div>` : '<div class="small" style="margin-bottom:8px">Course complete.</div>'}
      ${(c.phases || []).map(ph => { const ls = ph.lessons || []; const done = ls.filter(l => ['done', 'gate-passed'].includes(progressOf(id, l.id).status)).length;
        return `<details data-phase="${esc(c.id + ':' + ph.id)}" ${ls.some(l => l.id === cs.current?.id) ? 'open' : ''}><summary class="small"><b>${esc(ph.name)}</b> <span class="muted">${done}/${ls.length}</span></summary>
          <div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Lesson</th><th>Status</th><th class="col-dates">Dates</th><th>Note</th><th></th></tr></thead><tbody>${ls.map(l => { const pr = progressOf(id, l.id), onPhone = lessonDatesCell(pr, ''); return `<tr><td class="lesson-name">${esc(l.title)}${l.gate ? `<div class="muted" style="font-size:.75rem">gate: ${esc(l.gate)}</div>` : ''}</td><td><select class="lesson-status" data-person="${esc(id)}" data-lesson="${esc(l.id)}">${LESSON_STATUS.map(st => `<option value="${st}"${pr.status === st ? ' selected' : ''}>${label(st)}</option>`).join('')}</select>${onPhone ? `<div class="small dates-m">${onPhone}</div>` : ''}</td><td class="small nowrap col-dates">${lessonDatesCell(pr)}</td><td class="muted">${esc(pr.note || '')}</td><td><button class="btn sm" data-act="edit-lesson" data-person="${esc(id)}" data-lesson="${esc(l.id)}" data-title="${esc(l.title)}" title="note or date">note</button></td></tr>`; }).join('')}</tbody></table></div></details>`; }).join('')}
    </div>`;
  }

  function vPersonLearning(p) {
    if (!canSeeLearningOf(p.id)) return '<div class="card"><div class="empty">Learning progress is visible only to the person and the lead.</div></div>';
    const enr = enrollmentsOf(p.id);
    if (!enr.length) return `<div class="card"><div class="empty">${canSeeHistory() ? 'Not enrolled in any course yet. Use \u201cEnroll in course\u201d above.' : 'Not enrolled in any course yet. The lead does the enrolling.'}</div></div>`;
    return enr.map(e => learningBlock(p.id, e)).join('');
  }

  function vPersonThread(p) {
    if (!canSeeThreadOf(p.id)) return '';
    const thread = threadOf(p.id), me = viewerId();
    const bubble = m => `<div class="row"><div class="body">
        <div class="small"><b>${esc(m.authorId ? pname(m.authorId) : 'someone')}</b> <span class="muted">${esc(fmtWhen(m.at))}</span> ${m.question ? (m.resolved ? pill('green', 'answered') : pill('yellow', 'open question')) : ''}${m.authorId === me ? ' ' + pill('accent', 'you') : ''}</div>
        <div class="txt">${esc(m.text)}</div>
        ${m.resolved && m.resolvedBy ? `<div class="muted small">answered by ${esc(pname(m.resolvedBy))}${m.resolvedAt ? ' \u00b7 ' + esc(fmtWhen(m.resolvedAt)) : ''}</div>` : ''}
      </div><div class="ops">${m.question ? `<button class="btn sm" data-act="answer-msg" data-id="${esc(m.id)}" title="${m.resolved ? 'reopen' : 'mark answered'}">${m.resolved ? 'reopen' : 'answered'}</button>` : ''}${mayRemoveMessage(m) ? `<button class="btn sm" data-act="del-msg" data-id="${esc(m.id)}">remove</button>` : ''}</div></div>`;
    return `<div class="card"><div class="section-head"><h3>Questions and notes</h3>
        <div class="actions"><button class="btn primary" data-act="ask" data-person="${esc(p.id)}">Ask a question</button><button class="btn" data-act="note" data-person="${esc(p.id)}">Leave a note</button></div></div>
      <p class="hint">Only ${esc(threadReaders(p.id))} can read this thread. ${me ? `Posting as <b>${esc(viewerName())}</b>. <a href="#" data-act="who">Change</a>` : '<a href="#" data-act="who">Say who you are</a> before posting.'}</p>
      ${thread.length ? thread.map(bubble).join('') : '<div class="empty">Nothing here yet. Ask the first question.</div>'}</div>`;
  }

  function vPerson(id) {
    const p = person(id); if (!p) return `<div class="empty">Person not found. <a href="#/people">Back</a></div>`;
    const pa = personActs(id), ones = pa.filter(a => a.type === 'one-on-one'), others = pa.filter(a => a.type !== 'one-on-one');
    const seeL = canSeeLearningOf(id), seeT = canSeeThreadOf(id), prs = personProjects(id), enr = seeL ? enrollmentsOf(id) : [], nq = seeT ? openAsks(id).length : 0;
    const kv = [['Role', label(p.role)], ['Title', p.title], ['GitHub', p.githubLogin], ['Track', seeL && p.track ? label(p.track) : ''], ['Started', p.startedOn], ['Learning h/week', seeL ? p.weeklyLearningHours : ''], ['Focus', p.focus]].filter(([, v]) => v !== undefined && v !== null && v !== '');
    const tab = (S.route.tab === 'questions' && seeT) || (S.route.tab === 'learning' && seeL) ? S.route.tab : '';
    const head = `<div class="page-head"><div><h1>${esc(p.name)} ${p.active === false ? pill('grey', 'inactive') : ''}${viewerId() === id ? ' ' + pill('accent', 'you') : ''}</h1><div class="sub">${esc(p.title || label(p.role))}</div></div>
      <div class="actions">${canSeeHistory() ? `<button class="btn" data-act="log-11" data-person="${esc(id)}">Log 1:1</button><button class="btn" data-act="log-act" data-person="${esc(id)}">Log activity</button><button class="btn" data-act="enroll" data-person="${esc(id)}">Enroll in course</button>` : ''}${canEditPerson(id) ? `<button class="btn primary" data-act="edit-person" data-id="${esc(id)}">Edit</button>` : ''}${canSeeHistory() ? `<button class="btn danger ghost" data-act="del-person" data-id="${esc(id)}">Remove</button>` : ''}</div></div>
      <div class="tabs">
        <button class="${tab ? '' : 'active'}" data-href="#/people/${esc(id)}">Profile</button>
        ${seeL ? `<button class="${tab === 'learning' ? 'active' : ''}" data-href="#/people/${esc(id)}/learning">Learning${enr.length ? ` <span class="pill">${enr.length}</span>` : ''}</button>` : ''}
        ${seeT ? `<button class="${tab === 'questions' ? 'active' : ''}" data-href="#/people/${esc(id)}/questions">Questions${nq ? ` <span class="pill yellow">${nq} open</span>` : threadOf(id).length ? ` <span class="pill">${threadOf(id).length}</span>` : ''}</button>` : ''}
      </div>`;

    if (tab === 'learning') return head + vPersonLearning(p);
    if (tab === 'questions') return head + vPersonThread(p);

    const summary = enr.map(e => { const cs = courseSummary(id, e.courseId); return cs ? `<div class="small" style="margin-top:8px"><b>${cs.pct}%</b> ${esc(cs.course.name)}${cs.current ? ` \u00b7 <span class="muted">now on ${esc(cs.current.title)}</span>` : ' \u00b7 <span class="muted">complete</span>'}</div>${progressBar(cs)}` : ''; }).join('');
    return head + `<div class="grid cols-2">
        <div><div class="card" style="margin-bottom:14px"><h3>Profile</h3><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
          <div class="card" style="margin-bottom:14px"><h3>Projects</h3>${prs.length ? `<ul class="plain">${prs.map(pr => `<li>${prlink(pr.id)} <span class="muted small">\u2014 ${esc(personRoleIn(pr, id))}</span> ${dot(pr.health)} ${pill(pr.status)}</li>`).join('')}</ul>` : '<div class="empty">Not assigned to any project. Set them as lead or member in the project.</div>'}</div>
          ${canSeeHistory() ? `<div class="card"><div class="section-head"><h3>1:1 journal</h3><span class="hint">${ones.length} entries</span></div>${ones.length ? ones.map(a => actRow(a, { showPerson: false })).join('') : '<div class="empty">No 1:1 logged yet.</div>'}</div>` : ''}</div>
        <div>${seeL ? `<div class="card" style="margin-bottom:14px"><div class="section-head"><h3>Learning</h3><a class="btn sm" href="#/people/${esc(id)}/learning">open</a></div>${summary || '<div class="empty">Not enrolled in any course.</div>'}</div>` : ''}
          ${seeT ? `<div class="card" style="margin-bottom:14px"><div class="section-head"><h3>Questions</h3><a class="btn sm" href="#/people/${esc(id)}/questions">open</a></div>${nq ? openAsks(id).slice(0, 3).map(m => `<div class="row"><div class="body"><div class="txt small">${esc(trunc(m.text, 120))}</div><div class="muted small">${esc(pname(m.authorId))} \u00b7 ${esc(fmtWhen(m.at))}</div></div></div>`).join('') : `<div class="empty">${threadOf(id).length ? 'No open questions.' : 'Nothing asked yet.'}</div>`}</div>` : ''}
          ${canSeeHistory() ? `<div class="card"><div class="section-head"><h3>Other activity</h3></div>${others.length ? others.map(a => actRow(a, { showPerson: false })).join('') : '<div class="empty">Nothing logged.</div>'}</div>` : ''}</div>
      </div>`;
  }

  function vLearning(courseId) {
    const cs = courses(); if (!cs.length) return `<h1>Learning</h1><div class="empty">No curriculum loaded (data/curriculum.json).</div>`;
    const c = course(courseId) || cs[0];
    const ls = lessonsOf(c);
    const enrolled = learning().enrollments.filter(e => e.courseId === c.id).map(e => person(e.personId)).filter(Boolean).filter(p => canSeeLearningOf(p.id));
    // the rotated header is as tall as the longest lesson title needs, so nothing is clipped
    const headH = Math.min(520, Math.max(150, Math.round(ls.reduce((n, l) => Math.max(n, (l.title || '').length), 0) * 7.1) + 18));
    const cols = (c.phases || []).map(ph => `<th colspan="${(ph.lessons || []).length}" title="${esc(ph.name)}${ph.weeks ? ' · ' + esc(ph.weeks) : ''}">${esc(ph.name)}</th>`).join('');
    const rows = enrolled.map(p => { const sm = courseSummary(p.id, c.id); return `<tr><th class="person">${plink(p.id)}<div class="muted" style="font-weight:400">${sm.pct}% · ${sm.complete}/${sm.total}</div></th>${ls.map(l => { const pr = progressOf(p.id, l.id); return `<td class="cell ${pr.status}${sm.current?.id === l.id ? ' current' : ''}" data-person="${esc(p.id)}" data-lesson="${esc(l.id)}" data-title="${esc(l.title)}" title="${esc(l.title)} — ${label(pr.status)}${pr.date ? ' · ' + esc(pr.date) : ''}${pr.note ? '&#10;' + esc(pr.note) : ''}">${LESSON_GLYPH[pr.status] || ''}</td>`; }).join('')}</tr>`; }).join('');
    return `<div class="page-head"><div><h1>Learning</h1><div class="sub">${cs.length} course${cs.length === 1 ? '' : 's'} · tap a cell to advance its status; right-click, shift-click or long-press to set a note or date${canSeeHistory() ? '' : ' · only your own progress is shown'}</div></div>
      <div class="actions">${canSeeHistory() ? `<button class="btn primary" data-act="enroll-any" data-course="${esc(c.id)}">Enroll someone</button>` : ''}</div></div>
      <div class="tabs">${cs.map(x => `<button class="${x.id === c.id ? 'active' : ''}" data-href="#/learning/${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div>
      <div class="card" style="margin-bottom:14px"><h3>${esc(c.name)} <span class="pill">${esc(c.audience || '')}</span></h3><p class="small">${esc(c.description || '')}</p>
        <dl class="kv"><dt>Where</dt><dd class="mono small">${esc(c.path || '')}</dd><dt>Lessons</dt><dd>${ls.filter(counted).length}${ls.length > ls.filter(counted).length ? ` + ${ls.length - ls.filter(counted).length} extra (supplements, practicum)` : ''} in ${(c.phases || []).length} phases</dd>${c.language ? `<dt>Language</dt><dd>${esc(c.language)}</dd>` : ''}</dl>
        ${c.rules?.length ? `<details><summary class="small">Course rules (${c.rules.length})</summary><ul class="plain small">${c.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        ${c.milestones?.length ? `<details><summary class="small">Milestones / checkpoints (${c.milestones.length})</summary><ul class="plain small">${c.milestones.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        ${c.tracks?.length ? `<details><summary class="small">Pace tracks</summary><ul class="plain small">${c.tracks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
      </div>
      <div class="legend"><span><span class="sw" style="background:transparent"></span>not started</span><span><span class="sw" style="background:color-mix(in srgb,var(--yellow) 45%,transparent)"></span>in progress</span><span><span class="sw" style="background:color-mix(in srgb,var(--green) 55%,transparent)"></span>done</span><span><span class="sw" style="background:var(--green)"></span>★ gate passed</span><span><span class="sw" style="background:color-mix(in srgb,var(--red) 60%,transparent)"></span>! stuck</span><span><span class="sw" style="box-shadow:inset 0 0 0 2px var(--accent)"></span>current lesson</span></div>
      <div class="hint" style="margin-top:8px" aria-live="polite">${S.lastCell ? `${esc(S.lastCell.person)} · ${esc(S.lastCell.title)} → <b>${esc(label(S.lastCell.status))}</b>` : 'The lesson and new status of the last cell you tap show here.'}</div>
      <div class="matrix-wrap" style="margin-top:8px"><table class="matrix"><thead><tr class="phases"><th class="person"></th>${cols}</tr><tr class="lessons"><th class="person">Person</th>${ls.map(l => `<th title="${esc(l.title)}" style="height:${headH}px">${esc(l.title)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="${ls.length + 1}" style="padding:14px">${canSeeHistory() ? 'Nobody enrolled yet — use “Enroll someone”.' : signedInAs() ? 'You are not enrolled in this course.' : esc(learningLock())}</td></tr>`}</tbody></table></div>
      <div class="section" style="margin-top:20px"><div class="section-head"><h2>Lesson index</h2></div><div class="card tbl-wrap"><table class="tbl small"><thead><tr><th>#</th><th>Phase</th><th>Lesson</th><th>File</th><th>Gate / capstone</th></tr></thead><tbody>${ls.map((l, i) => `<tr><td>${i + 1}</td><td class="muted">${esc(l.phaseName)}</td><td>${esc(l.title)}</td><td class="mono muted">${esc(l.file || '')}</td><td class="muted">${esc(l.gate || l.capstone || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function vActivity() {
    const f = S.actFilter || { person: '', project: '', type: '', range: '30', q: '' };
    const t = today();
    let list = acts().slice().sort(byDateDesc);
    if (f.person) list = list.filter(a => a.personId === f.person);
    if (f.project) list = list.filter(a => a.projectId === f.project);
    if (f.type) list = list.filter(a => a.type === f.type);
    if (f.range !== 'all') list = list.filter(a => daysBetween(a.date, t) <= Number(f.range));
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(a => (a.text || '').toLowerCase().includes(q)); }
    const groups = [];
    for (const a of list) { const g = groups[groups.length - 1]; if (g && g.date === a.date) g.items.push(a); else groups.push({ date: a.date, items: [a] }); }
    return `<div class="page-head"><div><h1>Activity</h1><div class="sub">${list.length} of ${acts().length} entries</div></div><div class="actions"><button class="btn" data-act="log-11">Log 1:1</button><button class="btn" data-act="log-blocker">Log blocker</button><button class="btn primary" data-act="log-act">Log activity</button></div></div>
      <div class="filters">
        <select data-af="range"><option value="7"${f.range === '7' ? ' selected' : ''}>last 7 days</option><option value="30"${f.range === '30' ? ' selected' : ''}>last 30 days</option><option value="90"${f.range === '90' ? ' selected' : ''}>last 90 days</option><option value="all"${f.range === 'all' ? ' selected' : ''}>all time</option></select>
        <select data-af="person"><option value="">any person</option>${people().map(p => `<option value="${esc(p.id)}"${f.person === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select data-af="project"><option value="">any project</option>${projects().map(p => `<option value="${esc(p.id)}"${f.project === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select data-af="type"><option value="">any type</option>${ACT_TYPES.map(x => `<option value="${x}"${f.type === x ? ' selected' : ''}>${label(x)}</option>`).join('')}</select>
        <input type="search" data-af="q" placeholder="search text" value="${esc(f.q)}">
      </div>
      ${groups.map(g => `<div class="section"><div class="section-head"><h3>${esc(g.date)} <span class="muted small">${esc(ago(g.date))}</span></h3></div><div class="card">${g.items.map(a => actRow(a)).join('')}</div></div>`).join('') || '<div class="empty">No entries in this range.</div>'}`;
  }

  function vData() {
    const st = settings();
    const counts = COLLECTIONS.filter(c => !PRIVATE.has(c) || canSeeHistory()).map(c => { const d = S.data[c]; const n = c === 'messages' ? `${visibleMessages().length}${canSeeHistory() ? '' : ' (your thread)'}` : Array.isArray(d) ? d.length : c === 'curriculum' ? courses().length + ' courses' : c === 'learning' ? (l => `${l.enrollments.length} enrollments, ${Object.keys(l.progress).length} marks${canSeeHistory() ? '' : ' (yours)'}`)(visibleLearning()) : '—'; return `<tr><td class="mono">${c}.json</td><td>${esc(String(n))}</td></tr>`; }).join('');
    const theme = localStorage.getItem(LS + 'theme') || 'auto';
    const g = ghConfig();
    const sub = S.backend === 'server' ? `Server on — writing to <span class="mono">${esc(S.dataDir)}</span>` : S.backend === 'github' ? `Connected to GitHub — every save is a commit to <span class="mono">${esc(g.owner)}/${esc(g.repo)}</span>` : 'Not connected — edits stay in this browser until you export';
    const ghCard = S.server ? '' : `<div class="card" style="margin-bottom:14px"><h3>GitHub backend</h3>
        ${S.backend === 'github' ? `<p class="small">Reading and writing <span class="mono">data/*.json</span> in <span class="mono">${esc(g.owner)}/${esc(g.repo)}</span> on branch <span class="mono">${esc(g.branch)}</span> with the token stored in this browser.${S.ghError ? ` <span class="pill red">last read failed: ${esc(S.ghError)}</span>` : ''}</p>
          <p class="small">${S.privateOk ? `The activity log is being read from <span class="mono">${esc(g.owner)}/${esc(LOG_REPO)}</span>.` : 'This token reaches no activity log, so none is shown. That is the normal state for everyone but the lead.'}</p>
          <p class="small">${S.restoredToken
            ? 'The connection was taken back from the browser\u2019s password manager on this visit.'
            : 'The connection is kept in this browser\u2019s site data' + (passwordStoreWorks() ? ', and in its password manager when the browser is allowed to save passwords' : '') + '.'}
            If you have to connect again every time the browser closes, the browser deletes site data on close: in Chrome open <span class="mono">chrome://settings/content/siteData</span> and add <span class="mono">${esc(location.origin)}</span> under \u201cAllowed to save data on your device\u201d.</p>
          <p class="small">${S.ghUser ? (S.me ? `Signed in as <b>${esc(S.ghUser)}</b>, recognised as <b>${esc(viewerName())}</b> — everything you post is signed that way.` : loginHolders(S.ghUser).length > 1 ? `Signed in as <b>${esc(S.ghUser)}</b>, but more than one person on the team carries that GitHub username, so it is taken for none of them. The lead has to leave it on one profile only.` : `Signed in as <b>${esc(S.ghUser)}</b>, but no person on the team carries that GitHub username. The lead puts it on their profile so their posts are signed automatically.`) : 'This token does not say who owns it, so posts are signed with the name picked in the menu, and no learning progress is shown.'}</p><div class="actions"><button class="btn" data-act="gh-connect">Change connection</button><button class="btn danger" data-act="gh-disconnect">Forget token</button></div>`
        : `<p class="small">This page holds no data. Connect it to the private repository that does: create a personal access token on GitHub (Settings → Developer settings) and paste it here. If you were invited to the repository, it has to be a <b>classic</b> token with the <b>repo</b> scope: GitHub does not let fine-grained tokens reach another person\u2019s repositories. The owner can use a fine-grained token with <b>Contents</b> and <b>Actions: read and write</b>. It is kept in this browser only and sent only to api.github.com. If the browser deletes site data on close, allow this site to keep it (in Chrome: <span class="mono">chrome://settings/content/siteData</span>, \u201cAllowed to save data on your device\u201d), or you will have to connect again after every close.</p>
          ${storageWorks() ? '' : '<div class="banner">This browser is not keeping site data, so a connection cannot be remembered here. That is what a private window or a “block site data” setting does. Open the page in a normal window.</div>'}
          ${S.ghError ? `<div class="banner">GitHub answered: ${esc(S.ghError)}</div>` : ''}<div class="actions"><button class="btn primary" data-act="gh-connect">Connect to GitHub</button></div>`}
      </div>`;
    return `<div class="page-head"><div><h1>Data & settings</h1><div class="sub">${sub}</div></div><div class="actions">${canSeeHistory() ? '<button class="btn primary" data-act="settings">Edit settings</button>' : ''}</div></div>
      ${ghCard}
      <div class="grid cols-2">
        <div class="card"><h3>Storage</h3><table class="tbl"><thead><tr><th>Collection</th><th>Contents</th></tr></thead><tbody>${counts}</tbody></table>
          <div class="actions" style="margin-top:12px"><button class="btn" data-act="export">Export all (JSON)</button>${canSeeHistory() ? '<label class="btn">Import JSON <input type="file" accept="application/json" data-act="import" hidden></label>' : ''}${S.localOverride ? '<button class="btn danger" data-act="clear-local">Discard browser-only edits</button>' : ''}</div>
          <p class="hint" style="margin-top:8px">${canSeeHistory() ? 'Import replaces the collections present in the file, except the CI snapshot, which only the collector writes. ' : 'The export holds what this page shows you. Importing is the lead’s. '}Through the local server a backup of each file is kept as <span class="mono">*.json.bak</span>; through GitHub every save is a commit, so history is in git.</p></div>
        <div class="card"><h3>Settings</h3><dl class="kv"><dt>Team</dt><dd>${esc(st.teamName)}</dd><dt>Lead</dt><dd>${esc(st.leadName || '—')}</dd><dt>Stale learning</dt><dd>${esc(st.staleLearningDays)} days without a mark</dd></dl>
          <h3 style="margin-top:14px">Theme</h3><div class="actions">${['auto', 'light', 'dark'].map(t => `<button class="btn sm ${theme === t ? 'primary' : ''}" data-theme-set="${t}">${label(t)}</button>`).join('')}</div>
          <h3 style="margin-top:14px">How this works</h3><ul class="plain small"><li><b>Projects</b> hold status, health, lead, workstreams, milestones and facts.</li><li><b>People</b> are your mentees; each project's lead is one of them.</li>${canSeeHistory() ? '<li><b>Activity</b> is the log: updates, blockers, decisions, 1:1s. It feeds “needs attention”.</li>' : ''}<li><b>Learning</b> tracks each person per lesson across the courses you handed out; gates are the checkpoints.</li><li>Everything is plain JSON in <span class="mono">data/</span>, versioned in git. Commit when you want a snapshot.</li></ul></div>
      </div>`;
  }

  // ---------- team statistics (lead only)
  const SERIES = [
    { color: 'var(--accent)', dash: '', shape: 'circle' },
    { color: 'var(--yellow-text)', dash: '7 4', shape: 'square' },
    { color: 'var(--green)', dash: '2 4', shape: 'triangle' },
    { color: 'var(--red)', dash: '10 4 2 4', shape: 'diamond' },
    { color: 'var(--text)', dash: '5 3', shape: 'circle' },
    { color: 'var(--muted)', dash: '1 4', shape: 'square' },
  ];
  const statPeople = () => activePeople().filter(p => p.role === 'mentee' || enrollmentsOf(p.id).length);
  function lessonIndex() {
    const m = new Map();
    for (const c of courses()) for (const l of lessonsOf(c)) if (!m.has(l.id)) m.set(l.id, { l, c });
    return m;
  }
  const markList = () => Object.entries(learning().progress).flatMap(([k, pr]) => {
    const i = k.indexOf('|'), pid = k.slice(0, i), lid = k.slice(i + 1);
    return marksOf(pr).map(r => ({ pid, lid, ...r }));
  });
  const sortKey = at => isDay(at) ? at : (isNaN(new Date(at)) ? String(at) : localIso(new Date(at)));
  const fmtPace = n => { const v = Math.round(n * 10) / 10; return `${v} lesson${v === 1 ? '' : 's'} a week`; };

  function personStats(pid) {
    const t = today();
    const sums = enrollmentsOf(pid).map(e => courseSummary(pid, e.courseId)).filter(Boolean);
    const total = sums.reduce((n, s) => n + s.total, 0);
    const counts = Object.fromEntries(LESSON_STATUS.map(st => [st, sums.reduce((n, s) => n + (s.counts[st] || 0), 0)]));
    const finished = [], stuck = [];
    for (const s of sums) for (const l of lessonsOf(s.course).filter(counted)) {
      const pr = progressOf(pid, l.id);
      if (FINISHED.has(pr.status)) finished.push({ l, c: s.course, day: dayOf(lessonDates(pr).doneAt || pr.date) });
      else if (pr.status === 'stuck') stuck.push({ l, c: s.course, since: pr.date || '' });
    }
    const days = markList().filter(m => m.pid === pid).map(m => dayOf(m.when)).filter(isDay).sort();
    const first = days[0] || '', last = days[days.length - 1] || '';
    const recent = finished.filter(f => isDay(f.day) && daysBetween(f.day, t) >= 0 && daysBetween(f.day, t) < 28).length;
    const since = [first, ...enrollmentsOf(pid).map(e => e.startedOn)].filter(isDay).sort()[0] || '';
    const span = since ? Math.max(7, daysBetween(since, t) + 1) : 0;
    const recentPace = recent / 4, overallPace = span ? finished.length * 7 / span : 0, left = total - finished.length;
    const eta = !total ? '' : left <= 0 ? 'complete' : recentPace > 0 ? addDays(t, Math.ceil(left / recentPace * 7)) : 'no pace yet';
    return { sums, total, counts, done: finished.length, pct: total ? Math.round(100 * finished.length / total) : 0, gates: counts['gate-passed'],
      finished, stuck, first, last, sinceLast: last ? daysBetween(last, t) : null, recent, recentPace, overallPace, eta };
  }

  const shortDay = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const r1 = v => Math.round(v * 10) / 10;
  function chartWidth() {
    const v = $('#view'); if (!v || !v.clientWidth) return 640;
    const cs = getComputedStyle(v);
    return Math.max(260, Math.min(1000, Math.floor(v.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 34)));
  }
  function marker(shape, cx, cy, color) {
    const st = `style="fill:${color};stroke:var(--surface);stroke-width:2"`;
    if (shape === 'square') return `<rect x="${r1(cx - 4.5)}" y="${r1(cy - 4.5)}" width="9" height="9" rx="1.5" ${st}/>`;
    if (shape === 'triangle') return `<path d="M${r1(cx)} ${r1(cy - 5.5)}L${r1(cx + 5.5)} ${r1(cy + 4.5)}H${r1(cx - 5.5)}Z" ${st}/>`;
    if (shape === 'diamond') return `<path d="M${r1(cx)} ${r1(cy - 6)}L${r1(cx + 6)} ${r1(cy)}L${r1(cx)} ${r1(cy + 6)}L${r1(cx - 6)} ${r1(cy)}Z" ${st}/>`;
    return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="5" ${st}/>`;
  }
  const lineKey = k => `<svg class="key" width="30" height="14" viewBox="0 0 30 14" aria-hidden="true"><line x1="2" y1="7" x2="28" y2="7" style="stroke:${k.color};stroke-width:2;stroke-linecap:round${k.dash ? `;stroke-dasharray:${k.dash}` : ''}"/>${marker(k.shape, 15, 7, k.color)}</svg>`;

  // Cumulative lessons finished, one step line per person, x = days.
  function cumulativeChart(series) {
    const all = series.flatMap(s => s.days);
    if (!all.length) { S.chart = null; return '<div class="empty">No lessons finished yet.</div>'; }
    const t = today(), last = all.reduce((a, b) => (a > b ? a : b)), end = last > t ? last : t;
    let start = addDays(all.reduce((a, b) => (a < b ? a : b)), -1);
    if (daysBetween(start, end) < 7) start = addDays(end, -7);
    const span = daysBetween(start, end), W = chartWidth(), H = 250, ends = W >= 520;
    const m = { l: 34, r: ends ? 104 : 16, t: 14, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const most = Math.max(1, ...series.map(s => s.days.length));
    const step = most <= 6 ? 1 : most <= 12 ? 2 : most <= 30 ? 5 : 10, top = Math.ceil(most / step) * step;
    const x = d => m.l + pw * daysBetween(start, d) / span, y = n => m.t + ph - ph * n / top;
    let grid = '';
    for (let n = 0; n <= top; n += step) grid += `<line class="grid-line" x1="${m.l}" x2="${m.l + pw}" y1="${r1(y(n))}" y2="${r1(y(n))}"/><text x="${m.l - 7}" y="${r1(y(n) + 4)}" text-anchor="end">${n}</text>`;
    const every = Math.ceil(span / Math.max(1, Math.min(6, Math.floor(pw / 90))));
    for (let k = 0; k <= span; k += every) {
      const d = addDays(start, k), px = x(d);
      grid += `<line class="axis" x1="${r1(px)}" x2="${r1(px)}" y1="${m.t + ph}" y2="${m.t + ph + 4}"/><text x="${r1(px)}" y="${H - 8}" text-anchor="${px < m.l + 20 ? 'start' : px > m.l + pw - 20 ? 'end' : 'middle'}">${esc(shortDay(d))}</text>`;
    }
    const drawn = series.map(s => {
      const byDay = new Map(); for (const d of s.days) byDay.set(d, (byDay.get(d) || 0) + 1);
      let n = 0, path = `M${m.l} ${r1(y(0))}`; const pts = [];
      for (const [d, k] of byDay) { n += k; path += `H${r1(x(d))}V${r1(y(n))}`; pts.push([x(d), y(n)]); }
      return { s, n, pts, path: path + `H${r1(x(end))}` };
    });
    const lines = drawn.map(({ s, n, pts, path }) => `<g><title>${esc(s.name)}: ${n} finished</title><path d="${path}" style="fill:none;stroke:${s.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round${s.dash ? `;stroke-dasharray:${s.dash}` : ''}"/>${pts.map(([px, py]) => marker(s.shape, px, py, s.color)).join('')}</g>`).join('');
    let labels = '';
    if (ends) {
      // Labels that would collide are left to the legend, all of them, so none reads as the only one.
      const ys = drawn.map(d => y(d.n) + 4);
      drawn.forEach((d, i) => {
        if (ys.some((v, j) => j !== i && Math.abs(v - ys[i]) < 13)) return;
        labels += `<text class="end" x="${m.l + pw + 8}" y="${r1(ys[i])}">${esc(trunc(d.s.name, 13))} ${d.n}</text>`;
      });
    }
    S.chart = { start, span, W, m, pw, series: series.map(s => ({ name: s.name, color: s.color, dash: s.dash, days: s.days })) };
    return `<div class="chart-box" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" style="max-width:${W}px" aria-label="Lessons finished per person, cumulative, ${esc(start)} to ${esc(end)}. Left and right arrow keys read one day.">
      ${grid}<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${r1(y(0))}" y2="${r1(y(0))}"/>${lines}${labels}
      <line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/></svg><div class="chart-tip" hidden></div></div>`;
  }
  function bindChart(v) {
    const box = $('[data-chart]', v), ch = S.chart;
    if (!box || !ch) return;
    const svg = $('svg', box), tip = $('.chart-tip', box), cross = $('.cross', svg);
    let cur = null;
    const show = di => {
      cur = Math.max(0, Math.min(ch.span, di));
      const day = addDays(ch.start, cur), px = ch.m.l + ch.pw * cur / ch.span;
      cross.setAttribute('x1', r1(px)); cross.setAttribute('x2', r1(px)); cross.setAttribute('visibility', 'visible');
      const head = document.createElement('div'); head.className = 'muted'; head.textContent = day;
      tip.replaceChildren(head);
      ch.series.map(s => ({ s, n: s.days.filter(d => d <= day).length })).sort((a, b) => b.n - a.n).forEach(({ s, n }) => {
        const row = document.createElement('div'), key = document.createElement('span'), val = document.createElement('b');
        key.className = 'k'; key.style.borderTop = `2px ${s.dash ? 'dashed' : 'solid'} ${s.color}`;
        val.textContent = String(n);
        row.append(key, val, document.createTextNode(s.name));
        tip.append(row);
      });
      tip.hidden = false;
      const scale = svg.getBoundingClientRect().width / ch.W, left = px * scale, tw = tip.offsetWidth;
      tip.style.left = `${left + 12 + tw > box.clientWidth ? Math.max(0, left - 12 - tw) : left + 12}px`;
      tip.style.top = `${Math.round(ch.m.t * scale)}px`;
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; cur = null; };
    const dayAt = e => { const r = svg.getBoundingClientRect(); return Math.round(((e.clientX - r.left) * ch.W / r.width - ch.m.l) / ch.pw * ch.span); };
    svg.addEventListener('pointermove', e => show(dayAt(e)));
    svg.addEventListener('pointerdown', e => show(dayAt(e)));
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => show(ch.span));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show((cur ?? ch.span) + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1)); }
      else if (e.key === 'Escape') hide();
    });
  }

  function finishCell(pr) {
    const d = lessonDates(pr);
    if (FINISHED.has(pr.status)) {
      const day = dayOf(d.doneAt || pr.date), gate = pr.status === 'gate-passed';
      const tip = `finished ${day}${gate && d.gatePassedAt ? ', gate passed ' + dayOf(d.gatePassedAt) : ''}`;
      return `<td class="day" title="${esc(tip)}">${esc(day || '?')}${gate ? ' ★' : ''}</td>`;
    }
    if (pr.status === 'in-progress') return `<td class="day muted" title="in progress since ${esc(dayOf(d.startedAt || pr.date))}">…</td>`;
    if (pr.status === 'stuck') return `<td class="day" title="stuck since ${esc(pr.date || '')}">${pill('stuck', '! stuck')}</td>`;
    return '<td class="day"></td>';
  }

  function vStats() {
    const t = today(), idx = lessonIndex();
    const rows = statPeople().map((p, i) => ({ p, s: personStats(p.id), look: SERIES[i % SERIES.length] }));
    const sum = f => rows.reduce((n, r) => n + f(r), 0);
    const open = sum(r => openAsks(r.p.id).length), stuck = sum(r => r.s.stuck.length);
    const card = ({ p, s, look }) => {
      const nq = openAsks(p.id).length, nm = threadOf(p.id).length, prs = personProjects(p.id);
      const eta = !s.total ? '<span class="muted">not enrolled</span>' : s.eta === 'complete' ? pill('green', 'complete')
        : s.eta === 'no pace yet' ? '<span class="muted">no pace yet</span>' : `${esc(s.eta)} <span class="muted">(in ${daysBetween(t, s.eta)} days)</span>`;
      const kv = [
        ['Courses', s.sums.map(cs => `${esc(cs.course.name)} <span class="muted">${cs.pct}% · ${cs.complete}/${cs.total}</span>`).join('<br>') || '<span class="muted">not enrolled</span>'],
        ['Current lesson', s.sums.map(cs => cs.current ? esc(cs.current.title) + (s.sums.length > 1 ? ` <span class="muted">(${esc(cs.course.name)})</span>` : '') : `<span class="muted">${esc(cs.course.name)}: complete</span>`).join('<br>') || '<span class="muted">—</span>'],
        ['Stuck', s.stuck.length ? s.stuck.map(x => `${pill('stuck', '!')} ${esc(x.l.title)}${x.since ? ` <span class="muted">since ${esc(x.since)}</span>` : ''}`).join('<br>') : '<span class="muted">none</span>'],
        ['First mark', s.first ? esc(s.first) : '<span class="muted">none yet</span>'],
        ['Last mark', s.last ? esc(s.last) : '<span class="muted">none yet</span>'],
        ['Days since last mark', s.last ? esc(String(s.sinceLast)) : '<span class="muted">—</span>'],
        ['Pace, last 28 days', `${fmtPace(s.recentPace)} <span class="muted">(${s.recent} finished)</span>`],
        ['Pace overall', s.first ? fmtPace(s.overallPace) : '<span class="muted">—</span>'],
        ['Projected finish', eta],
        ['Questions', `${nq ? pill('yellow', nq + ' open') : '<span class="muted">0 open</span>'} <span class="muted">· ${nm} message${nm === 1 ? '' : 's'}</span>`],
        ['Projects', prs.map(pr => `${prlink(pr.id)} <span class="muted small">(${esc(personRoleIn(pr, p.id))})</span>`).join('<br>') || '<span class="muted">none</span>'],
      ];
      return `<div class="card" data-stat-person="${esc(p.id)}"><h3>${lineKey(look)} ${plink(p.id)} ${p.track ? pill('purple', p.track) : ''}</h3>
        <div class="small"><b>${s.pct}%</b> complete · ${s.done}/${s.total} lessons · ${s.gates} gate${s.gates === 1 ? '' : 's'} passed</div>
        <div style="margin:6px 0 10px">${progressBar({ total: s.total, counts: s.counts })}</div>
        <dl class="kv stat-kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
    };
    const chart = cumulativeChart(rows.map(({ p, s, look }) => ({ name: p.name, days: s.finished.map(f => f.day).filter(isDay).sort(), ...look })));
    const legend = rows.length ? `<div class="chart-legend">${rows.map(({ p, s, look }) => `<span>${lineKey(look)}${esc(p.name)} <b>${s.done}</b></span>`).join('')}</div>` : '';
    const feed = markList().sort((a, b) => sortKey(b.at).localeCompare(sortKey(a.at))).slice(0, 25);
    const feedRow = m => {
      const x = idx.get(m.lid), time = isDay(m.at) ? '' : whenLocal(m.at).slice(11);
      return `<div class="row"><div class="when">${esc(dayOf(m.at))}${time ? `<br><span class="muted">${esc(time)}</span>` : ''}</div>
        <div class="body"><div>${plink(m.pid)} <span class="muted">·</span> ${esc(x ? x.l.title : m.lid)}</div>
        <div class="tags">${pill(m.status, label(m.status))}<span class="muted small">${esc(x ? x.c.name : '')}${m.when !== m.at ? ` · for ${esc(dayOf(m.when))}` : ''} · ${esc(ago(dayOf(m.at)))}</span></div></div></div>`;
    };
    const tables = courses().map(c => {
      const who = rows.filter(r => enrollmentsOf(r.p.id).some(e => e.courseId === c.id));
      if (!who.length) return '';
      const body = (c.phases || []).map(ph => `<tr class="phase"><td colspan="${who.length + 1}">${esc(ph.name)}</td></tr>` +
        (ph.lessons || []).map(l => `<tr><td class="lesson">${esc(l.title)}</td>${who.map(r => finishCell(progressOf(r.p.id, l.id))).join('')}</tr>`).join('')).join('');
      return `<div class="card" style="margin-bottom:14px"><h3>${esc(c.name)}</h3><div class="tbl-wrap"><table class="tbl small stat-matrix"><thead><tr><th>Lesson</th>${who.map(r => `<th>${esc(r.p.name)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
    }).join('');
    return `<div class="page-head"><div><h1>Team stats</h1><div class="sub">${rows.length} ${rows.length === 1 ? 'person' : 'people'} learning · computed from lesson marks and messages · only the lead sees this page</div></div></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${sum(r => r.s.done)}</div><div class="l">lessons finished</div></div>
        <div class="kpi"><div class="v">${sum(r => r.s.recent)}</div><div class="l">finished in the last 28 days</div></div>
        <div class="kpi ${stuck ? 'bad' : 'good'}"><div class="v">${stuck}</div><div class="l">stuck lessons</div></div>
        <div class="kpi ${open ? 'warn' : 'good'}"><div class="v">${open}</div><div class="l">open questions</div></div>
      </div>
      <div class="section" data-section="people"><div class="section-head"><h2>People</h2><span class="hint">pace = lessons finished per week; the finish date assumes the last 28 days' pace</span></div>
        <div class="grid auto">${rows.map(card).join('') || '<div class="empty">No mentees yet.</div>'}</div></div>
      <div class="section" data-section="chart"><div class="section-head"><h2>Lessons finished over time</h2><span class="hint">cumulative; a lesson counts from the day it was first finished</span></div>
        <div class="card">${chart}${legend}</div></div>
      <div class="section" data-section="feed"><div class="section-head"><h2>Recent marks</h2><span class="hint">latest ${feed.length} across the team</span></div>
        <div class="card">${feed.map(feedRow).join('') || '<div class="empty">No marks yet.</div>'}</div></div>
      <div class="section" data-section="lessons"><div class="section-head"><h2>Finished lessons by person</h2><span class="hint">the day each lesson was finished · ★ gate passed · … in progress</span></div>
        ${tables || '<div class="empty">Nobody is enrolled in a course.</div>'}</div>`;
  }

  // ---------- status summary (plain text for a report or a chat message)
  function statusSummary() {
    const t = today(), lines = [`Team status — ${t}`, ''];
    for (const p of projects().filter(x => x.status !== 'done')) {
      const la = projectActs(p.id)[0];
      const bl = openBlockers().filter(b => b.projectId === p.id);
      lines.push(`${p.name} — ${p.status}, health ${p.health}${p.healthReason ? ': ' + p.healthReason : ''}`);
      lines.push(`  lead: ${p.leadId ? pname(p.leadId) : 'unassigned'}${(p.memberIds || []).length ? '; also ' + p.memberIds.map(pname).join(', ') : ''}`);
      if (p.nextMilestone?.text) lines.push(`  next: ${p.nextMilestone.text}${p.nextMilestone.due ? ' (due ' + p.nextMilestone.due + ')' : ''}`);
      const src = ciSource(p.id);
      if (src) {
        lines.push(`  tests: ${src.tests ? src.tests.functions + ' functions' : 'not counted'}${src.status === 'error' ? '; collector error: ' + src.error : ''}`);
        for (const g of (src.groups || [])) {
          const r = runsOf(src).find(x => x.group === g.id);
          if (r) lines.push(`    ${(KIND_TITLE[g.kind] || g.kind)} ${g.env || ''}: ${runResult(r)} (${agoIso(r.startedAt)})${r.counts ? ', ' + countsText(r.counts) : ''}`);
        }
      }
      for (const w of (p.workstreams || []).filter(w => w.status === 'active')) lines.push(`  • ${w.name}${w.ownerId ? ' — ' + pname(w.ownerId) : ''}${w.next ? ': ' + w.next : ''}`);
      if (canSeeHistory()) {
        for (const b of bl) lines.push(`  BLOCKER: ${b.text}`);
        if (la) lines.push(`  last update ${la.date}: ${trunc(la.text, 160)}`);
      }
      lines.push('');
    }
    if (mentees().length) {
      lines.push('People', '');
      for (const m of mentees()) {
        const o = lastOneOnOne(m.id);
        const lr = (canSeeLearningOf(m.id) ? enrollmentsOf(m.id) : []).map(e => courseSummary(m.id, e.courseId)).filter(Boolean).map(cs => `${cs.course.name}: ${cs.pct}%${cs.current ? ', now on ' + cs.current.title : ''}`).join('; ');
        lines.push(`${m.name}${m.focus ? ' — ' + m.focus : ''}`);
        lines.push(`  projects: ${personProjects(m.id).map(pr => pr.name + ' (' + personRoleIn(pr, m.id) + ')').join(', ') || '—'}`);
        if (canSeeHistory()) lines.push(`  last 1:1: ${o ? o.date : 'never'}${lr ? '; learning: ' + lr : ''}`);
        else if (canSeeLearningOf(m.id)) lines.push(`  learning: ${lr || '—'}`);
        lines.push('');
      }
    }
    const att = attention();
    if (att.length) { lines.push('Needs attention', ''); att.forEach(a => lines.push(`- [${a.lvl}] ${a.text}`)); }
    return lines.join('\n');
  }
  async function showSummary() {
    const text = statusSummary();
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Status summary"><header><h2>Status summary</h2><button class="btn ghost" data-x aria-label="Close">✕</button></header>
      <div class="body"><textarea style="min-height:60vh;font-family:var(--mono);font-size:.82rem;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg)"></textarea><div class="hint">Plain text, ready to paste into a report or a message.</div></div>
      <footer><button class="btn" data-x>Close</button><button class="btn primary" data-copy>Copy</button></footer></div>`;
    document.body.appendChild(bg);
    const ta = $('textarea', bg); ta.value = text;
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    $$('[data-x]', bg).forEach(b => b.addEventListener('click', close));
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    $('[data-copy]', bg).addEventListener('click', async () => { try { await navigator.clipboard.writeText(ta.value); toast('Copied'); } catch { ta.select(); toast('Select and copy manually'); } });
  }

  // ---------- nav + router
  const NAV = [['dashboard', 'Dashboard', '⌂', 'Home'], ['projects', 'Projects', '▤'], ['people', 'People', '☺'], ['learning', 'Learning', '✎'], ['stats', 'Team stats', '∑', 'Stats'], ['activity', 'Activity', '≡'], ['ci', 'CI', '▶'], ['data', 'Data', '⚙']];
  const LEAD_ONLY = new Set(['activity', 'stats']);
  const navHref = k => k === 'dashboard' ? '#/' : k === 'learning' && !canSeeHistory() && signedInAs() ? `#/people/${signedInAs()}/learning` : `#/${k}`;
  function navKey() {
    const r = S.route;
    if (LEAD_ONLY.has(r.name) && !canSeeHistory()) return 'dashboard';
    if (!canSeeHistory() && r.name === 'people' && r.tab === 'learning' && r.id === signedInAs()) return 'learning';
    return r.name;
  }
  function renderNav() {
    $('#nav').innerHTML = `<div class="brand">Team Tracker<small>${esc(settings().teamName || '')}</small></div>` +
      NAV.filter(([k]) => !LEAD_ONLY.has(k) || canSeeHistory()).map(([k, l, i, short]) => `<a class="item ${navKey() === k ? 'active' : ''}" href="${esc(navHref(k))}" aria-label="${esc(l)}"><span class="ico" aria-hidden="true">${i}</span><span class="lbl" aria-hidden="true">${l}</span><span class="lbl-m" aria-hidden="true">${short || l}</span>${k === 'ci' && allLive().length ? ' <span class="live-dot"></span>' : ''}</a>`).join('') +
      `<div class="spacer"></div><div class="status"><a href="#" data-act="who" title="who is at this browser">You: ${esc(viewerName())}</a></div>` +
      `<div class="status"><span class="dot ${S.backend === 'static' ? '' : 'on'}"></span>${S.backend === 'server' ? 'saving to data/' : S.backend === 'github' ? `GitHub · ${esc(ghConfig().owner)}/${esc(ghConfig().repo)}` : 'browser-only mode'}</div>`;
  }
  function renderFab() {
    let fab = $('#fab');
    if (!canSeeHistory()) { if (fab) fab.remove(); return; }
    if (fab) return;
    fab = document.createElement('button');
    Object.assign(fab, { type: 'button', id: 'fab', className: 'fab', title: 'Log activity', textContent: '+' });
    fab.setAttribute('aria-label', 'Log activity');
    fab.addEventListener('click', () => editActivity(null, {}));
    document.body.insertBefore(fab, $('#toast'));
  }
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    let id = parts[1] || null;
    try { if (id) id = decodeURIComponent(id); } catch { /* keep the raw id; the view reports not found */ }
    S.route = { name: parts[0] || 'dashboard', id, tab: parts[2] || null };
  }
  let prevRoute = '';
  function render() {
    parseRoute(); syncWaits(); renderNav(); renderFab();
    const v = $('#view'); const r = S.route;
    const key = `${r.name}/${r.id || ''}/${r.tab || ''}`; const sameView = key === prevRoute; prevRoute = key;
    const y = window.scrollY; const mw = $('.matrix-wrap', v); const mx = mw ? [mw.scrollLeft, mw.scrollTop] : null;
    const openPhases = new Set($$('details[data-phase][open]', v).map(d => d.dataset.phase));
    const ae = document.activeElement, caret = ae && ae.dataset && ae.dataset.cf === 'q' ? [ae.selectionStart, ae.selectionEnd] : null;
    const views = {
      dashboard: () => vDashboard(), projects: () => r.id ? vProject(r.id) : vProjects(), people: () => r.id ? vPerson(r.id) : vPeople(),
      learning: () => vLearning(r.id), activity: () => canSeeHistory() ? vActivity() : vDashboard(), stats: () => canSeeHistory() ? vStats() : vDashboard(), ci: () => vCI(), data: () => vData(),
    };
    const notice = S.backend === 'static' && r.name !== 'data' ? '<div class="banner">Not connected: edits stay in this browser only. <a href="#/data">Connect to GitHub</a> or run <span class="mono">python serve.py</span>.</div>' : S.ghError && r.name !== 'data' ? `<div class="banner">GitHub could not be read: ${esc(S.ghError)}. <a href="#/data">Check the connection</a>.</div>` : '';
    v.innerHTML = notice + (views[r.name] || views.dashboard)();
    bind(v);
    if (r.name === 'ci' || (r.name === 'projects' && r.tab === 'ci')) startCiAuto(); else stopCiAuto();
    if (r.name === 'projects' && r.id) wantCatalog(r.id);
    if (sameView) {
      openPhases.forEach(k => { const d = $$('details[data-phase]', v).find(x => x.dataset.phase === k); if (d) d.open = true; });
      const q = caret && $('[data-cf="q"]', v); if (q) { q.focus(); q.setSelectionRange(caret[0], caret[1]); }
      window.scrollTo(0, y);
      const nm = $('.matrix-wrap', v); if (nm && mx) { nm.scrollLeft = mx[0]; nm.scrollTop = mx[1]; }
    } else window.scrollTo(0, 0);
  }

  function bind(v) {
    $$('[data-href]', v).forEach(el => el.addEventListener('click', e => { if (e.target.closest('a,button:not([data-href])')) return; location.hash = el.dataset.href; }));
    $$('[data-filter]', v).forEach(el => el.addEventListener('change', () => { S.filter = { ...(S.filter || {}), [el.dataset.filter]: el.value }; render(); }));
    $$('[data-af]', v).forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { S.actFilter = { ...(S.actFilter || { person: '', project: '', type: '', range: '30', q: '' }), [el.dataset.af]: el.value }; if (el.type === 'search') { const pos = el.selectionStart; render(); const n = $('[data-af="q"]'); n.focus(); n.setSelectionRange(pos, pos); } else render(); }));
    $$('.lesson-status', v).forEach(el => el.addEventListener('change', async () => { await setLesson(el.dataset.person, el.dataset.lesson, el.value); render(); }));
    $$('[data-cf]', v).forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => { catFilterOf(el.dataset.project)[el.dataset.cf] = el.value; paintCatalog(el.dataset.project); }));
    $$('td.cell', v).forEach(td => {
      const d = td.dataset; let pressTimer = null; let longPressed = false;
      td.addEventListener('click', e => {
        if (longPressed) { longPressed = false; return; }
        if (e.shiftKey || e.ctrlKey || e.metaKey) editLesson(d.person, d.lesson, d.title); else cycleLesson(d.person, d.lesson, d.title);
      });
      td.addEventListener('contextmenu', e => { e.preventDefault(); editLesson(d.person, d.lesson, d.title); });
      td.addEventListener('touchstart', () => { pressTimer = setTimeout(() => { longPressed = true; editLesson(d.person, d.lesson, d.title); }, 550); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(ev => td.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true }));
    });
    $$('[data-theme-set]', v).forEach(b => b.addEventListener('click', () => { const t = b.dataset.themeSet; localStorage.setItem(LS + 'theme', t); applyTheme(); render(); }));
    const imp = $('input[data-act="import"]', v); if (imp) imp.addEventListener('change', importFile);
    bindChart(v);
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
    const d = b.dataset;
    switch (d.act) {
      case 'log-act': return editActivity(null, { projectId: d.project || '', personId: d.person || '' });
      case 'log-11': return editActivity(null, { type: 'one-on-one', personId: d.person || '' });
      case 'log-blocker': return editActivity(null, { type: 'blocker', projectId: d.project || '', personId: d.person || '' });
      case 'edit-act': return editActivity(d.id);
      case 'del-act': return deleteActivity(d.id);
      case 'resolve': return toggleResolved(d.id);
      case 'new-project': return editProject(null);
      case 'edit-project': return editProject(d.id);
      case 'del-project': return deleteProject(d.id);
      case 'new-ws': return editWorkstream(d.project, null);
      case 'edit-ws': return editWorkstream(d.project, d.id);
      case 'del-ws': return deleteWorkstream(d.project, d.id);
      case 'sugg-accept': return settleSuggestion(d.project, d.field, true);
      case 'sugg-dismiss': return settleSuggestion(d.project, d.field, false);
      case 'new-person': return editPerson(null);
      case 'edit-person': return editPerson(d.id);
      case 'del-person': return deletePerson(d.id);
      case 'enroll': return enroll(d.person);
      case 'enroll-any': {
        if (!canSeeHistory()) return;
        const who = peopleOpts().filter(o => canSeeLearningOf(o.value));
        if (!who.length) { toast(learningLock(), 5000); return; }
        const v = await form('Enroll someone', [{ key: 'personId', label: 'Person', type: 'select', options: who }]);
        if (v && v.personId) return enroll(v.personId, { courseId: d.course }); return;
      }
      case 'edit-enroll': { if (!canSeeHistory() || !canSeeLearningOf(d.person)) return; const e = learning().enrollments.find(x => x.personId === d.person && x.courseId === d.course); return enroll(d.person, e || { courseId: d.course }); }
      case 'unenroll': return unenroll(d.person, d.course);
      case 'edit-lesson': return editLesson(d.person, d.lesson, d.title);
      case 'settings': return editSettings();
      case 'summary': return showSummary();
      case 'ask': return postMessage(d.person, true);
      case 'note': return postMessage(d.person, false);
      case 'answer-msg': return toggleAnswered(d.id);
      case 'del-msg': return deleteMessage(d.id);
      case 'who': return chooseViewer();
      case 'run-ci': return runCI(d.project, d.group);
      case 'report': return openReportFor(d.project, d.run || '', d.idx);
      case 'wait-dismiss': return dismissWait(d.id);
      case 'cat-clear': { S.catFilter[d.project] = { q: '', kind: '', area: '' }; render(); const q = $('[data-cf="q"]'); if (q) q.focus(); return; }
      case 'refresh-ci': return refreshCI(b);
      case 'gh-connect': return connectGitHub();
      case 'gh-disconnect': return disconnectGitHub();
      case 'export': return exportAll();
      case 'clear-local': { if (confirm('Discard all browser-only edits and reload the data files?')) { COLLECTIONS.forEach(c => localStorage.removeItem(LS + c)); location.reload(); } return; }
    }
  });

  // What the page does not show someone stays out of their export too.
  const LEARNING_FIELDS = ['track', 'weeklyLearningHours'];
  const visiblePeople = () => canSeeHistory() ? people() : people().map(p => canSeeLearningOf(p.id) ? p : Object.fromEntries(Object.entries(p).filter(([k]) => !LEARNING_FIELDS.includes(k))));
  const visibleCurriculum = () => ({ ...S.data.curriculum, courses: courses() });
  // Pending suggestions, and the answers dismissed kept with the marks, go to whoever may settle them.
  const visibleProjects = () => projects().map(p => {
    if (canSeeHistory() || (!p.suggested && !p.edited)) return p;
    const { suggested, edited, ...rest } = p, keep = pendingOf(p);
    const s = Object.fromEntries(Object.entries(suggested || {}).filter(([k]) => keep.includes(k)));
    const e = edited && Object.fromEntries(Object.entries(edited).map(([k, m]) => [k, canEditProject(p) || !m || typeof m !== 'object' ? m : (({ dismissed, ...x }) => x)(m)]));
    return { ...rest, ...(e ? { edited: e } : {}), ...(Object.keys(s).length ? { suggested: s } : {}) };
  });
  function exportAll() {
    const view = { learning: visibleLearning, messages: visibleMessages, people: visiblePeople, curriculum: visibleCurriculum, projects: visibleProjects };
    const blob = new Blob([JSON.stringify(Object.fromEntries(COLLECTIONS.filter(c => !PRIVATE.has(c) || canSeeHistory()).map(c => [c, view[c] ? view[c]() : S.data[c]])), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `team-tracker-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  // A collection someone sees only part of, or that decides who they are, is replaced by the lead only.
  // The CI snapshot is the collector's alone and is never imported.
  const LEAD_IMPORT = new Set(['settings', 'people', 'projects', 'curriculum', 'learning', 'messages', ...PRIVATE]);
  async function importFile(e) {
    const f = e.target.files[0]; if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { return toast('Could not read that file'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return toast('Not a tracker export');
    const valid = COLLECTIONS.filter(c => c in obj && (Array.isArray(DEFAULTS[c]()) ? Array.isArray(obj[c]) : obj[c] && typeof obj[c] === 'object' && !Array.isArray(obj[c])));
    const keys = valid.filter(c => c !== 'ci' && (!LEAD_IMPORT.has(c) || canSeeHistory()));
    const leadOnly = valid.filter(c => c !== 'ci' && !keys.includes(c));
    const why = [leadOnly.length ? `Only the lead can import ${leadOnly.join(', ')}.` : '', valid.includes('ci') ? 'ci is written by the CI collector only.' : ''].filter(Boolean).join(' ');
    if (!keys.length) return toast(why || 'No valid collections in that file', 4000);
    if (!confirm(`Replace ${keys.join(', ')} with the file contents?${why ? `\n\nSkipped: ${why}` : ''}`)) return;
    for (const c of keys) { S.data[c] = normalize(c, obj[c]); await save(c); }
    render();
  }

  function applyTheme() {
    const t = localStorage.getItem(LS + 'theme') || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }

  window.addEventListener('hashchange', render);
  let lastWidth = window.innerWidth, resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (window.innerWidth === lastWidth) return; lastWidth = window.innerWidth; if (S.route.name === 'stats') render(); }, 250);
  });
  applyTheme();
  load().then(() => { render(); autoRefreshIfStale(); });
})();
