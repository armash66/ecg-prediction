'use strict';
/* ECG Intelligence UI - plain JS, no dependencies.
   Talks to a backend via the contract in README.md. If no backend answers, it runs in DEMO mode
   with an illustrative synthetic waveform (clearly labelled; not model output). */

const CLASSES = [['NORM', 'Normal ECG'], ['MI', 'Myocardial infarction'], ['STTC', 'ST/T change'],
                 ['CD', 'Conduction disturbance'], ['HYP', 'Hypertrophy']];
const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const T = 1000; // 10 s at 100 Hz

/* ---------------------------------------------------------------- parsing */
function resample(arr, n) {
  if (arr.length === n) return Float32Array.from(arr);
  const o = new Float32Array(n), k = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const p = i * k, a = Math.floor(p), b = Math.min(a + 1, arr.length - 1), f = p - a;
    o[i] = arr[a] * (1 - f) + arr[b] * f;
  }
  return o;
}

function toLeads(get, rows, cols) {
  let timeFirst;
  if (cols === 12) timeFirst = true;
  else if (rows === 12) timeFirst = false;
  else throw new Error(`Expected 12 leads, got an array of shape ${rows} x ${cols}`);
  const T0 = timeFirst ? rows : cols, out = [];
  for (let l = 0; l < 12; l++) {
    const a = new Float32Array(T0);
    for (let t = 0; t < T0; t++) {
      const v = timeFirst ? get(t, l) : get(l, t);
      if (!Number.isFinite(v)) throw new Error('The file contains NaN or non-numeric values');
      a[t] = v;
    }
    out.push(a);
  }
  if (T0 !== T) for (let l = 0; l < 12; l++) out[l] = resample(out[l], T);
  return { signal: out, note: T0 !== T ? `Resampled ${T0} samples to ${T} (assumes a 10 s recording).` : '' };
}

function parseNpy(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  if (u8[0] !== 0x93 || String.fromCharCode(...u8.slice(1, 6)) !== 'NUMPY') throw new Error('Not a .npy file');
  const major = u8[6];
  const hl = major === 1 ? dv.getUint16(8, true) : dv.getUint32(8, true);
  const off = major === 1 ? 10 : 12;
  const header = new TextDecoder().decode(u8.slice(off, off + hl));
  const descr = /'descr':\s*'([^']+)'/.exec(header)[1];
  const fortran = /'fortran_order':\s*(True|False)/.exec(header)[1] === 'True';
  const shape = /'shape':\s*\(([^)]*)\)/.exec(header)[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (shape.length !== 2) throw new Error('Expected a 2-D array (1000 x 12 or 12 x 1000)');
  const body = buf.slice(off + hl);
  let arr;
  if (descr === '<f4') arr = new Float32Array(body);
  else if (descr === '<f8') arr = new Float64Array(body);
  else throw new Error(`Unsupported dtype ${descr}; save the array as float32 or float64`);
  const [R, C] = shape;
  return toLeads(fortran ? (r, c) => arr[c * R + r] : (r, c) => arr[r * C + c], R, C);
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(l => l.trim().split(/[,;\t ]+/).map(Number));
  if (rows.length && rows[0].some(Number.isNaN)) rows.shift(); // header row
  if (!rows.length) throw new Error('Empty CSV');
  return toLeads((r, c) => rows[r][c], rows.length, rows[0].length);
}

/* ---------------------------------------------------------------- demo data */
function demoSignal() {
  const s = Array.from({ length: 12 }, () => new Float32Array(T));
  const rr = 60 / 72 * 100, gains = [1, 1.4, .6, -.8, .5, .9, .4, .9, 1.2, 1.3, 1, .7];
  for (let l = 0; l < 12; l++) for (let t = 0; t < T; t++) {
    const ph = (t % rr) / rr, g = (mu, sg, a) => a * Math.exp(-0.5 * ((ph - mu) / sg) ** 2);
    s[l][t] = gains[l] * (g(.15, .025, .12) + g(.27, .008, -.1) + g(.30, .010, 1) + g(.33, .010, -.22) + g(.55, .05, .28))
              + 0.012 * (Math.random() - .5);
  }
  return s;
}
function demoResult() {
  const rr = 60 / 72 * 100;
  const attr = Array.from({ length: 12 }, (_, l) => Array.from({ length: T }, (_, t) => {
    const ph = (t % rr) / rr; return Math.exp(-0.5 * ((ph - .30) / .03) ** 2) * (l === 1 || l === 10 ? 1 : .4);
  }));
  return { probs: { NORM: .81, MI: .07, STTC: .12, CD: .05, HYP: .04 },
           thresholds: { NORM: .5, MI: .4, STTC: .45, CD: .4, HYP: .4 }, gate: .58, explain_class: 'NORM', attribution: attr };
}

/* ---------------------------------------------------------------- state & api */
const state = { signal: null, lead: 1, res: null, demo: true, info: null, truth: null };
const API = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('api') || '').replace(/\/$/, '') : '';
const $ = id => document.getElementById(id);

