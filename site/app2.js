/* Fly Brain Drone — round two: T4/T5-driven looming, two-brain comparison, stress test, 3D views. */
(() => {
  const FB = window.FB || {}; const P = FB.phase56; const T = FB.traj56;
  const C = { ink: '#0b0b0b', coal: '#111111', fog: '#a5a5a5', white: '#ffffff', accent: '#e63946', real: '#e63946', nobrain: '#5a7ee0', shuffle: '#bf8a10', shuffle2: '#8a6410', left: '#2e9fbf', right: '#d4652f', grid: '#202020', rand: '#7c5cbf' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const tip = $('#tip'); const showTip = (h, x, y) => { tip.innerHTML = h; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1; }; const hideTip = () => tip.style.opacity = 0;
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fill = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined && v !== null) e.textContent = v; };
  const widthOf = (e) => { let n = e; while (n && n.clientWidth < 200) n = n.parentElement; return Math.max(320, (n || document.body).clientWidth); };
  const guard = (name, fn) => { try { fn(); } catch (err) { console.error('block failed:', name, err); } };
  // keep a three.js renderer the same width as its host and the camera aspect correct whenever the layout changes
  const fitRenderer = (host, renderer, cam, ratio) => {
    const apply = () => { const w = Math.max(320, host.clientWidth || widthOf(host)), h = Math.round(w * ratio); renderer.setSize(w, h, true); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    apply(); if (window.ResizeObserver) new ResizeObserver(apply).observe(host); else addEventListener('resize', apply); return apply;
  };

  /* ---------- T4/T5: the brain computes looming itself ---------- */
  guard('t4t5', function t4t5() {
    const host = $('#t4t5-chart'); if (!host || !P || !P.t4t5) return;
    const rows = [['T4T5_abcd_L', 'All four directions (expansion)'], ['T4T5_ab_L', 'Horizontal only'], ['T4T5_cd_L', 'Vertical only'], ['T4T5_a_L', 'Front-to-back only (rotation)'], ['T4T5_b_L', 'Back-to-front only (rotation)']].filter(r => P.t4t5[r[0]]);
    const series = [['LPLC2_left', 'LPLC2 looming detector', C.left], ['DNp01_left', 'giant fiber (escape)', C.accent], ['DNa02_left', 'DNa02 steering, same side', C.right]];
    const W = 620, rowH = 54, padL = 210, padR = 40, H = rows.length * rowH + 36, max = 120, sc = v => Math.min(v, max) / max * (W - padL - padR);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Firing rates of LPLC2, giant fiber and DNa02 for different motion patterns on the left eye' });
    const g = el('g', { class: 'grid' }, svg);
    [30, 60, 90, 120].forEach(v => { el('line', { x1: padL + sc(v), y1: 8, x2: padL + sc(v), y2: H - 22 }, g); const t = el('text', { x: padL + sc(v), y: H - 8, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v + ' Hz'; });
    rows.forEach(([k, name], i) => {
      const y0 = 14 + i * rowH; const lab = el('text', { x: padL - 10, y: y0 + 22, 'text-anchor': 'end', class: 'strong' }, svg); lab.textContent = name;
      series.forEach(([f, n, col], j) => { const v = P.t4t5[k][f] || 0; const y = y0 + j * 13;
        el('rect', { x: padL, y, width: Math.max(sc(v), 1.5), height: 11, fill: col, class: 'bar' }, svg);
        const t = el('text', { x: padL + Math.max(sc(v), 1.5) + 4, y: y + 9, style: 'font-size:9px' }, svg); t.textContent = fmt(v, 0);
        const hit = el('rect', { x: padL, y: y - 1, width: W - padL - padR, height: 13, class: 'hit' }, svg);
        hit.addEventListener('mousemove', e => showTip(`<b>${name}</b><br>${n}: ${fmt(v, 1)} Hz<br>right-side copy: ${fmt(P.t4t5[k][f.replace('left', 'right')] || 0, 1)} Hz`, e.clientX, e.clientY)); hit.addEventListener('mouseleave', hideTip); });
    });
    host.appendChild(svg);
  });

  /* ---------- Stress test: main comparison with CIs ---------- */
  guard('main', function main() {
    const host = $('#main-chart'); if (!host || !P || !P.main) return;
    const names = { nobrain: ['No brain', C.nobrain], real: ['Real wiring', C.real], rand1: ['Random read-out #1', C.rand], rand2: ['Random read-out #2', C.rand], rand3: ['Random read-out #3', C.rand], shuffle1: ['Shuffled wiring #1', C.shuffle], shuffle2: ['Shuffled wiring #2', C.shuffle], shuffle3: ['Shuffled wiring #3', C.shuffle] };
    const order = ['real', 'nobrain', 'rand1', 'rand2', 'rand3', 'shuffle1', 'shuffle2', 'shuffle3'].filter(k => P.main.find(r => r.cond === k));
    const W = 620, rowH = 30, padL = 170, padR = 120, H = order.length * rowH + 40, max = 2.6, sc = v => v / max * (W - padL - padR);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Mean closest approach with 95% confidence intervals per brain condition' });
    const g = el('g', { class: 'grid' }, svg);
    [0.5, 1, 1.5, 2, 2.5].forEach(v => { el('line', { x1: padL + sc(v), y1: 8, x2: padL + sc(v), y2: H - 24 }, g); const t = el('text', { x: padL + sc(v), y: H - 8, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v + ' m'; });
    el('line', { x1: padL + sc(0.3), y1: 8, x2: padL + sc(0.3), y2: H - 24, stroke: '#555', 'stroke-dasharray': '3 4' }, svg);
    order.forEach((k, i) => { const r = P.main.find(x => x.cond === k); const [name, col] = names[k]; const y = 22 + i * rowH;
      const lab = el('text', { x: padL - 10, y: y + 4, 'text-anchor': 'end', class: 'strong' }, svg); lab.textContent = name;
      el('line', { x1: padL + sc(r.ci[0]), y1: y, x2: padL + sc(r.ci[1]), y2: y, stroke: col, 'stroke-width': 2 }, svg);
      el('circle', { cx: padL + sc(r.mean_min_dist), cy: y, r: 5, fill: col, stroke: C.coal, 'stroke-width': 2 }, svg);
      const t = el('text', { x: W - padR + 8, y: y + 4, style: 'font-size:10px' }, svg); t.textContent = `${Math.round(r.evade_rate * 100)}% cleared · n=${r.n}`;
      const hit = el('rect', { x: padL, y: y - rowH / 2, width: W - padL - padR, height: rowH, class: 'hit' }, svg);
      hit.addEventListener('mousemove', e => showTip(`<b>${name}</b><br>mean closest approach ${r.mean_min_dist.toFixed(2)} m (95% CI ${r.ci[0].toFixed(2)}–${r.ci[1].toFixed(2)})<br>cleared the sphere in ${Math.round(r.evade_rate * 100)}% of ${r.n} flights` + (r.evade_rate > 0 ? `<br>turned away from the threat in ${Math.round(r.correct_side_rate * 100)}% of those` : ''), e.clientX, e.clientY)); hit.addEventListener('mouseleave', hideTip); });
    host.appendChild(svg);
    const real = P.main.find(r => r.cond === 'real'); if (real) { fill('st-real-rate', Math.round(real.evade_rate * 100) + '%'); fill('st-real-n', real.n); }
    const ctrl = P.main.filter(r => r.cond !== 'real' && r.cond !== 'nobrain'); if (ctrl.length) { const tot = ctrl.reduce((a, r) => a + r.n, 0), ev = ctrl.reduce((a, r) => a + r.n * r.evade_rate, 0); fill('st-ctrl-rate', Math.round(ev / tot * 100) + '%'); fill('st-ctrl-n', tot); }
  });

  /* ---------- Ablations ---------- */
  guard('ablate', function ablate() {
    const host = $('#ablate-chart'); if (!host || !P || !P.ablate) return;
    const names = { full: 'Full read-out', drop_DNp01: 'Without giant fiber', drop_DNa02: 'Without DNa02', drop_DNa01_DNb01: 'Without DNa01 + DNb01', drop_DNp03_DNp11: 'Without DNp03 + DNp11', drop_DNg02: 'Without DNg02', drop_all_steering: 'Steering neurons all removed', input_LC4_only: 'Eye input: LC4 only', input_LPLC2_only: 'Eye input: LPLC2 only' };
    const rows = P.ablate; const W = 620, rowH = 26, padL = 200, padR = 90, H = rows.length * rowH + 40, max = 2.6, sc = v => v / max * (W - padL - padR);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Closest approach when parts of the read-out or the eye input are removed' });
    const g = el('g', { class: 'grid' }, svg);
    [0.5, 1, 1.5, 2, 2.5].forEach(v => { el('line', { x1: padL + sc(v), y1: 8, x2: padL + sc(v), y2: H - 24 }, g); const t = el('text', { x: padL + sc(v), y: H - 8, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v + ' m'; });
    el('line', { x1: padL + sc(0.3), y1: 8, x2: padL + sc(0.3), y2: H - 24, stroke: '#555', 'stroke-dasharray': '3 4' }, svg);
    rows.forEach((r, i) => { const y = 20 + i * rowH; const col = r.variant === 'full' ? C.real : r.variant.startsWith('input') ? C.left : r.variant === 'drop_all_steering' ? C.shuffle : '#c96b74';
      const lab = el('text', { x: padL - 10, y: y + 4, 'text-anchor': 'end', class: r.variant === 'full' ? 'strong' : '' }, svg); lab.textContent = names[r.variant] || r.variant;
      el('line', { x1: padL + sc(r.ci[0]), y1: y, x2: padL + sc(r.ci[1]), y2: y, stroke: col, 'stroke-width': 2 }, svg);
      el('circle', { cx: padL + sc(r.mean_min_dist), cy: y, r: 4.5, fill: col, stroke: C.coal, 'stroke-width': 2 }, svg);
      const t = el('text', { x: W - padR + 8, y: y + 4, style: 'font-size:10px' }, svg); t.textContent = `turn ${r.mean_peak_turn.toFixed(2)}`;
      const hit = el('rect', { x: padL, y: y - rowH / 2, width: W - padL - padR, height: rowH, class: 'hit' }, svg);
      hit.addEventListener('mousemove', e => showTip(`<b>${names[r.variant] || r.variant}</b><br>closest approach ${r.mean_min_dist.toFixed(2)} m (95% CI ${r.ci[0].toFixed(2)}–${r.ci[1].toFixed(2)}), n=${r.n}<br>peak turn command ${r.mean_peak_turn.toFixed(2)} · peak escape ${r.mean_peak_gf.toFixed(2)}`, e.clientX, e.clientY)); hit.addEventListener('mouseleave', hideTip); });
    host.appendChild(svg);
  });

  /* ---------- Robustness heatmap ---------- */
  guard('robust', function robust() {
    const host = $('#robust-chart'); if (!host || !P || !P.robust || !P.robust.length) return;
    const R = P.robust; const azs = [...new Set(R.map(r => r.az))].sort((a, b) => a - b); const vs = [...new Set(R.map(r => r.v))].sort((a, b) => a - b); const rs = [...new Set(R.map(r => r.r))].sort((a, b) => a - b);
    let size = rs.includes(0.3) ? 0.3 : rs[0];
    const seg = $('#robust-seg'); if (seg) { seg.innerHTML = rs.map(r => `<button aria-pressed="${r === size}" data-r="${r}">${Math.round(r * 100)} cm sphere</button>`).join(''); $$('button', seg).forEach(b => b.addEventListener('click', () => { size = +b.dataset.r; $$('button', seg).forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); })); }
    function draw() {
      host.innerHTML = ''; const W = 620, padL = 90, padT = 30, cw = (W - padL - 20) / azs.length, ch = 44, H = padT + vs.length * ch + 30;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Closest approach by threat bearing and approach speed' });
      const tt = el('text', { x: padL, y: 14, style: 'font-size:9px;letter-spacing:2px' }, svg); tt.textContent = 'THREAT BEARING (− = right, + = left)';
      azs.forEach((az, i) => { const t = el('text', { x: padL + i * cw + cw / 2, y: padT - 6, 'text-anchor': 'middle', style: 'font-size:10px' }, svg); t.textContent = (az > 0 ? '+' : '') + az + '°'; });
      vs.forEach((v, j) => { const t = el('text', { x: padL - 8, y: padT + j * ch + ch / 2 + 4, 'text-anchor': 'end', class: 'strong', style: 'font-size:10px' }, svg); t.textContent = v + ' m/s';
        azs.forEach((az, i) => { const r = R.find(x => x.az === az && x.v === v && x.r === size); if (!r) return; const q = Math.min(1, r.mean_min_dist / 2.5);
          const light = 22 + q * 40; const colr = r.mean_min_dist > r.r ? `hsl(354 70% ${light}%)` : '#2a2a2a';
          el('rect', { x: padL + i * cw + 1, y: padT + j * ch + 1, width: cw - 2, height: ch - 2, rx: 3, fill: colr }, svg);
          const t = el('text', { x: padL + i * cw + cw / 2, y: padT + j * ch + ch / 2 + 4, 'text-anchor': 'middle', class: 'strong', style: 'font-size:11px' }, svg); t.textContent = r.mean_min_dist.toFixed(2);
          const hit = el('rect', { x: padL + i * cw, y: padT + j * ch, width: cw, height: ch, class: 'hit' }, svg);
          hit.addEventListener('mousemove', e => showTip(`<b>bearing ${az}°, ${v} m/s, ${Math.round(size * 100)} cm sphere</b><br>closest approach ${r.mean_min_dist.toFixed(2)} m, cleared ${Math.round(r.evade_rate * 100)}% of ${r.n}<br>no brain: ${r.nobrain_min.toFixed(2)} m`, e.clientX, e.clientY)); hit.addEventListener('mouseleave', hideTip); }); });
      host.appendChild(svg);
    }
    draw();
    const all = R.reduce((a, r) => a + r.n * r.evade_rate, 0) / R.reduce((a, r) => a + r.n, 0); fill('st-robust-rate', Math.round(all * 100) + '%'); fill('st-robust-n', R.reduce((a, r) => a + r.n, 0));
  });

  /* ---------- Forward flight mini trajectories ---------- */
  guard('forward', function forward() {
    const cv = $('#forward-canvas'); if (!cv || !T || !T.forward) return;
    const courses = { headon_static: { objs: [[8, 0]], label: 'Static sphere dead ahead', col: C.real }, gauntlet_offset: { objs: [[4, 1.2], [7, -1.2], [10, 1.2]], label: 'Three spheres off to the sides', col: C.left } };
    const dpr = Math.min(devicePixelRatio || 1, 2); cv.style.width = '100%'; const w = widthOf(cv), h = Math.round(w * 0.42); cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.coal; ctx.fillRect(0, 0, w, h);
    const keys = Object.keys(courses).filter(k => T.forward[k]); const pw = w / keys.length;
    keys.forEach((k, i) => { const c = courses[k], d = T.forward[k]; const ox = i * pw + 30, sc = (pw - 60) / 12, cy = h / 2; const X = (x, y) => [ox + x * sc, cy - y * sc];
      ctx.strokeStyle = C.grid; for (let m = 0; m <= 12; m += 2) { const [a, b] = X(m, -3), [c2, d2] = X(m, 3); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d2); ctx.stroke(); }
      c.objs.forEach(([x, y]) => { const [px, py] = X(x, y); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(px, py, 0.3 * sc, 0, 7); ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.stroke(); });
      ctx.strokeStyle = c.col; ctx.lineWidth = 2; ctx.beginPath(); d.x.forEach((x, j) => { const [px, py] = X(x, d.y[j]); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
      const [sx, sy] = X(d.x[0], d.y[0]); ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill();
      ctx.fillStyle = C.white; ctx.font = '600 11px Inter'; ctx.fillText(c.label, ox, 18); ctx.fillStyle = C.fog; ctx.font = '10px Inter';
      const f = (P.forward || []).find(r => r.course === k && r.cond === 'real'); if (f) ctx.fillText(`closest ${f.mean_min_dist.toFixed(2)} m · heading change ${Math.abs(f.final_yaw).toFixed(0)}°`, ox, h - 10); });
  });

  /* ---------- MaleCNS comparison table ---------- */
  guard('mcns', function mcns() {
    const tb = $('#mcns-table'); if (!tb || !P || !P.mcns_openloop) return;
    const fw = FB.phase1 ? FB.phase1.lat : null; const mc = P.mcns_openloop;
    const row = (label, fwv, mcv) => `<tr><td>${label}</td><td class="num">${fwv}</td><td class="num">${mcv}</td></tr>`;
    const fwl = (t, exp) => fw && fw[exp] && fw[exp][t] ? `${fmt(fw[exp][t][0])} / ${fmt(fw[exp][t][1])}` : '—';
    const mcl = (t, s) => mc[s] ? `${fmt(mc[s][t + '_left'])} / ${fmt(mc[s][t + '_right'])}` : '—';
    tb.innerHTML = `<tr><th>Left-eye LPLC2 input → neuron (left / right, Hz)</th><th class="num">FlyWire (female)</th><th class="num">MaleCNS (male)</th></tr>` +
      row('Giant fiber DNp01', fwl('DNp01', 'LPLC2_L'), mcl('DNp01', 'LPLC2_L')) + row('DNa02 steering', fwl('DNa02', 'LPLC2_L'), mcl('DNa02', 'LPLC2_L')) +
      `<tr><th>Left-eye LC4 input → neuron</th><th></th><th></th></tr>` + row('DNp11 saccade', fwl('DNp11', 'LC4_L'), mcl('DNp11', 'LC4_L')) + row('Giant fiber DNp01', fwl('DNp01', 'LC4_L'), mcl('DNp01', 'LC4_L')) +
      `<tr><th>Left-eye motion, all directions → neuron</th><th></th><th></th></tr>` + row('LPLC2 looming detector', P.t4t5 && P.t4t5.T4T5_abcd_L ? `${fmt(P.t4t5.T4T5_abcd_L.LPLC2_left)} / ${fmt(P.t4t5.T4T5_abcd_L.LPLC2_right)}` : '—', mcl('LPLC2', 'T4T5_abcd_L')) + row('Giant fiber DNp01', P.t4t5 && P.t4t5.T4T5_abcd_L ? `${fmt(P.t4t5.T4T5_abcd_L.DNp01_left)} / ${fmt(P.t4t5.T4T5_abcd_L.DNp01_right)}` : '—', mcl('DNp01', 'T4T5_abcd_L')) +
      `<tr><th>Nerve cord (MaleCNS only), left-eye LPLC2 input</th><th></th><th></th></tr>` + row('Wing power motor neurons (DLM, DVM)', 'not in dataset', mcl('MNpower', 'LPLC2_L')) + row('Wing steering motor neurons', 'not in dataset', mcl('MNsteer', 'LPLC2_L')) + row('Jump muscle motor neuron (TTMn)', 'not in dataset', mcl('TTMn', 'LPLC2_L'));
    const fl = P.mcns_flights || []; const g = (cond, bridge, az) => fl.find(r => r.cond === cond && r.bridge === bridge && String(r.az) === String(az));
    const ft = $('#mcns-flights'); if (ft) {
      const cell = r => r ? (r.mean_min_dist !== undefined ? `${r.mean_min_dist.toFixed(2)} m${r.mean_min_dist < 0.3 ? ' ✕' : ''}<br><span class="muted">away from threat ${Math.round(r.correct_side * 100)}%</span>` : `${r.total_yaw.toFixed(0)}°`) : '—';
      ft.innerHTML = `<tr><th>MaleCNS in the loop</th><th class="num">Threat from left</th><th class="num">Threat from right</th><th class="num">Yaw drift</th></tr>` +
        `<tr><td>No brain</td><td class="num">${cell(g('nobrain', '-', 30))}</td><td class="num">${cell(g('nobrain', '-', -30))}</td><td class="num">${cell(g('nobrain', '-', 'opto'))}</td></tr>` +
        `<tr><td><span style="color:${C.real}">■</span> Real wiring, descending-neuron read-out</td><td class="num">${cell(g('real', 'dn', 30))}</td><td class="num">${cell(g('real', 'dn', -30))}</td><td class="num">${cell(g('real', 'dn', 'opto'))}</td></tr>` +
        `<tr><td><span style="color:${C.right}">■</span> Real wiring, wing motor-neuron read-out</td><td class="num">${cell(g('real', 'mn', 30))}</td><td class="num">${cell(g('real', 'mn', -30))}</td><td class="num">${cell(g('real', 'mn', 'opto'))}</td></tr>` +
        `<tr><td><span style="color:${C.shuffle}">■</span> Shuffled wiring</td><td class="num">${cell(g('shuffle1', 'dn', 30))}</td><td class="num">${cell(g('shuffle1', 'dn', -30))}</td><td class="num">${cell(g('shuffle1', 'dn', 'opto'))}</td></tr>`;
    }
  });

  /* ---------- total flight count for the method table ---------- */
  guard('total', function total() {
    if (!P) return; const n = a => (a || []).reduce((s, r) => s + (r.n || 0), 0);
    const tot = n(P.main) + n(P.ablate) + n(P.robust) + n(P.forward) + n(P.mcns_flights) + 29; // 29 = phase 3 and 4 flights
    fill('m-total-flights', fmt(tot));
  });

  /* ---------- 3D brain viewer (three.js) ---------- */
  guard('brain3d', function brain3d() {
    const host = $('#brain3d'); if (!host || !window.THREE || !(FB.brain3d_fw || FB.brain3d_mc)) return;
    const THREE = window.THREE; const CLS = [0x2e9fbf, 0x5ad1e6, 0xd9d9d9, 0xe63946, 0xa5a5a5, 0x6f8fa8, 0xbf8a10];
    const HI = { LPLC2: [C.left, 'LPLC2 looming'], LC4: ['#5ad1e6', 'LC4 looming'], DNp01: [C.accent, 'Giant fiber'], DNa02: [C.right, 'DNa02 steering'], DNp11: ['#ff8e99', 'DNp11 saccade'], DN_all: ['#8d8d8d', 'All descending'], MNsteer: [C.shuffle, 'Wing steering motor neurons'], MNpower: ['#e2b34a', 'Wing power motor neurons'] };
    let which = FB.brain3d_fw ? 'fw' : 'mc'; const on = { LPLC2: true, LC4: true, DNp01: true, DNa02: true, DNp11: false, DN_all: true, MNsteer: true, MNpower: false };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x111111); host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(40, 1.6, 1, 20000); const group = new THREE.Group(); scene.add(group);
    fitRenderer(host, renderer, cam, 0.6);
    let dist = 1200; cam.position.set(0, 0, dist);
    function build() {
      while (group.children.length) group.remove(group.children[0]);
      const D = which === 'fw' ? FB.brain3d_fw : FB.brain3d_mc; if (!D) return;
      const n = D.pts.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const p = D.pts[i]; pos[i * 3] = p[0]; pos[i * 3 + 1] = -p[1]; pos[i * 3 + 2] = p[2]; const c = new THREE.Color(CLS[D.cls[i]] || 0xa5a5a5); col[i * 3] = c.r * 0.6; col[i * 3 + 1] = c.g * 0.6; col[i * 3 + 2] = c.b * 0.6; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, opacity: 0.7, sizeAttenuation: true })));
      Object.keys(HI).forEach(k => { if (!on[k]) return; const pts = [...(D.hi[k + '_left'] || []), ...(D.hi[k + '_right'] || [])]; if (!pts.length) return;
        const a = new Float32Array(pts.length * 3); pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = -p[1]; a[i * 3 + 2] = p[2]; });
        const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(a, 3));
        group.add(new THREE.Points(g2, new THREE.PointsMaterial({ size: pts.length < 6 ? 16 : 5, color: new THREE.Color(HI[k][0]), transparent: true, opacity: 0.95, sizeAttenuation: true }))); });
      dist = D.extent * (which === 'fw' ? 1.7 : 2.1); cam.position.set(0, 0, dist); group.rotation.set(0, 0, 0);
      const n3 = $('#brain3d-n'); if (n3) n3.textContent = `${fmt(D.n)} neurons at measured positions (${fmt(D.pts.length)} shown as background) · drag to rotate · wheel to zoom`;
    }
    build();
    // chips
    const chips = $('#brain3d-chips'); if (chips) { chips.innerHTML = ''; Object.keys(HI).forEach(k => { const b = document.createElement('button'); b.className = 'chip'; b.style.setProperty('--dot', HI[k][0]); b.setAttribute('aria-pressed', on[k]); b.innerHTML = `<i></i>${HI[k][1]}`; b.addEventListener('click', () => { on[k] = !on[k]; b.setAttribute('aria-pressed', on[k]); build(); }); chips.appendChild(b); }); }
    $$('#brain3d-seg button').forEach(b => b.addEventListener('click', () => { which = b.dataset.brain; $$('#brain3d-seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); }));
    // interaction
    let drag = false, lx = 0, ly = 0, auto = !reduce, rx = 0.15, ry = 0;
    const dom = renderer.domElement; dom.style.cursor = 'grab'; dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', e => { drag = true; auto = false; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => { if (!drag) return; ry += (e.clientX - lx) * 0.008; rx += (e.clientY - ly) * 0.008; lx = e.clientX; ly = e.clientY; });
    dom.addEventListener('pointerup', () => drag = false); dom.addEventListener('pointercancel', () => drag = false);
    dom.addEventListener('wheel', e => { e.preventDefault(); dist *= e.deltaY > 0 ? 1.08 : 0.92; cam.position.set(0, 0, dist); }, { passive: false });
    function loop() { if (auto) ry += 0.003; group.rotation.x = rx; group.rotation.y = ry; renderer.render(scene, cam); requestAnimationFrame(loop); }
    loop();
  });

  /* ---------- 3D flight replay (three.js) ---------- */
  guard('flight3d', function flight3d() {
    const host = $('#flight3d'); if (!host || !window.THREE || !FB.loom) return;
    const THREE = window.THREE; let key = 'real_30'; let frame = 0, last = 0, playing = !reduce;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x111111); host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x111111, 12, 30);
    const cam = new THREE.PerspectiveCamera(45, 1.78, 0.1, 100);
    fitRenderer(host, renderer, cam, 0.56);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 8, 4); scene.add(sun);
    const grid = new THREE.GridHelper(20, 20, 0x2a2a2a, 0x1c1c1c); scene.add(grid);
    // drone
    const drone = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0xe6e6e6 })); drone.add(body);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.03), new THREE.MeshStandardMaterial({ color: 0x777777 })); arm.rotation.y = Math.atan2(b, a); arm.position.set(a * 0.12, 0, b * 0.12); drone.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24), new THREE.MeshStandardMaterial({ color: 0xe63946, transparent: true, opacity: 0.55 })); rotor.position.set(a * 0.24, 0.03, b * 0.24); drone.add(rotor); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xe63946 })); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0, -0.18); drone.add(nose); scene.add(drone);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, wireframe: false })); scene.add(sphere);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);
    const trailGeo = new THREE.BufferGeometry(); const trailPos = new Float32Array(200 * 3); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xe63946 })); scene.add(trail);
    const W2T = (x, y, z) => [-y, z, -x];
    const run = () => FB.loom[key];
    function draw() {
      const d = run(); const i = Math.min(frame, d.t.length - 1); const [X, Y, Z] = W2T(d.x[i], d.y[i], d.z[i]); drone.position.set(X, Y, Z);
      drone.rotation.set(0, d.yaw[i] * Math.PI / 180, -d.roll[i] * Math.PI / 180, 'YXZ'); shadow.position.set(X, 0.01, Z);
      const a = d.az * Math.PI / 180, t = d.t[i]; const ox = 6 * Math.cos(a) - 2 * t * Math.cos(a), oy = 6 * Math.sin(a) - 2 * t * Math.sin(a); const [SX, SY, SZ] = W2T(ox, oy, 2.0); sphere.position.set(SX, SY, SZ);
      for (let k = 0; k <= i; k++) { const [px, py, pz] = W2T(d.x[k], d.y[k], d.z[k]); trailPos[k * 3] = px; trailPos[k * 3 + 1] = py; trailPos[k * 3 + 2] = pz; } trailGeo.setDrawRange(0, i + 1); trailGeo.attributes.position.needsUpdate = true;
      cam.position.set(X * 0.3 + 4.5, 4.2, Z * 0.3 + 6.5); cam.lookAt(X * 0.6, 1.4, Z * 0.6);
      const lab = $('#flight3d-time'); if (lab) lab.textContent = `t = ${t.toFixed(2)} s · distance ${Math.hypot(ox - d.x[i], oy - d.y[i]).toFixed(2)} m · bank ${d.roll[i].toFixed(0)}°`;
      renderer.render(scene, cam);
    }
    function loop(ts) { if (playing && ts - last > 40) { last = ts; frame = (frame + 1) % run().t.length; draw(); } requestAnimationFrame(loop); }
    $$('#flight3d-seg button').forEach(b => b.addEventListener('click', () => { key = b.dataset.key; $$('#flight3d-seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); frame = 0; draw(); }));
    const pb = $('#flight3d-play'); if (pb) pb.addEventListener('click', () => { playing = !playing; pb.textContent = playing ? 'Pause' : 'Play'; });
    if (reduce) { frame = 60; if (pb) pb.textContent = 'Play'; }
    draw(); requestAnimationFrame(loop);
  });
})();
