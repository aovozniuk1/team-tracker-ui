(() => {
  'use strict';

  const COLLECTIONS = ['settings', 'people', 'projects', 'activities', 'curriculum', 'learning'];
  const LS = 'team-tracker:';
  const S = { data: {}, server: false, dataDir: '', localOverride: false, route: { name: 'dashboard', id: null, tab: null } };

  const DEFAULTS = {
    settings: () => ({ teamName: 'Team', leadName: '', oneOnOneCadenceDays: 7, staleProjectDays: 7, staleLearningDays: 14 }),
    people: () => [],
    projects: () => [],
    activities: () => [],
    curriculum: () => ({ courses: [] }),
    learning: () => ({ enrollments: [], progress: {} }),
  };

  const STATUS = ['active', 'paused', 'parked', 'done'];
  const HEALTH = ['green', 'yellow', 'red', 'unknown'];
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

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- persistence
  function normalize(c, obj) {
    const d = DEFAULTS[c]();
    if (Array.isArray(d)) return Array.isArray(obj) ? obj : d;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return d;
    if (c === 'learning') { obj.enrollments = Array.isArray(obj.enrollments) ? obj.enrollments : []; obj.progress = obj.progress && typeof obj.progress === 'object' && !Array.isArray(obj.progress) ? obj.progress : {}; }
    if (c === 'curriculum') obj.courses = Array.isArray(obj.courses) ? obj.courses : [];
    return obj;
  }

  // ---------- GitHub backend: data/*.json in a (private) repo, read and written with the viewer's own token
  const GH_DEFAULT = { owner: 'aovozniuk1', repo: 'team-tracker', branch: 'main', token: '' };
  function ghConfig() { try { return { ...GH_DEFAULT, ...JSON.parse(localStorage.getItem(LS + 'gh') || '{}') }; } catch { return { ...GH_DEFAULT }; } }
  function ghStore(cfg) { try { localStorage.setItem(LS + 'gh', JSON.stringify(cfg)); } catch { toast('Could not store the connection in this browser'); } }
  const ghReady = () => { const g = ghConfig(); return !!(g.token && g.owner && g.repo && g.branch); };
  const ghUrl = c => { const g = ghConfig(); return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/data/${c}.json`; };
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
    return JSON.parse(b64decode(j.content));
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
    const g = ghConfig();
    const v = await form('Connect to GitHub', [
      { key: 'owner', label: 'Repository owner', required: true },
      { key: 'repo', label: 'Repository', required: true, help: 'the private repo that holds data/*.json' },
      { key: 'branch', label: 'Branch', required: true },
      { key: 'token', label: 'Fine-grained personal access token', type: 'password', required: true, help: 'Contents: read and write, on that one repository. Stored in this browser only; never sent anywhere but api.github.com.' },
    ], { ...g, token: '' });
    if (!v) return;
    ghStore(v); location.reload();
  }
  function disconnectGitHub() {
    if (!confirm('Forget the GitHub token in this browser?')) return;
    ghStore({ ...ghConfig(), token: '' }); location.reload();
  }

  async function fetchCollection(c) {
    if (S.backend === 'github') return ghGet(c);
    const r = await fetch(S.server ? `/api/${c}` : `data/${c}.json`, { cache: 'no-store' });
    if (r.ok) { const obj = await r.json(); S.etags[c] = r.headers.get('ETag') || ''; S.broken.delete(c); return obj; }
    if (S.server && r.status !== 404) S.broken.add(c);
    return null;
  }

  async function load() {
    S.broken = new Set(); S.etags = {}; S.ghError = '';
    try {
      const r = await fetch('/api/_meta', { cache: 'no-store' });
      if (r.ok) { const m = await r.json(); S.server = !!m.server; S.dataDir = m.dataDir || ''; }
    } catch { S.server = false; }
    S.backend = S.server ? 'server' : ghReady() ? 'github' : 'static';
    for (const c of COLLECTIONS) {
      let obj = null;
      try { obj = await fetchCollection(c); } catch (e) { if (S.server) S.broken.add(c); if (S.backend === 'github') S.ghError = e.message; }
      if (S.backend === 'static') {
        try { const ls = localStorage.getItem(LS + c); if (ls) { obj = JSON.parse(ls); S.localOverride = true; } } catch { /* ignore */ }
      }
      S.data[c] = normalize(c, obj);
    }
  }

  async function save(c) {
    const obj = S.data[c];
    if (S.backend === 'github') {
      if (S.ghError) { toast('Not saved: GitHub could not be read (' + S.ghError + ')'); return false; }
      const res = await ghPut(c, obj);
      if (res.conflict) {
        try { S.data[c] = normalize(c, await ghGet(c)); } catch { /* keep */ }
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
          try { S.data[c] = normalize(c, await fetchCollection(c)); } catch { /* keep */ }
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

  // ---------- data access
  const settings = () => S.data.settings;
  const people = () => S.data.people;
  const projects = () => S.data.projects;
  const acts = () => S.data.activities;
  const courses = () => S.data.curriculum.courses;
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
  const progressOf = (pid, lid) => learning().progress[`${pid}|${lid}`] || { status: 'not-started' };
  const enrollmentsOf = pid => learning().enrollments.filter(e => e.personId === pid);

  function courseSummary(pid, courseId) {
    const c = course(courseId); if (!c) return null;
    const ls = lessonsOf(c);
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
      const la = projectActs(p.id)[0];
      const n = la ? daysSince(la.date) : null;
      if (n == null) out.push({ lvl: 'grey', text: `${p.name}: no activity logged yet`, href: `#/projects/${p.id}` });
      else if (n > (st.staleProjectDays || 7)) out.push({ lvl: 'yellow', text: `${p.name}: no update for ${n} days`, href: `#/projects/${p.id}` });
    }
    for (const b of openBlockers()) {
      out.push({ lvl: 'red', text: `Blocker${b.projectId ? ' on ' + (project(b.projectId)?.name || '') : ''}${b.personId ? ' (' + pname(b.personId) + ')' : ''}: ${trunc(b.text, 120)}`, href: b.projectId ? `#/projects/${b.projectId}` : '#/activity' });
    }
    for (const m of mentees()) {
      const o = lastOneOnOne(m.id);
      if (!o) out.push({ lvl: 'grey', text: `${m.name}: no 1:1 logged yet`, href: `#/people/${m.id}` });
      else if (daysSince(o.date) > (st.oneOnOneCadenceDays || 7)) out.push({ lvl: 'yellow', text: `${m.name}: last 1:1 ${ago(o.date)}`, href: `#/people/${m.id}` });
      for (const e of enrollmentsOf(m.id)) {
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
          if (f.type === 'multiselect') out[f.key] = $$(`input[name="${f.key}"]:checked`, fm).map(i => i.value);
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
    const p = id ? project(id) : { id: '', status: 'active', health: 'unknown', memberIds: [], workstreams: [] };
    const v = await form(id ? `Edit project — ${p.name}` : 'New project', [
      { key: 'name', label: 'Name', required: true },
      { key: 'code', label: 'Short code', help: 'e.g. ALPHA, REPIPE' },
      { key: 'client', label: 'Client / product owner' },
      { key: 'status', label: 'Status', type: 'select', options: opt(STATUS) },
      { key: 'health', label: 'Health', type: 'select', options: opt(HEALTH) },
      { key: 'healthReason', label: 'Health reason', help: 'One line: why green / yellow / red right now' },
      { key: 'leadId', label: 'Lead (your mentee who runs it)', type: 'select', options: peopleOpts([p.leadId]), allowEmpty: true, emptyLabel: 'Unassigned' },
      { key: 'memberIds', label: 'Other members', type: 'multiselect', options: peopleOpts(p.memberIds || []) },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'startedOn', label: 'Started on', type: 'date' },
      { key: 'milestoneText', label: 'Next milestone' },
      { key: 'milestoneDue', label: 'Milestone due', type: 'date' },
      { key: 'stackText', label: 'Stack', help: 'comma-separated' },
      { key: 'aliasesText', label: 'Aliases', help: 'comma-separated, other names people use' },
      { key: 'repos', label: 'Repositories', type: 'records', cols: ['name', 'url', 'branch', 'localPath'], help: 'one per line: name | url | branch | local path' },
      { key: 'environments', label: 'Environments', type: 'records', cols: ['name', 'url', 'notes'], help: 'one per line: name | url | notes' },
      { key: 'systems', label: 'Systems involved', type: 'records', cols: ['name', 'url', 'role'], help: 'one per line: name | url | role' },
      { key: 'localDocs', label: 'Local docs', type: 'records', cols: ['path', 'what'], help: 'one per line: path | what it is' },
      { key: 'keyFacts', label: 'Key facts', type: 'lines', rows: 5, help: 'one per line' },
      { key: 'risks', label: 'Risks', type: 'lines', help: 'one per line' },
      { key: 'openQuestions', label: 'Open questions', type: 'lines', help: 'one per line' },
      { key: 'nextSteps', label: 'Next steps', type: 'lines', help: 'one per line' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ], {
      ...p,
      milestoneText: p.nextMilestone?.text || '', milestoneDue: p.nextMilestone?.due || '',
      stackText: (p.stack || []).join(', '), aliasesText: (p.aliases || []).join(', '),
    });
    if (!v) return;
    const np = {
      ...p,
      id: p.id || slug(v.name),
      name: v.name, code: v.code, client: v.client, status: v.status, health: v.health, healthReason: v.healthReason,
      leadId: v.leadId || '', memberIds: v.memberIds, summary: v.summary, startedOn: v.startedOn,
      nextMilestone: { text: v.milestoneText, due: v.milestoneDue },
      stack: v.stackText.split(',').map(s => s.trim()).filter(Boolean),
      aliases: v.aliasesText.split(',').map(s => s.trim()).filter(Boolean),
      repos: v.repos, environments: v.environments, systems: v.systems, localDocs: v.localDocs,
      keyFacts: v.keyFacts, risks: v.risks, openQuestions: v.openQuestions, nextSteps: v.nextSteps, notes: v.notes,
      updatedOn: today(),
    };
    if (id) projects().splice(projects().findIndex(x => x.id === id), 1, np); else projects().push(np);
    await save('projects');
    location.hash = `#/projects/${np.id}`; render();
  }

  function slug(s) {
    const base = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('p');
    let id = base, n = 2; while (project(id) || person(id)) id = `${base}-${n++}`; return id;
  }

  async function deleteProject(id) {
    const p = project(id); if (!p) return;
    if (!confirm(`Delete project "${p.name}"? Its activity log entries stay.`)) return;
    projects().splice(projects().indexOf(p), 1); await save('projects');
    location.hash = '#/projects'; render();
  }

  async function editWorkstream(prId, wsId) {
    const p = project(prId); const w = wsId ? p.workstreams.find(x => x.id === wsId) : { id: '', status: 'active' };
    const v = await form(wsId ? `Edit workstream — ${w.name}` : `New workstream in ${p.name}`, [
      { key: 'name', label: 'Name', required: true },
      { key: 'status', label: 'Status', type: 'select', options: opt(STATUS.concat('unknown')) },
      { key: 'ownerId', label: 'Owner', type: 'select', options: peopleOpts([w.ownerId]), allowEmpty: true, emptyLabel: 'Unassigned' },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'next', label: 'Next step' },
    ], w);
    if (!v) return;
    const nw = { ...w, ...v, id: w.id || uid('ws') };
    p.workstreams ||= [];
    if (wsId) p.workstreams.splice(p.workstreams.indexOf(w), 1, nw); else p.workstreams.push(nw);
    p.updatedOn = today(); await save('projects'); render();
  }
  async function deleteWorkstream(prId, wsId) {
    const p = project(prId); const w = p.workstreams.find(x => x.id === wsId);
    if (!w || !confirm(`Remove workstream "${w.name}"?`)) return;
    p.workstreams.splice(p.workstreams.indexOf(w), 1); await save('projects'); render();
  }

  async function editPerson(id) {
    const p = id ? person(id) : { id: '', role: 'mentee', active: true, track: 'basic' };
    const v = await form(id ? `Edit — ${p.name}` : 'Add person', [
      { key: 'name', label: 'Name', required: true },
      { key: 'role', label: 'Role', type: 'select', options: opt(ROLES) },
      { key: 'title', label: 'Title', help: 'e.g. Manual QA, moving to automation' },
      { key: 'track', label: 'Learning track', type: 'select', options: opt(TRACKS), allowEmpty: true, emptyLabel: 'not set' },
      { key: 'startedOn', label: 'Started with you on', type: 'date' },
      { key: 'weeklyLearningHours', label: 'Learning hours per week', type: 'number', step: '0.5' },
      { key: 'oneOnOneSlot', label: '1:1 slot', help: 'e.g. Tue 15:00' },
      { key: 'focus', label: 'Current focus', help: 'What they are on right now, one line. Shows on the dashboard.' },
      { key: 'active', label: 'Active', type: 'checkbox', text: 'Currently on the team' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ], { active: true, ...p });
    if (!v) return;
    const np = { ...p, ...v, id: p.id || slug(v.name), updatedOn: today() };
    if (id) people().splice(people().indexOf(p), 1, np); else people().push(np);
    await save('people'); location.hash = `#/people/${np.id}`; render();
  }
  async function deletePerson(id) {
    const p = person(id); if (!p || !confirm(`Remove ${p.name}? Their learning progress and activity stay in the data files.`)) return;
    people().splice(people().indexOf(p), 1); await save('people'); location.hash = '#/people'; render();
  }

  async function editActivity(id, preset = {}) {
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

  async function enroll(pid, preset = {}) {
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
    if (!confirm(`Remove ${pname(pid)} from ${course(courseId)?.name}? Lesson marks are kept.`)) return;
    learning().enrollments = learning().enrollments.filter(e => !(e.personId === pid && e.courseId === courseId));
    await save('learning'); render();
  }
  async function setLesson(pid, lid, status, note) {
    const key = `${pid}|${lid}`;
    if (status === 'not-started' && !note) delete learning().progress[key];
    else learning().progress[key] = { status, date: today(), note: note || '' };
    await save('learning');
  }
  async function cycleLesson(pid, lid, title) {
    const cur = progressOf(pid, lid).status;
    const next = LESSON_STATUS[(LESSON_STATUS.indexOf(cur) + 1) % LESSON_STATUS.length];
    await setLesson(pid, lid, next, progressOf(pid, lid).note);
    S.lastCell = { person: pname(pid), title: title || lid, status: next }; render();
  }
  async function editLesson(pid, lid, title) {
    const cur = progressOf(pid, lid);
    const v = await form(`${pname(pid)} — ${title}`, [
      { key: 'status', label: 'Status', type: 'select', options: opt(LESSON_STATUS) },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'note', label: 'Note', type: 'textarea', help: 'what was shown, where stuck, what to revisit' },
    ], { status: cur.status, date: cur.date || today(), note: cur.note || '' });
    if (!v) return;
    const key = `${pid}|${lid}`;
    if (v.status === 'not-started' && !v.note) delete learning().progress[key]; else learning().progress[key] = { status: v.status, date: v.date || today(), note: v.note };
    await save('learning'); render();
  }

  async function editSettings() {
    const v = await form('Settings', [
      { key: 'teamName', label: 'Team name' },
      { key: 'leadName', label: 'Your name' },
      { key: 'oneOnOneCadenceDays', label: '1:1 cadence (days)', type: 'number' },
      { key: 'staleProjectDays', label: 'Project counts as stale after (days)', type: 'number' },
      { key: 'staleLearningDays', label: 'Learning counts as stale after (days)', type: 'number' },
    ], settings());
    if (!v) return;
    Object.assign(settings(), v); await save('settings'); render();
  }

  // ---------- view helpers
  const pill = (cls, text) => `<span class="pill ${esc(cls)}">${esc(text ?? label(cls))}</span>`;
  const dot = h => `<span class="dot ${esc(h)}" title="${esc(h)}"></span>`;
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

  // ---------- views
  function vDashboard() {
    const st = settings(), att = attention();
    const act = projects().filter(p => p.status === 'active');
    const overdue11 = mentees().filter(m => { const o = lastOneOnOne(m.id); return !o || daysSince(o.date) > (st.oneOnOneCadenceDays || 7); });
    const pcts = mentees().flatMap(m => enrollmentsOf(m.id).map(e => courseSummary(m.id, e.courseId)?.pct ?? 0));
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    const reds = att.filter(a => a.lvl === 'red').length;
    const recent = acts().slice().sort(byDateDesc).slice(0, 12);
    const attRow = a => `<div class="row"><div class="lvl ${a.lvl}"></div><div class="body"><a href="${esc(a.href)}">${esc(a.text)}</a></div></div>`;
    return `<div class="page-head"><div><h1>${esc(st.teamName || 'Team')}</h1><div class="sub">${esc(today())} · ${act.length} active project${act.length === 1 ? '' : 's'} · ${mentees().length} mentee${mentees().length === 1 ? '' : 's'}</div></div>
      <div class="actions"><button class="btn" data-act="summary">Status summary</button><button class="btn" data-act="log-11">Log 1:1</button><button class="btn" data-act="log-blocker">Log blocker</button><button class="btn primary" data-act="log-act">Log activity</button></div></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${act.length}</div><div class="l">active projects</div></div>
        <div class="kpi ${reds ? 'bad' : 'good'}"><div class="v">${reds}</div><div class="l">red flags</div></div>
        <div class="kpi ${openBlockers().length ? 'bad' : 'good'}"><div class="v">${openBlockers().length}</div><div class="l">open blockers</div></div>
        <div class="kpi ${overdue11.length ? 'warn' : 'good'}"><div class="v">${overdue11.length}</div><div class="l">1:1s due</div></div>
        <div class="kpi"><div class="v">${avg == null ? '—' : avg + '%'}</div><div class="l">avg learning progress</div></div>
      </div>
      <div class="grid cols-2">
        <div class="section"><div class="section-head"><h2>Needs attention</h2><span class="hint">${att.length} item${att.length === 1 ? '' : 's'}</span></div>
          <div class="card attention">${att.length ? att.slice(0, 10).map(attRow).join('') + (att.length > 10 ? `<details class="more"><summary class="small">show ${att.length - 10} more</summary>${att.slice(10).map(attRow).join('')}</details>` : '') : '<div class="empty">All quiet. Nothing overdue, no blockers, no red health.</div>'}</div></div>
        <div class="section"><div class="section-head"><h2>Recent activity</h2><a href="#/activity" class="small">all →</a></div>
          <div class="card">${recent.length ? recent.map(a => actRow(a)).join('') : '<div class="empty">Nothing logged yet. Use “Log activity”.</div>'}</div></div>
      </div>
      <div class="section"><div class="section-head"><h2>Projects</h2><a href="#/projects" class="small">manage →</a></div>
        <div class="grid auto">${projects().filter(p => p.status !== 'done').map(projectCard).join('') || '<div class="empty">No projects yet.</div>'}</div></div>
      <div class="section"><div class="section-head"><h2>People — right now</h2><a href="#/people" class="small">manage →</a></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Focus</th><th>Projects</th><th>Last activity</th><th>Last 1:1</th><th>Learning</th></tr></thead><tbody>
        ${activePeople().sort((a, b) => (a.role === 'mentee' ? 0 : 1) - (b.role === 'mentee' ? 0 : 1)).map(p => {
          const la = personActs(p.id)[0], o = lastOneOnOne(p.id);
          const prs = personProjects(p.id).map(pr => `${prlink(pr.id)} <span class="muted small">(${esc(personRoleIn(pr, p.id))})</span>`).join('<br>') || '<span class="muted">—</span>';
          const lr = enrollmentsOf(p.id).map(e => courseSummary(p.id, e.courseId)).filter(Boolean).map(cs => `<div class="small"><b>${cs.pct}%</b> ${esc(cs.course.name)}${cs.current ? ` · <span class="muted">now: ${esc(cs.current.title)}</span>` : ' · <span class="muted">complete</span>'}</div>${progressBar(cs)}`).join('') || '<span class="muted">—</span>';
          return `<tr><td>${plink(p.id)}<div class="muted small">${esc(p.title || label(p.role))}</div></td><td>${esc(p.focus || '—')}</td><td>${prs}</td><td>${la ? `<div class="small">${esc(trunc(la.text, 80))}</div><span class="muted small">${esc(ago(la.date))}</span>` : '<span class="muted">—</span>'}</td><td>${o ? `<span title="${esc(o.date)}">${esc(ago(o.date))}</span>` : '<span class="muted">never</span>'}</td><td style="min-width:180px">${lr}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="empty">No people yet — add your mentees in People.</td></tr>'}
        </tbody></table></div></div>`;
  }

  function projectCard(p) {
    const la = projectActs(p.id)[0];
    const bl = openBlockers().filter(b => b.projectId === p.id).length;
    const ms = p.nextMilestone?.text ? `<div class="small"><span class="muted">Next:</span> ${esc(p.nextMilestone.text)}${p.nextMilestone.due ? ` <span class="${p.nextMilestone.due < today() ? 'pill red' : 'muted'}">${esc(p.nextMilestone.due)}</span>` : ''}</div>` : '';
    const wsA = (p.workstreams || []).filter(w => w.status === 'active').length;
    return `<div class="card clickable" data-href="#/projects/${esc(p.id)}"><h3>${dot(p.health)} <a href="#/projects/${esc(p.id)}">${esc(p.name)}</a> ${pill(p.status)}</h3>
      <div class="meta">Lead: ${p.leadId ? esc(pname(p.leadId)) : '<i>unassigned</i>'}${p.code ? ` · ${esc(p.code)}` : ''}${wsA ? ` · ${wsA} active workstream${wsA === 1 ? '' : 's'}` : ''}${bl ? ` · <span class="pill blocker">${bl} blocker${bl === 1 ? '' : 's'}</span>` : ''}</div>
      <p class="small" style="margin-top:6px">${esc(trunc(p.healthReason || p.summary, 140))}</p>${ms}
      <div class="muted small">${la ? `${esc(trunc(la.text, 90))} — ${esc(ago(la.date))}` : 'no activity logged'}</div></div>`;
  }

  function vProjects() {
    const f = S.filter?.status || '';
    const list = projects().filter(p => !f || p.status === f);
    return `<div class="page-head"><div><h1>Projects</h1><div class="sub">${projects().length} total</div></div><div class="actions"><button class="btn primary" data-act="new-project">New project</button></div></div>
      <div class="filters"><select data-filter="status"><option value="">all statuses</option>${STATUS.map(s => `<option value="${s}"${f === s ? ' selected' : ''}>${label(s)}</option>`).join('')}</select></div>
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Status</th><th>Health</th><th>Lead</th><th>Team</th><th>Next milestone</th><th>Last activity</th></tr></thead><tbody>
      ${list.map(p => { const la = projectActs(p.id)[0]; return `<tr><td>${prlink(p.id)}<div class="muted small">${esc(p.code || '')}${p.client ? ' · ' + esc(p.client) : ''}</div></td><td>${pill(p.status)}</td><td>${dot(p.health)} <span class="small">${esc(trunc(p.healthReason, 60))}</span></td><td>${p.leadId ? plink(p.leadId) : '<span class="muted">—</span>'}</td><td class="small">${(p.memberIds || []).map(pname).map(esc).join(', ') || '<span class="muted">—</span>'}</td><td class="small">${p.nextMilestone?.text ? esc(p.nextMilestone.text) + (p.nextMilestone.due ? ` <span class="${p.nextMilestone.due < today() ? 'pill red' : 'muted'}">${esc(p.nextMilestone.due)}</span>` : '') : '<span class="muted">—</span>'}</td><td class="small">${la ? esc(ago(la.date)) : '<span class="muted">—</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No projects match.</td></tr>'}
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
      ['Environments', (p.environments || []).map(e => `${link(e.url, e.name)}${e.notes ? ` <span class="muted small">— ${esc(e.notes)}</span>` : ''}`).join('<br>')],
      ['Systems', (p.systems || []).map(s => `${link(s.url, s.name)}${s.role ? ` <span class="muted small">— ${esc(s.role)}</span>` : ''}`).join('<br>')],
      ['Local docs', (p.localDocs || []).map(d => `<span class="mono small">${esc(d.path)}</span> <span class="muted small">— ${esc(d.what)}</span>`).join('<br>')],
      ['Updated', esc(p.updatedOn)],
    ].filter(([, v]) => v);
    return `<div class="page-head"><div><h1>${dot(p.health)} ${esc(p.name)} ${pill(p.status)}</h1><div class="sub">${esc(p.code || '')}${p.healthReason ? ' · ' + esc(p.healthReason) : ''}</div></div>
      <div class="actions"><button class="btn" data-act="log-act" data-project="${esc(id)}">Log update</button><button class="btn" data-act="log-blocker" data-project="${esc(id)}">Log blocker</button><button class="btn primary" data-act="edit-project" data-id="${esc(id)}">Edit</button><button class="btn danger ghost" data-act="del-project" data-id="${esc(id)}">Delete</button></div></div>
      ${p.nextMilestone?.text ? `<div class="banner"><b>Next milestone:</b> ${esc(p.nextMilestone.text)}${p.nextMilestone.due ? ` — due ${esc(p.nextMilestone.due)} (${esc(ago(p.nextMilestone.due))})` : ''}</div>` : ''}
      <div class="grid cols-2">
        <div class="card"><h3>Overview</h3><p>${esc(p.summary || '')}</p><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${p.notes ? `<h3 style="margin-top:12px">Notes</h3><p class="small" style="white-space:pre-wrap">${esc(p.notes)}</p>` : ''}</div>
        <div>
          <div class="card" style="margin-bottom:14px"><h3>Key facts</h3>${listOr(p.keyFacts, 'none recorded')}</div>
          <div class="card" style="margin-bottom:14px"><h3>Risks</h3>${listOr(p.risks, 'none recorded')}</div>
          <div class="card" style="margin-bottom:14px"><h3>Open questions</h3>${listOr(p.openQuestions, 'none')}</div>
          <div class="card"><h3>Next steps</h3>${listOr(p.nextSteps, 'none')}</div>
        </div>
      </div>
      <div class="section" style="margin-top:14px"><div class="section-head"><h2>Workstreams</h2><button class="btn sm" data-act="new-ws" data-project="${esc(id)}">Add workstream</button></div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Workstream</th><th>Status</th><th>Owner</th><th>Summary</th><th>Next</th><th></th></tr></thead><tbody>
        ${(p.workstreams || []).map(w => `<tr><td><b>${esc(w.name)}</b></td><td>${pill(w.status)}</td><td>${w.ownerId ? plink(w.ownerId) : '<span class="muted">—</span>'}</td><td class="small">${esc(w.summary || '')}</td><td class="small">${esc(w.next || '')}</td><td class="nowrap"><button class="btn sm" data-act="edit-ws" data-project="${esc(id)}" data-id="${esc(w.id)}">✎</button> <button class="btn sm" data-act="del-ws" data-project="${esc(id)}" data-id="${esc(w.id)}">🗑</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No workstreams yet.</td></tr>'}
        </tbody></table></div></div>
      <div class="section"><div class="section-head"><h2>Activity${bl.length ? ` · <span class="pill blocker">${bl.length} open blocker${bl.length === 1 ? '' : 's'}</span>` : ''}</h2></div>
        <div class="card">${pa.length ? pa.map(a => actRow(a, { showProject: false })).join('') : '<div class="empty">Nothing logged for this project yet.</div>'}</div></div>`;
  }

  function vPeople() {
    return `<div class="page-head"><div><h1>People</h1><div class="sub">${mentees().length} mentee${mentees().length === 1 ? '' : 's'} · ${people().length} total</div></div><div class="actions"><button class="btn primary" data-act="new-person">Add person</button></div></div>
      <div class="grid auto">${people().slice().sort((a, b) => (a.active === false) - (b.active === false) || (a.role === 'mentee' ? 0 : 1) - (b.role === 'mentee' ? 0 : 1)).map(p => {
        const o = lastOneOnOne(p.id), prs = personProjects(p.id);
        const lr = enrollmentsOf(p.id).map(e => courseSummary(p.id, e.courseId)).filter(Boolean);
        return `<div class="card clickable" data-href="#/people/${esc(p.id)}"><h3><a href="#/people/${esc(p.id)}">${esc(p.name)}</a> ${p.active === false ? pill('grey', 'inactive') : ''}${p.role !== 'mentee' ? pill('accent', label(p.role)) : ''}${p.track ? pill('purple', p.track) : ''}</h3>
          <div class="meta">${esc(p.title || '')}${p.startedOn ? ` · since ${esc(p.startedOn)}` : ''}</div>
          ${p.focus ? `<p class="small" style="margin-top:6px"><span class="muted">Focus:</span> ${esc(p.focus)}</p>` : ''}
          <div class="small"><span class="muted">Projects:</span> ${prs.map(x => esc(x.name)).join(', ') || '—'}</div>
          <div class="small"><span class="muted">Last 1:1:</span> ${o ? esc(ago(o.date)) : 'never'}</div>
          ${lr.map(cs => `<div class="small" style="margin-top:6px"><b>${cs.pct}%</b> ${esc(cs.course.name)}${cs.current ? ` · <span class="muted">${esc(cs.current.title)}</span>` : ''}</div>${progressBar(cs)}`).join('')}
        </div>`;
      }).join('') || '<div class="empty">No people yet.</div>'}</div>`;
  }

  function vPerson(id) {
    const p = person(id); if (!p) return `<div class="empty">Person not found. <a href="#/people">Back</a></div>`;
    const pa = personActs(id), ones = pa.filter(a => a.type === 'one-on-one'), others = pa.filter(a => a.type !== 'one-on-one');
    const prs = personProjects(id);
    const enr = enrollmentsOf(id);
    const kv = [['Role', label(p.role)], ['Title', p.title], ['Track', p.track && label(p.track)], ['Started', p.startedOn], ['Learning h/week', p.weeklyLearningHours], ['1:1 slot', p.oneOnOneSlot], ['Focus', p.focus]].filter(([, v]) => v !== undefined && v !== null && v !== '');
    const learnBlocks = enr.map(e => {
      const cs = courseSummary(id, e.courseId); if (!cs) return '';
      const c = cs.course;
      return `<div class="card" style="margin-bottom:14px"><div class="section-head"><h3>${esc(c.name)} ${e.track ? pill('purple', e.track) : ''}</h3><div class="actions"><a class="btn sm" href="#/learning/${esc(c.id)}">matrix</a><button class="btn sm" data-act="edit-enroll" data-person="${esc(id)}" data-course="${esc(c.id)}">✎</button><button class="btn sm" data-act="unenroll" data-person="${esc(id)}" data-course="${esc(c.id)}">🗑</button></div></div>
        <div class="small muted">${e.startedOn ? `since ${esc(e.startedOn)} · ` : ''}${cs.complete}/${cs.total} lessons · ${cs.counts['gate-passed']} gates · last mark ${esc(ago(cs.lastDate))}${e.goal ? ` · goal: ${esc(e.goal)}` : ''}</div>
        <div style="margin:6px 0 10px">${progressBar(cs)}</div>
        ${cs.current ? `<div class="small" style="margin-bottom:8px"><span class="muted">Now on:</span> <b>${esc(cs.current.title)}</b> <span class="muted">(${esc(cs.current.phaseName)})</span></div>` : '<div class="small" style="margin-bottom:8px">Course complete.</div>'}
        ${(c.phases || []).map(ph => { const ls = ph.lessons || []; const done = ls.filter(l => ['done', 'gate-passed'].includes(progressOf(id, l.id).status)).length;
          return `<details data-phase="${esc(c.id + ':' + ph.id)}" ${ls.some(l => l.id === cs.current?.id) ? 'open' : ''}><summary class="small"><b>${esc(ph.name)}</b> <span class="muted">${done}/${ls.length}</span></summary>
            <div class="tbl-wrap"><table class="tbl small"><tbody>${ls.map(l => { const pr = progressOf(id, l.id); return `<tr><td class="lesson-name">${esc(l.title)}${l.gate ? `<div class="muted" style="font-size:.75rem">gate: ${esc(l.gate)}</div>` : ''}</td><td><select class="lesson-status" data-person="${esc(id)}" data-lesson="${esc(l.id)}">${LESSON_STATUS.map(s => `<option value="${s}"${pr.status === s ? ' selected' : ''}>${label(s)}</option>`).join('')}</select></td><td class="muted">${esc(pr.date || '')}</td><td class="muted">${esc(pr.note || '')}</td><td><button class="btn sm" data-act="edit-lesson" data-person="${esc(id)}" data-lesson="${esc(l.id)}" data-title="${esc(l.title)}">✎</button></td></tr>`; }).join('')}</tbody></table></div></details>`; }).join('')}
      </div>`;
    }).join('');
    return `<div class="page-head"><div><h1>${esc(p.name)} ${p.active === false ? pill('grey', 'inactive') : ''}</h1><div class="sub">${esc(p.title || label(p.role))}</div></div>
      <div class="actions"><button class="btn" data-act="log-11" data-person="${esc(id)}">Log 1:1</button><button class="btn" data-act="log-act" data-person="${esc(id)}">Log activity</button><button class="btn" data-act="enroll" data-person="${esc(id)}">Enroll in course</button><button class="btn primary" data-act="edit-person" data-id="${esc(id)}">Edit</button><button class="btn danger ghost" data-act="del-person" data-id="${esc(id)}">Remove</button></div></div>
      <div class="grid cols-2">
        <div><div class="card" style="margin-bottom:14px"><h3>Profile</h3><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${p.notes ? `<p class="small" style="white-space:pre-wrap;margin-top:10px">${esc(p.notes)}</p>` : ''}</div>
          <div class="card" style="margin-bottom:14px"><h3>Projects</h3>${prs.length ? `<ul class="plain">${prs.map(pr => `<li>${prlink(pr.id)} <span class="muted small">— ${esc(personRoleIn(pr, id))}</span> ${dot(pr.health)} ${pill(pr.status)}</li>`).join('')}</ul>` : '<div class="empty">Not assigned to any project. Set them as lead or member in the project.</div>'}</div>
          <div class="card"><div class="section-head"><h3>1:1 journal</h3><span class="hint">${ones.length} entries</span></div>${ones.length ? ones.map(a => actRow(a, { showPerson: false })).join('') : '<div class="empty">No 1:1 logged yet.</div>'}</div></div>
        <div><h2 style="margin-bottom:10px">Learning</h2>${learnBlocks || '<div class="card"><div class="empty">Not enrolled in any course. Use “Enroll in course”.</div></div>'}</div>
      </div>
      <div class="section" style="margin-top:14px"><div class="section-head"><h2>Other activity</h2></div><div class="card">${others.length ? others.map(a => actRow(a, { showPerson: false })).join('') : '<div class="empty">Nothing logged.</div>'}</div></div>`;
  }

  function vLearning(courseId) {
    const cs = courses(); if (!cs.length) return `<h1>Learning</h1><div class="empty">No curriculum loaded (data/curriculum.json).</div>`;
    const c = course(courseId) || cs[0];
    const ls = lessonsOf(c);
    const enrolled = learning().enrollments.filter(e => e.courseId === c.id).map(e => person(e.personId)).filter(Boolean);
    const cols = (c.phases || []).map(ph => `<th colspan="${(ph.lessons || []).length}" title="${esc(ph.name)}${ph.weeks ? ' · ' + esc(ph.weeks) : ''}">${esc(ph.name)}</th>`).join('');
    const rows = enrolled.map(p => { const sm = courseSummary(p.id, c.id); return `<tr><th class="person">${plink(p.id)}<div class="muted" style="font-weight:400">${sm.pct}% · ${sm.complete}/${sm.total}</div></th>${ls.map(l => { const pr = progressOf(p.id, l.id); return `<td class="cell ${pr.status}${sm.current?.id === l.id ? ' current' : ''}" data-person="${esc(p.id)}" data-lesson="${esc(l.id)}" data-title="${esc(l.title)}" title="${esc(l.title)} — ${label(pr.status)}${pr.date ? ' · ' + esc(pr.date) : ''}${pr.note ? '&#10;' + esc(pr.note) : ''}">${LESSON_GLYPH[pr.status] || ''}</td>`; }).join('')}</tr>`; }).join('');
    return `<div class="page-head"><div><h1>Learning</h1><div class="sub">${cs.length} course${cs.length === 1 ? '' : 's'} · tap a cell to advance its status; right-click, shift-click or long-press to set a note or date</div></div>
      <div class="actions"><button class="btn primary" data-act="enroll-any" data-course="${esc(c.id)}">Enroll someone</button></div></div>
      <div class="tabs">${cs.map(x => `<button class="${x.id === c.id ? 'active' : ''}" data-href="#/learning/${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div>
      <div class="card" style="margin-bottom:14px"><h3>${esc(c.name)} <span class="pill">${esc(c.audience || '')}</span></h3><p class="small">${esc(c.description || '')}</p>
        <dl class="kv"><dt>Where</dt><dd class="mono small">${esc(c.path || '')}</dd><dt>Lessons</dt><dd>${ls.length} in ${(c.phases || []).length} phases</dd>${c.language ? `<dt>Language</dt><dd>${esc(c.language)}</dd>` : ''}</dl>
        ${c.rules?.length ? `<details><summary class="small">Course rules (${c.rules.length})</summary><ul class="plain small">${c.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        ${c.milestones?.length ? `<details><summary class="small">Milestones / checkpoints (${c.milestones.length})</summary><ul class="plain small">${c.milestones.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        ${c.tracks?.length ? `<details><summary class="small">Pace tracks</summary><ul class="plain small">${c.tracks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
      </div>
      <div class="legend"><span><span class="sw" style="background:transparent"></span>not started</span><span><span class="sw" style="background:color-mix(in srgb,var(--yellow) 45%,transparent)"></span>in progress</span><span><span class="sw" style="background:color-mix(in srgb,var(--green) 55%,transparent)"></span>done</span><span><span class="sw" style="background:var(--green)"></span>★ gate passed</span><span><span class="sw" style="background:color-mix(in srgb,var(--red) 60%,transparent)"></span>! stuck</span><span><span class="sw" style="box-shadow:inset 0 0 0 2px var(--accent)"></span>current lesson</span></div>
      <div class="hint" style="margin-top:8px" aria-live="polite">${S.lastCell ? `${esc(S.lastCell.person)} · ${esc(S.lastCell.title)} → <b>${esc(label(S.lastCell.status))}</b>` : 'The lesson and new status of the last cell you tap show here.'}</div>
      <div class="matrix-wrap" style="margin-top:8px"><table class="matrix"><thead><tr class="phases"><th class="person"></th>${cols}</tr><tr class="lessons"><th class="person">Person</th>${ls.map(l => `<th title="${esc(l.title)}">${esc(trunc(l.title, 28))}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="${ls.length + 1}" style="padding:14px">Nobody enrolled yet — use “Enroll someone”.</td></tr>`}</tbody></table></div>
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
    const counts = COLLECTIONS.map(c => { const d = S.data[c]; const n = Array.isArray(d) ? d.length : c === 'curriculum' ? d.courses.length + ' courses' : c === 'learning' ? `${d.enrollments.length} enrollments, ${Object.keys(d.progress).length} marks` : '—'; return `<tr><td class="mono">${c}.json</td><td>${esc(String(n))}</td></tr>`; }).join('');
    const theme = localStorage.getItem(LS + 'theme') || 'auto';
    const g = ghConfig();
    const sub = S.backend === 'server' ? `Server on — writing to <span class="mono">${esc(S.dataDir)}</span>` : S.backend === 'github' ? `Connected to GitHub — every save is a commit to <span class="mono">${esc(g.owner)}/${esc(g.repo)}</span>` : 'Not connected — edits stay in this browser until you export';
    const ghCard = S.server ? '' : `<div class="card" style="margin-bottom:14px"><h3>GitHub backend</h3>
        ${S.backend === 'github' ? `<p class="small">Reading and writing <span class="mono">data/*.json</span> in <span class="mono">${esc(g.owner)}/${esc(g.repo)}</span> on branch <span class="mono">${esc(g.branch)}</span> with the token stored in this browser.${S.ghError ? ` <span class="pill red">last read failed: ${esc(S.ghError)}</span>` : ''}</p><div class="actions"><button class="btn" data-act="gh-connect">Change connection</button><button class="btn danger" data-act="gh-disconnect">Forget token</button></div>`
        : `<p class="small">This page holds no data. Connect it to the private repository that does: create a <b>fine-grained personal access token</b> on GitHub (Settings → Developer settings) scoped to that one repository with <b>Contents: read and write</b>, then paste it here. It is kept in this browser only and sent only to api.github.com.</p>${S.ghError ? `<div class="banner">GitHub answered: ${esc(S.ghError)}</div>` : ''}<div class="actions"><button class="btn primary" data-act="gh-connect">Connect to GitHub</button></div>`}
      </div>`;
    return `<div class="page-head"><div><h1>Data & settings</h1><div class="sub">${sub}</div></div><div class="actions"><button class="btn primary" data-act="settings">Edit settings</button></div></div>
      ${ghCard}
      <div class="grid cols-2">
        <div class="card"><h3>Storage</h3><table class="tbl"><thead><tr><th>Collection</th><th>Contents</th></tr></thead><tbody>${counts}</tbody></table>
          <div class="actions" style="margin-top:12px"><button class="btn" data-act="export">Export all (JSON)</button><label class="btn">Import JSON <input type="file" accept="application/json" data-act="import" hidden></label>${S.localOverride ? '<button class="btn danger" data-act="clear-local">Discard browser-only edits</button>' : ''}</div>
          <p class="hint" style="margin-top:8px">Import replaces the collections present in the file. Through the local server a backup of each file is kept as <span class="mono">*.json.bak</span>; through GitHub every save is a commit, so history is in git.</p></div>
        <div class="card"><h3>Settings</h3><dl class="kv"><dt>Team</dt><dd>${esc(st.teamName)}</dd><dt>Lead</dt><dd>${esc(st.leadName || '—')}</dd><dt>1:1 cadence</dt><dd>${esc(st.oneOnOneCadenceDays)} days</dd><dt>Stale project</dt><dd>${esc(st.staleProjectDays)} days without update</dd><dt>Stale learning</dt><dd>${esc(st.staleLearningDays)} days without a mark</dd></dl>
          <h3 style="margin-top:14px">Theme</h3><div class="actions">${['auto', 'light', 'dark'].map(t => `<button class="btn sm ${theme === t ? 'primary' : ''}" data-theme-set="${t}">${label(t)}</button>`).join('')}</div>
          <h3 style="margin-top:14px">How this works</h3><ul class="plain small"><li><b>Projects</b> hold status, health, lead, workstreams, milestones and facts.</li><li><b>People</b> are your mentees; each project's lead is one of them.</li><li><b>Activity</b> is the log: updates, blockers, decisions, 1:1s. It feeds “needs attention”.</li><li><b>Learning</b> tracks each person per lesson across the courses you handed out; gates are the checkpoints.</li><li>Everything is plain JSON in <span class="mono">data/</span>, versioned in git. Commit when you want a snapshot.</li></ul></div>
      </div>`;
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
      for (const w of (p.workstreams || []).filter(w => w.status === 'active')) lines.push(`  • ${w.name}${w.ownerId ? ' — ' + pname(w.ownerId) : ''}${w.next ? ': ' + w.next : ''}`);
      for (const b of bl) lines.push(`  BLOCKER: ${b.text}`);
      if (la) lines.push(`  last update ${la.date}: ${trunc(la.text, 160)}`);
      lines.push('');
    }
    if (mentees().length) {
      lines.push('People', '');
      for (const m of mentees()) {
        const o = lastOneOnOne(m.id);
        const lr = enrollmentsOf(m.id).map(e => courseSummary(m.id, e.courseId)).filter(Boolean).map(cs => `${cs.course.name}: ${cs.pct}%${cs.current ? ', now on ' + cs.current.title : ''}`).join('; ');
        lines.push(`${m.name}${m.focus ? ' — ' + m.focus : ''}`);
        lines.push(`  projects: ${personProjects(m.id).map(pr => pr.name + ' (' + personRoleIn(pr, m.id) + ')').join(', ') || '—'}`);
        lines.push(`  last 1:1: ${o ? o.date : 'never'}${lr ? '; learning: ' + lr : ''}`);
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
  const NAV = [['dashboard', 'Dashboard', '⌂'], ['projects', 'Projects', '▤'], ['people', 'People', '☺'], ['learning', 'Learning', '✎'], ['activity', 'Activity', '≡'], ['data', 'Data', '⚙']];
  function renderNav() {
    $('#nav').innerHTML = `<div class="brand">Team Tracker<small>${esc(settings().teamName || '')}</small></div>` +
      NAV.map(([k, l, i]) => `<a class="item ${S.route.name === k ? 'active' : ''}" href="#/${k === 'dashboard' ? '' : k}"><span class="ico">${i}</span>${l}</a>`).join('') +
      `<div class="spacer"></div><div class="status"><span class="dot ${S.backend === 'static' ? '' : 'on'}"></span>${S.backend === 'server' ? 'saving to data/' : S.backend === 'github' ? `GitHub · ${esc(ghConfig().owner)}/${esc(ghConfig().repo)}` : 'browser-only mode'}</div>`;
  }
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    let id = parts[1] || null;
    try { if (id) id = decodeURIComponent(id); } catch { /* keep the raw id; the view reports not found */ }
    S.route = { name: parts[0] || 'dashboard', id };
  }
  let prevRoute = '';
  function render() {
    parseRoute(); renderNav();
    const v = $('#view'); const r = S.route;
    const key = `${r.name}/${r.id || ''}`; const sameView = key === prevRoute; prevRoute = key;
    const y = window.scrollY; const mw = $('.matrix-wrap', v); const mx = mw ? [mw.scrollLeft, mw.scrollTop] : null;
    const openPhases = new Set($$('details[data-phase][open]', v).map(d => d.dataset.phase));
    const views = {
      dashboard: () => vDashboard(), projects: () => r.id ? vProject(r.id) : vProjects(), people: () => r.id ? vPerson(r.id) : vPeople(),
      learning: () => vLearning(r.id), activity: () => vActivity(), data: () => vData(),
    };
    const notice = S.backend === 'static' && r.name !== 'data' ? '<div class="banner">Not connected: edits stay in this browser only. <a href="#/data">Connect to GitHub</a> or run <span class="mono">python serve.py</span>.</div>' : S.ghError && r.name !== 'data' ? `<div class="banner">GitHub could not be read: ${esc(S.ghError)}. <a href="#/data">Check the connection</a>.</div>` : '';
    v.innerHTML = notice + (views[r.name] || views.dashboard)();
    bind(v);
    if (sameView) {
      openPhases.forEach(k => { const d = $$('details[data-phase]', v).find(x => x.dataset.phase === k); if (d) d.open = true; });
      window.scrollTo(0, y);
      const nm = $('.matrix-wrap', v); if (nm && mx) { nm.scrollLeft = mx[0]; nm.scrollTop = mx[1]; }
    } else window.scrollTo(0, 0);
  }

  function bind(v) {
    $$('[data-href]', v).forEach(el => el.addEventListener('click', e => { if (e.target.closest('a,button:not([data-href])')) return; location.hash = el.dataset.href; }));
    $$('[data-filter]', v).forEach(el => el.addEventListener('change', () => { S.filter = { ...(S.filter || {}), [el.dataset.filter]: el.value }; render(); }));
    $$('[data-af]', v).forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { S.actFilter = { ...(S.actFilter || { person: '', project: '', type: '', range: '30', q: '' }), [el.dataset.af]: el.value }; if (el.type === 'search') { const pos = el.selectionStart; render(); const n = $('[data-af="q"]'); n.focus(); n.setSelectionRange(pos, pos); } else render(); }));
    $$('.lesson-status', v).forEach(el => el.addEventListener('change', async () => { await setLesson(el.dataset.person, el.dataset.lesson, el.value, progressOf(el.dataset.person, el.dataset.lesson).note); render(); }));
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
      case 'new-person': return editPerson(null);
      case 'edit-person': return editPerson(d.id);
      case 'del-person': return deletePerson(d.id);
      case 'enroll': return enroll(d.person);
      case 'enroll-any': {
        const v = await form('Enroll someone', [{ key: 'personId', label: 'Person', type: 'select', options: peopleOpts() }]);
        if (v && v.personId) return enroll(v.personId, { courseId: d.course }); return;
      }
      case 'edit-enroll': { const e = learning().enrollments.find(x => x.personId === d.person && x.courseId === d.course); return enroll(d.person, e || { courseId: d.course }); }
      case 'unenroll': return unenroll(d.person, d.course);
      case 'edit-lesson': return editLesson(d.person, d.lesson, d.title);
      case 'settings': return editSettings();
      case 'summary': return showSummary();
      case 'gh-connect': return connectGitHub();
      case 'gh-disconnect': return disconnectGitHub();
      case 'export': return exportAll();
      case 'clear-local': { if (confirm('Discard all browser-only edits and reload the data files?')) { COLLECTIONS.forEach(c => localStorage.removeItem(LS + c)); location.reload(); } return; }
    }
  });
  $('#fab').addEventListener('click', () => editActivity(null, {}));

  function exportAll() {
    const blob = new Blob([JSON.stringify(Object.fromEntries(COLLECTIONS.map(c => [c, S.data[c]])), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `team-tracker-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importFile(e) {
    const f = e.target.files[0]; if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { return toast('Could not read that file'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return toast('Not a tracker export');
    const keys = COLLECTIONS.filter(c => c in obj && (Array.isArray(DEFAULTS[c]()) ? Array.isArray(obj[c]) : obj[c] && typeof obj[c] === 'object' && !Array.isArray(obj[c])));
    if (!keys.length) return toast('No valid collections in that file');
    if (!confirm(`Replace ${keys.join(', ')} with the file contents?`)) return;
    for (const c of keys) { S.data[c] = normalize(c, obj[c]); await save(c); }
    render();
  }

  function applyTheme() {
    const t = localStorage.getItem(LS + 'theme') || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }

  window.addEventListener('hashchange', render);
  applyTheme();
  load().then(render);
})();