async function getJSON(path, opt) {
  const r = await fetch(API + path, opt);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

async function analyse(signal, explain) {
  state.signal = signal;
  if (state.demo) { state.res = demoResult(); }
  else {
    const rows = Array.from({ length: T }, (_, t) => signal.map(l => +l[t].toFixed(5)));
    state.res = await getJSON('/api/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: rows, explain: explain || null })
    });
  }
  render();
}

/* ---------------------------------------------------------------- rendering */
function leadScores() {
  const a = state.res && state.res.attribution;
  if (!a) return null;
  return a.map(row => row.reduce((s, v) => s + Math.abs(v), 0));
}

function renderLeads() {
  const sc = leadScores(), top = sc ? sc.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]) : [];
  $('leads').innerHTML = LEADS.map((n, i) =>
    `<button class="lead ${i === state.lead ? 'on' : ''}" data-l="${i}">${n}${top.includes(i) ? '<span class="dot" title="high attribution"></span>' : ''}</button>`).join('');
  $('leads').querySelectorAll('.lead').forEach(b => b.onclick = () => { state.lead = +b.dataset.l; renderLeads(); draw(); });
}

function renderPreds() {
  const r = state.res; if (!r) return;
  const rows = CLASSES.map(([c, name]) => [c, name, r.probs[c] ?? 0, r.thresholds[c] ?? .5]).sort((a, b) => b[2] - a[2]);
  $('preds').className = '';
  $('preds').innerHTML = rows.map(([c, name, p, th]) => `
    <div class="row ${p > th ? 'hit' : ''}">
      <div class="nm">${c}${p > th ? '<span class="pill">detected</span>' : ''}<small>${name}</small></div>
      <div class="track"><div class="fill" style="width:${Math.min(100, p * 100)}%"></div><div class="thr" style="left:${th * 100}%" title="decision threshold ${th.toFixed(2)}"></div></div>
      <div class="val">${p.toFixed(2)}</div>
    </div>`).join('');
  $('truth').textContent = state.truth ? `Dataset label: ${state.truth.length ? state.truth.join(', ') : 'none'}` : '';
}

function renderExplain() {
  const r = state.res; if (!r) return;
  $('chips').innerHTML = CLASSES.map(([c]) => `<button class="chip ${c === r.explain_class ? 'on' : ''}" data-c="${c}">${c}</button>`).join('');
  $('chips').querySelectorAll('.chip').forEach(b => b.onclick = () => analyse(state.signal, b.dataset.c).catch(showError));
  const sc = leadScores();
  if (sc) {
    const top = sc.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => LEADS[x[1]]);
    $('explainText').className = '';
    $('explainText').innerHTML = `Highlighted regions influenced the model's output for <b>${r.explain_class}</b>. Most influential leads: <b>${top.join(', ')}</b>.
      <small>This shows what the model reacted to, not clinical evidence.</small>`;
  } else { $('explainText').className = 'empty'; $('explainText').textContent = 'No attribution returned.'; }
  if (r.gate != null) {
    const d = Math.round(r.gate * 100);
    $('gate').innerHTML = `<div class="gatebar"><i style="width:${d}%;background:var(--blush-d)"></i><i style="width:${100 - d}%;background:var(--sky)"></i></div>
      <div class="gatelab"><span>learned from signal ${d}%</span><span>handcrafted features ${100 - d}%</span></div>`;
  } else $('gate').innerHTML = '';
}

function render() { renderLeads(); renderPreds(); renderExplain(); draw(); }

/* ---------------------------------------------------------------- waveform */
function draw() {
  const c = $('wave'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padL = 8, padR = 8, padT = 12, padB = 22, W = w - padL - padR, H = h - padT - padB;
  ctx.strokeStyle = '#F1EEE8'; ctx.lineWidth = 1; ctx.fillStyle = '#B5B8B6'; ctx.font = '11px system-ui';
  for (let s = 0; s <= 10; s++) { const x = padL + s / 10 * W; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke(); ctx.fillText(s + 's', x - 6, h - 6); }
  for (let i = 0; i <= 4; i++) { const y = padT + i / 4 * H; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke(); }
  if (!state.signal) { ctx.fillStyle = '#B5B8B6'; ctx.font = '14px system-ui'; ctx.fillText('No ECG loaded', w / 2 - 44, h / 2); return; }
  const y = state.signal[state.lead];
  let mn = Infinity, mx = -Infinity; for (const v of y) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const span = (mx - mn) || 1, X = t => padL + t / (T - 1) * W, Y = v => padT + H - (v - mn) / span * H * .86 - H * .07;
  state.map = { padL, W, X, Y, mn, span, H, padT };
  const a = state.res && state.res.attribution;
  if (a) {
    let gmax = 0; for (const row of a) for (const v of row) gmax = Math.max(gmax, Math.abs(v));
    const row = a[state.lead], bw = W / T + .6;
    for (let t = 0; t < T; t++) {
      const k = Math.sqrt(Math.abs(row[t]) / (gmax || 1));
      if (k > .04) { ctx.fillStyle = `rgba(207,143,151,${(k * .5).toFixed(3)})`; ctx.fillRect(X(t) - bw / 2, padT, bw, H); }
    }
  }
  ctx.strokeStyle = '#33363B'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let t = 0; t < T; t++) t ? ctx.lineTo(X(t), Y(y[t])) : ctx.moveTo(X(t), Y(y[t]));
  ctx.stroke();
}

/* ---------------------------------------------------------------- ui wiring */
function showError(e) { const b = $('banner'); b.hidden = false; b.textContent = e.message || String(e); }
function note(msg) { const b = $('banner'); b.hidden = !msg; b.textContent = msg || ''; }

async function handleFile(f) {
  try {
    const parsed = f.name.toLowerCase().endsWith('.npy') ? parseNpy(await f.arrayBuffer()) : parseCsv(await f.text());
    state.truth = null; note(parsed.note || (state.demo ? DEMO_NOTE : ''));
    await analyse(parsed.signal);
  } catch (e) { showError(e); }
}

const DEMO_NOTE = 'Demo mode: no backend connected. The waveform and predictions are illustrative, not model output.';

function renderModelTab() {
  const i = state.info;
  if (!i) return;
  const ex = i.experiments || [];
  const best = Math.max(...ex.map(e => e.macro_auc || 0));
  $('expTable').className = '';
  $('expTable').innerHTML = ex.length ? `<table><tr><th>Model</th><th>AUROC</th><th>AUPRC</th><th>F1</th><th>Sensitivity</th></tr>${ex.map(e =>
    `<tr class="${e.macro_auc === best ? 'best' : ''}"><td>${e.name}</td><td>${e.macro_auc.toFixed(3)}</td><td>${e.macro_auprc.toFixed(3)}</td><td>${e.macro_f1.toFixed(3)}</td><td>${e.macro_sensitivity.toFixed(3)}</td></tr>`).join('')}</table>`
    : 'No results yet. Train the experiments first.';
  const pc = i.per_class;
  $('classTable').className = '';
  $('classTable').innerHTML = pc ? `<table><tr><th>Class</th><th>AUROC</th><th>AUPRC</th><th>F1</th><th>Sensitivity</th></tr>${CLASSES.map(([c]) =>
    `<tr><td>${c}</td><td>${pc.auc[c].toFixed(3)}</td><td>${pc.auprc[c].toFixed(3)}</td><td>${pc.f1[c].toFixed(3)}</td><td>${pc.sensitivity[c].toFixed(3)}</td></tr>`).join('')}</table>` : 'Not available.';
}

async function init() {
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    $('analyse').hidden = b.dataset.tab !== 'analyse'; $('model').hidden = b.dataset.tab !== 'model';
    if (b.dataset.tab === 'analyse') draw();
  });
  const drop = $('drop'), file = $('file');
  drop.onclick = () => file.click();
  drop.onkeydown = e => { if (e.key === 'Enter') file.click(); };
  file.onchange = () => file.files[0] && handleFile(file.files[0]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  $('sample').oninput = () => $('sampleNo').textContent = $('sample').value;
  $('loadSample').onclick = async () => {
    try {
      const s = await getJSON('/api/sample/' + $('sample').value);
      const parsed = toLeads((r, c) => s.signal[r][c], s.signal.length, 12);
      state.truth = s.labels || null; await analyse(parsed.signal);
    } catch (e) { showError(e); }
  };
  const tip = $('tip'), wave = $('wave');
  wave.onmousemove = e => {
    if (!state.signal || !state.map) return;
    const m = state.map, r = wave.getBoundingClientRect(), x = e.clientX - r.left;
    const t = Math.max(0, Math.min(T - 1, Math.round((x - m.padL) / m.W * (T - 1))));
    tip.hidden = false; tip.style.left = x + 'px'; tip.style.top = m.Y(state.signal[state.lead][t]) + 'px';
    tip.textContent = `${(t / 100).toFixed(2)} s · ${state.signal[state.lead][t].toFixed(3)} mV`;
  };
  wave.onmouseleave = () => tip.hidden = true;
  window.addEventListener('resize', draw);

  try {
    state.info = await getJSON('/api/info');
    if (!state.info.checkpoint_loaded || !state.info.n_samples) {
      state.demo = true;
      $('sample').disabled = $('loadSample').disabled = true;
      note(state.info.notice || DEMO_NOTE);
      await analyse(demoSignal());
    } else {
      state.demo = false;
      $('sample').max = Math.max(0, (state.info.n_samples || 1) - 1);
      $('sample').disabled = $('loadSample').disabled = !state.info.n_samples;
      note('');
      $('loadSample').click();
    }
  } catch (e) {
    state.demo = true; state.info = { experiments: [], per_class: null };
    $('sample').disabled = $('loadSample').disabled = true;
    note(DEMO_NOTE); await analyse(demoSignal());
  }
  renderModelTab(); draw();
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined') module.exports = { parseNpy, parseCsv, toLeads, resample };
