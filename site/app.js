/* Fly Brain Drone — page logic: hero replay, brain map, charts, flight lab, optomotor replay. */
(() => {
  const FB = window.FB || {};
  const C = { ink: '#0b0b0b', coal: '#111111', fog: '#a5a5a5', white: '#ffffff', accent: '#e63946',
    real: '#e63946', nobrain: '#5a7ee0', shuffle: '#bf8a10', shuffle2: '#8a6410', left: '#2e9fbf', right: '#d4652f', grid: '#202020' };
  const CLS = ['#2e9fbf', '#5ad1e6', '#ffffff', '#e63946', '#a5a5a5']; // optic, visual projection, central, descending, other
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  /* ---------- canvas helpers ---------- */
  function fit(cv, aspect) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (aspect) cv.style.width = '100%';
    const w = (aspect ? cv.parentElement.clientWidth : cv.clientWidth) || cv.parentElement.clientWidth || 600;
    const h = aspect ? Math.round(w / aspect) : (cv.clientHeight || 400);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  const sprites = {};
  function sprite(color, r = 10) {
    const k = color + r; if (sprites[k]) return sprites[k];
    const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d');
    const rg = g.createRadialGradient(r, r, 0, r, r, r); rg.addColorStop(0, color); rg.addColorStop(0.35, color); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, r * 2, r * 2); return (sprites[k] = c);
  }
  const brainImg = new Image(); brainImg.src = 'img/brain_frontal.png';
  const onImg = (fn) => brainImg.complete && brainImg.naturalWidth ? fn() : brainImg.addEventListener('load', fn, { once: true });

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  const showTip = (html, x, y) => { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1; };
  const hideTip = () => { tip.style.opacity = 0; };

  /* ---------- fills ---------- */
  const M = FB.brain_meta || {};
  const fills = {
    n_neurons: fmt(M.n_neurons), n_edges: (M.n_edges / 1e6).toFixed(2) + 'M', n_synapses: (M.n_synapses / 1e6).toFixed(1) + 'M',
    p1_dn_left: FB.phase1 ? fmt(FB.phase1.dn_active.LPLC2_L) : '92', p1_dn_total: M.super_class_counts ? fmt(M.super_class_counts.descending) : '1,299',
    opto_nobrain: FB.opto ? fmt(FB.opto.nobrain.total_yaw) + '°' : '', opto_real: FB.opto ? fmt(FB.opto.real.total_yaw) + '°' : '',
    opto_shuffle1: FB.opto ? fmt(FB.opto.shuffle1.total_yaw) + '°' : '', opto_shuffle2: FB.opto ? fmt(FB.opto.shuffle2.total_yaw) + '°' : '',
  };
  if (FB.loom) { const keys = Object.keys(FB.loom).filter(k => k.startsWith('real_')); fills.evade_ratio = keys.filter(k => FB.loom[k].min_dist > 0.3).length + ' / ' + keys.length; }
  $$('[data-fill]').forEach(e => { const v = fills[e.dataset.fill]; if (v) e.textContent = v; });

  /* ---------- mobile menu ---------- */
  (function menu() {
    const nav = $('#nav'), btn = $('#menu-btn'); if (!nav || !btn) return;
    const set = (open) => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
    btn.addEventListener('click', () => set(!nav.classList.contains('open')));
    $$('#nav-list a').forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  })();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 });
  $$('.reveal').forEach(e => io.observe(e));

  /* =====================================================================
     HERO — brain image + looping activity replay of the left-looming run
     ===================================================================== */
  (function hero() {
    const bg = $('#hero-bg'), fx = $('#hero-fx'); if (!bg || !FB.act_loom_real) return;
    let geo, ctxB, ctxF, w, h, frame = 0, last = 0, pause = 0;
    const frames = FB.act_loom_real;
    function layout() {
      ({ ctx: ctxB, w, h } = fit(bg)); ({ ctx: ctxF } = fit(fx));
      const s = Math.max(w / M.W, h / M.H) * 1.05; const ox = (w - M.W * s) / 2, oy = (h - M.H * s) / 2 - h * 0.06;
      geo = { s, ox, oy };
      ctxB.clearRect(0, 0, w, h); ctxB.globalAlpha = 0.9; ctxB.drawImage(brainImg, ox, oy, M.W * s, M.H * s);
      ctxF.clearRect(0, 0, w, h);
    }
    function draw() {
      ctxF.globalCompositeOperation = 'destination-out'; ctxF.fillStyle = 'rgba(0,0,0,0.22)'; ctxF.fillRect(0, 0, w, h);
      ctxF.globalCompositeOperation = 'lighter';
      const pts = frames[frame]; const r = Math.max(3.5, 4 * geo.s);
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; const x = geo.ox + p[0] * geo.s, y = geo.oy + p[1] * geo.s; ctxF.drawImage(sprite(CLS[p[2]], 12), x - r, y - r, r * 2, r * 2); }
    }
    function loop(ts) {
      if (ts - last > 60) { last = ts; if (pause > 0) pause--; else { frame++; if (frame >= 95) { frame = 0; pause = 20; } draw(); } }
      requestAnimationFrame(loop);
    }
    onImg(() => { layout(); if (reduce) { frame = 20; draw(); } else requestAnimationFrame(loop); });
    addEventListener('resize', () => geo && layout());
  })();

  /* =====================================================================
     BRAIN MAP — static image with toggleable cell-type overlays
     ===================================================================== */
  (function brainMap() {
    const cv = $('#map-canvas'); if (!cv || !FB.groups) return;
    const G = FB.groups;
    const layers = [
      { id: 'lplc2', name: 'LPLC2 looming', color: C.left, groups: ['LPLC2_left', 'LPLC2_right'], on: true, r: 2.2 },
      { id: 'lc4', name: 'LC4 looming', color: '#5ad1e6', groups: ['LC4_left', 'LC4_right'], on: true, r: 2.2 },
      { id: 't4t5', name: 'T4 / T5 motion (sample)', color: '#7a9aa8', groups: ['T4T5_left', 'T4T5_right'], on: false, r: 1.4 },
      { id: 'hsvs', name: 'HS / VS wide-field', color: '#ffffff', groups: ['HSVS_left', 'HSVS_right'], on: false, r: 3 },
      { id: 'dn', name: 'All descending neurons', color: '#8d8d8d', groups: ['DN_all_left', 'DN_all_right'], on: true, r: 1.6 },
      { id: 'gf', name: 'Giant fiber DNp01', color: C.accent, groups: ['DNp01_left', 'DNp01_right'], on: true, r: 5, label: 'DNp01' },
      { id: 'dna02', name: 'DNa02 steering', color: C.right, groups: ['DNa02_left', 'DNa02_right'], on: true, r: 4.5, label: 'DNa02' },
      { id: 'dnb01', name: 'DNa01 / DNb01 steering', color: '#e8a075', groups: ['DNa01_left', 'DNa01_right', 'DNb01_left', 'DNb01_right'], on: false, r: 4 },
      { id: 'dng02', name: 'DNg02 wing amplitude', color: C.shuffle, groups: ['DNg02_left', 'DNg02_right'], on: false, r: 3.5 },
      { id: 'dnp', name: 'DNp03 / DNp11 saccade', color: '#ff8e99', groups: ['DNp03_left', 'DNp03_right', 'DNp11_left', 'DNp11_right'], on: false, r: 4, label: 'DNp03/11' },
    ];
    const chips = $('#map-chips');
    layers.forEach(L => {
      const b = document.createElement('button'); b.className = 'chip'; b.style.setProperty('--dot', L.color); b.setAttribute('aria-pressed', L.on);
      b.innerHTML = `<i></i>${L.name}`; b.addEventListener('click', () => { L.on = !L.on; b.setAttribute('aria-pressed', L.on); draw(); }); chips.appendChild(b);
    });
    let ctx, w, h, s;
    function draw() {
      ({ ctx, w, h } = fit(cv, M.W / M.H)); s = w / M.W;
      ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h); ctx.drawImage(brainImg, 0, 0, w, h);
      ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = C.fog; ctx.letterSpacing = '2px';
      ctx.fillText((M.left_is_image_left ? "FLY'S LEFT" : "FLY'S RIGHT"), 14, 22); ctx.textAlign = 'right'; ctx.fillText((M.left_is_image_left ? "FLY'S RIGHT" : "FLY'S LEFT"), w - 14, 22); ctx.textAlign = 'left';
      ctx.fillText('OPTIC LOBE', 14, h - 14); ctx.textAlign = 'right'; ctx.fillText('OPTIC LOBE', w - 14, h - 14); ctx.textAlign = 'left';
      ctx.globalCompositeOperation = 'lighter';
      layers.filter(L => L.on).forEach(L => {
        L.groups.forEach(g => (G[g] || []).forEach(p => {
          const x = p[0] * s, y = p[1] * s, r = L.r * Math.max(0.7, s * 1.6);
          ctx.drawImage(sprite(L.color, 12), x - r * 2, y - r * 2, r * 4, r * 4);
          ctx.fillStyle = L.color; ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, r * 0.45), 0, 7); ctx.fill();
        }));
      });
      ctx.globalCompositeOperation = 'source-over';
      layers.filter(L => L.on && L.label).forEach(L => {
        L.groups.slice(0, 2).forEach((g, i) => { const p = (G[g] || [])[0]; if (!p) return; const x = p[0] * s, y = p[1] * s; const dx = i === 0 ? -70 : 70;
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + 40); ctx.stroke();
          ctx.fillStyle = C.white; ctx.textAlign = i === 0 ? 'right' : 'left'; ctx.font = '500 11px Inter, sans-serif'; ctx.fillText(L.label + (g.endsWith('left') ? ' L' : ' R'), x + dx + (i === 0 ? -4 : 4), y + 44); });
      });
      ctx.textAlign = 'left';
    }
    onImg(draw); addEventListener('resize', draw);
  })();

  /* =====================================================================
     PIPELINE diagram (SVG)
     ===================================================================== */
  (function pipeline() {
    const host = $('#pipeline-svg'); if (!host) return;
    const W = 1100, H = 300; const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pipe', role: 'img', 'aria-label': 'Pipeline: retina model to connectome to bridge to autopilot to drone, with drone state feeding back to the retina' });
    const boxes = [
      { x: 20, w: 190, t: 'RETINA MODEL', s: 'geometry → firing rates', tag: 'engineered', c: C.shuffle },
      { x: 250, w: 260, t: 'FLYWIRE CONNECTOME', s: '138,639 LIF neurons · untouched', tag: 'real', c: C.accent },
      { x: 550, w: 190, t: 'BRIDGE', s: '8 DN groups → setpoints', tag: 'engineered', c: C.shuffle },
      { x: 780, w: 150, t: 'AUTOPILOT', s: 'attitude PID (nerve cord)', tag: 'engineered', c: C.shuffle },
      { x: 970, w: 110, t: 'DRONE', s: '6-DOF physics', tag: '', c: C.nobrain },
    ];
    const y = 90, bh = 96;
    boxes.forEach(b => {
      el('rect', { x: b.x, y, width: b.w, height: bh, rx: 5, fill: b.c, 'fill-opacity': 0.14, stroke: b.c, 'stroke-width': 1.6 }, svg);
      el('rect', { x: b.x, y, width: 5, height: bh, rx: 2, fill: b.c }, svg);
      const t = el('text', { x: b.x + b.w / 2, y: y + 42, 'text-anchor': 'middle', class: 'strong', style: 'font-family:Bebas Neue,sans-serif;font-size:26px;letter-spacing:1px' }, svg); t.textContent = b.t;
      const s = el('text', { x: b.x + b.w / 2, y: y + 63, 'text-anchor': 'middle', style: 'fill:#e6e6e6;font-size:12px' }, svg); s.textContent = b.s;
      if (b.tag) { const g = el('text', { x: b.x + b.w / 2, y: y + 84, 'text-anchor': 'middle', style: `fill:${b.c};font-size:10px;letter-spacing:3px;font-weight:600` }, svg); g.textContent = b.tag.toUpperCase(); }
    });
    const arrow = (x1, x2, label, col) => {
      el('line', { x1, y1: y + bh / 2, x2: x2 - 8, y2: y + bh / 2, stroke: '#3a3a3a', 'stroke-width': 2 }, svg);
      el('line', { x1, y1: y + bh / 2, x2: x2 - 8, y2: y + bh / 2, stroke: col, 'stroke-width': 2, class: 'flow' }, svg);
      el('path', { d: `M${x2 - 9},${y + bh / 2 - 6} L${x2},${y + bh / 2} L${x2 - 9},${y + bh / 2 + 6} Z`, fill: col }, svg);
      if (label) { const t = el('text', { x: (x1 + x2) / 2, y: y + bh / 2 - 12, 'text-anchor': 'middle', style: `fill:${C.white};font-size:11px;font-weight:500` }, svg); t.textContent = label; }
    };
    arrow(210, 250, 'Poisson spikes', C.left); arrow(510, 550, 'spike counts', C.accent); arrow(740, 780, 'roll · yaw · thrust', C.shuffle); arrow(930, 970, 'torques', C.nobrain);
    // feedback loop
    const fy = y + bh + 60;
    el('path', { d: `M1025,${y + bh} L1025,${fy} L115,${fy} L115,${y + bh + 8}`, fill: 'none', stroke: '#3a3a3a', 'stroke-width': 1.5 }, svg);
    el('path', { d: `M1025,${y + bh} L1025,${fy} L115,${fy} L115,${y + bh + 8}`, fill: 'none', stroke: C.nobrain, 'stroke-width': 1.5, class: 'flow', opacity: .9 }, svg);
    el('path', { d: `M110,${y + bh + 10} L115,${y + bh} L120,${y + bh + 10} Z`, fill: C.nobrain }, svg);
    const fl = el('text', { x: 570, y: fy - 8, 'text-anchor': 'middle', style: `fill:${C.nobrain};font-size:11px;font-weight:500` }, svg); fl.textContent = 'drone position, heading and rotation rate → what the eyes see next (every 20 ms)';
    const t1 = el('text', { x: 20, y: 30, class: 'strong', style: 'font-size:11px;letter-spacing:2px' }, svg); t1.textContent = 'ONE CONTROL TICK · 20 ms simulated · 0.12 s wall';
    host.appendChild(svg);
  })();

  /* =====================================================================
     EXPERIMENT 1 — diverging bar chart of DN rates by side
     ===================================================================== */
  (function exp1() {
    const host = $('#exp1-chart'); if (!host || !FB.phase1) return;
    const P = FB.phase1; let exp = 'LPLC2_L';
    function draw() {
      host.innerHTML = '';
      const types = P.types, rowH = 26, padL = 70, padR = 30, W = 560, H = types.length * rowH + 40, cx = padL + (W - padL - padR) / 2, half = (W - padL - padR) / 2 - 6;
      const max = 200, sc = v => Math.min(v, max) / max * half;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Firing rate of descending neuron types, left copy versus right copy' });
      const g = el('g', { class: 'grid' }, svg);
      [0, 50, 100, 150, 200].forEach(v => { [-1, 1].forEach(d => { const x = cx + d * sc(v); el('line', { x1: x, y1: 20, x2: x, y2: H - 20 }, g); if (v) { const t = el('text', { x, y: H - 6, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v; } }); });
      const t0 = el('text', { x: cx, y: H - 6, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t0.textContent = '0 Hz';
      const lt = el('text', { x: padL, y: 14, style: `fill:${C.left};font-size:9px;letter-spacing:2px` }, svg); lt.textContent = '◀ LEFT COPY';
      const rt = el('text', { x: W - padR, y: 14, 'text-anchor': 'end', style: `fill:${C.right};font-size:9px;letter-spacing:2px` }, svg); rt.textContent = 'RIGHT COPY ▶';
      types.forEach((t, i) => {
        const y = 24 + i * rowH; const [l, r] = P.lat[exp][t];
        const lab = el('text', { x: padL - 8, y: y + 15, 'text-anchor': 'end', class: 'strong', style: 'font-family:ui-monospace,monospace;font-size:11px' }, svg); lab.textContent = t;
        const bl = el('rect', { x: cx - sc(l) - (l ? 1 : 0), y: y + 4, width: sc(l), height: rowH - 10, fill: C.left, class: 'bar' }, svg);
        const br = el('rect', { x: cx + (r ? 1 : 0), y: y + 4, width: sc(r), height: rowH - 10, fill: C.right, class: 'bar' }, svg);
        if (l > 0) { const v = el('text', { x: cx - sc(l) - 5, y: y + 16, 'text-anchor': 'end', style: 'font-size:10px' }, svg); v.textContent = fmt(l); }
        if (r > 0) { const v = el('text', { x: cx + sc(r) + 5, y: y + 16, style: 'font-size:10px' }, svg); v.textContent = fmt(r); }
        const hit = el('rect', { x: padL, y, width: W - padL - padR, height: rowH, class: 'hit' }, svg);
        hit.addEventListener('mousemove', e => showTip(`<b>${t}</b> under ${exp.replace('_L', ' left').replace('_R', ' right')}<br>left copy ${fmt(l, 1)} Hz · right copy ${fmt(r, 1)} Hz<br>LI ${(l + r) ? ((l - r) / (l + r)).toFixed(2) : '—'}`, e.clientX, e.clientY));
        hit.addEventListener('mouseleave', hideTip);
      });
      el('line', { x1: cx, y1: 20, x2: cx, y2: H - 20, stroke: '#444' }, svg);
      host.appendChild(svg);
    }
    $$('#exp1-seg button').forEach(b => b.addEventListener('click', () => { $$('#exp1-seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); exp = b.dataset.exp; draw(); }));
    draw();
  })();

  /* =====================================================================
     FLIGHT LAB — synchronized flight + brain activity replay
     ===================================================================== */
  (function lab() {
    const cvF = $('#lab-flight'), cvB = $('#lab-brain'); if (!cvF || !FB.loom) return;
    let cond = 'real', az = 30, frame = 0, playing = !reduce, last = 0;
    const meterDefs = [['DNa02', 'steering'], ['DNp01', 'giant fiber'], ['DNp11', 'saccade'], ['DNg02', 'wing amplitude']];
    const meters = $('#meters');
    meters.innerHTML = meterDefs.map(([g, d]) => `<div class="meter"><div class="n"><span>${g} <span class="muted">${d}</span></span><span id="mv-${g}">0 / 0 Hz</span></div><div class="bars"><div class="bar"><i id="ml-${g}" style="--dot:${C.left}"></i></div><div class="bar"><i id="mr-${g}" style="--dot:${C.right}"></i></div></div></div>`).join('');
    const run = () => FB.loom[`${cond}_${az}`] || FB.loom[`${cond}_30`];
    const act = () => cond === 'real' && az === 30 ? FB.act_loom_real : cond === 'shuffle1' && az === 30 ? FB.act_loom_shuffle : null;
    const scrub = $('#lab-scrub'), tlab = $('#lab-time');
    function setPressed(id, key, val) { $$(`#${id} button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key]) === String(val))); }
    $$('#lab-cond button').forEach(b => b.addEventListener('click', () => { cond = b.dataset.cond; setPressed('lab-cond', 'cond', cond); frame = 0; caption(); }));
    $$('#lab-az button').forEach(b => b.addEventListener('click', () => { az = +b.dataset.az; if (cond.startsWith('shuffle') && az === 0) az = 30; setPressed('lab-az', 'az', az); frame = 0; caption(); }));
    $('#lab-play').addEventListener('click', () => { playing = !playing; $('#lab-play').textContent = playing ? 'Pause' : 'Play'; });
    scrub.addEventListener('input', () => { frame = +scrub.value; playing = false; $('#lab-play').textContent = 'Play'; drawAll(); });
    function caption() {
      const d = run(); const c = { real: 'the real FlyWire wiring', nobrain: 'no brain in the loop (the drone only holds altitude)', shuffle1: 'the same neurons with randomly re-targeted synapses' }[cond];
      const bearing = { 30: 'from the left', '-30': 'from the right', 0: 'head-on' }[az];
      $('#lab-cap').textContent = `Sphere approaching ${bearing} with ${c}. Closest approach ${d.min_dist.toFixed(2)} m` + (d.min_dist < 0.3 ? ' — collision.' : ' — cleared.') + (act() ? ' Brain panel shows every neuron that spiked in the current 20 ms tick, coloured by region: teal = optic lobe, cyan = visual projection, white = central brain, red = descending.' : ' No per-neuron recording for this run; the brain panel shows the recorded left-bearing run for this condition.');
      $$('#lab-az button').forEach(b => b.disabled = cond.startsWith('shuffle') && b.dataset.az === '0');
    }
    function drawFlight() {
      const { ctx, w, h } = fit(cvF, 1.25); const d = run(); const i = Math.min(frame, d.t.length - 1);
      ctx.fillStyle = C.coal; ctx.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / 8.2, cx = w * 0.5, cy = h * 0.7; const X = (x, y) => [cx - y * sc, cy - x * sc];
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; for (let m = -6; m <= 6; m++) { const [x1, y1] = X(-2, m), [x2, y2] = X(6, m); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); const [a1, b1] = X(m, -6), [a2, b2] = X(m, 6); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      ctx.fillStyle = C.fog; ctx.font = '10px Inter'; ctx.fillText('1 m grid · forward is up', 12, h - 12);
      // obstacle path
      const a = az * Math.PI / 180, t = d.t[i]; const ox = 6 * Math.cos(a) - 2 * t * Math.cos(a), oy = 6 * Math.sin(a) - 2 * t * Math.sin(a);
      const [px0, py0] = X(6 * Math.cos(a), 6 * Math.sin(a)), [px1, py1] = X(-1 * Math.cos(a), -1 * Math.sin(a));
      ctx.setLineDash([4, 6]); ctx.strokeStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke(); ctx.setLineDash([]);
      // trail
      const col = { real: C.real, nobrain: C.nobrain, shuffle1: C.shuffle }[cond];
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k <= i; k++) { const [x, y] = X(d.x[k], d.y[k]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      // obstacle
      const [obx, oby] = X(ox, oy); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(obx, oby, 0.3 * sc, 0, 7); ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 1.5; ctx.stroke();
      // drone
      const [dx, dy] = X(d.x[i], d.y[i]); const yaw = d.yaw[i] * Math.PI / 180; ctx.save(); ctx.translate(dx, dy); ctx.rotate(-yaw);
      ctx.strokeStyle = C.white; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke();
      [[-10, -10], [10, 10], [-10, 10], [10, -10]].forEach(([x, y]) => { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.stroke(); });
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(5, -8); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill(); ctx.restore();
      // sight cone hint
      if (d.drive && d.drive[i] > 0) { ctx.strokeStyle = 'rgba(46,159,191,.6)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(obx, oby); ctx.stroke(); ctx.setLineDash([]); }
      // readouts
      const dist = Math.hypot(ox - d.x[i], oy - d.y[i]);
      $('#ro-dist').textContent = dist.toFixed(2) + ' m'; $('#ro-min').textContent = d.min_dist.toFixed(2) + ' m'; $('#ro-min').style.color = d.min_dist < 0.3 ? C.accent : C.white;
      $('#ro-yaw').textContent = (d.yaw[i] > 0 ? '+' : '') + d.yaw[i].toFixed(0) + '°'; $('#ro-nact').textContent = fmt(d.nact ? d.nact[i] : 0);
      const turn = d.turn ? d.turn[i] : 0; const f = $('#turn-fill'); f.style.left = (turn < 0 ? 50 + turn * 50 : 50) + '%'; f.style.width = Math.abs(turn) * 50 + '%';
      meterDefs.forEach(([g]) => { const l = d[g + '_left'] ? d[g + '_left'][i] : 0, r = d[g + '_right'] ? d[g + '_right'][i] : 0; const mx = g === 'DNp01' ? 160 : 60;
        $(`#ml-${g}`).style.width = Math.min(100, l / mx * 100) + '%'; $(`#mr-${g}`).style.width = Math.min(100, r / mx * 100) + '%'; $(`#mv-${g}`).textContent = `${fmt(l)} / ${fmt(r)} Hz`; });
      tlab.textContent = `t = ${t.toFixed(2)} s`; scrub.value = i;
    }
    let bctx, bw, bh, bs, bInit = false;
    function drawBrain() {
      const A = act(); const { ctx, w, h } = fit(cvB, 1.25); bctx = ctx; bw = w; bh = h;
      ctx.fillStyle = C.coal; ctx.fillRect(0, 0, w, h);
      const s = Math.min(w / M.W, h / M.H) * 0.96, ox = (w - M.W * s) / 2, oy = (h - M.H * s) / 2 + 10; bs = s;
      ctx.globalAlpha = 0.7; ctx.drawImage(brainImg, ox, oy, M.W * s, M.H * s); ctx.globalAlpha = 1;
      if (!A) { ctx.fillStyle = C.fog; ctx.font = '11px Inter'; ctx.fillText('per-neuron recording available for left-bearing runs', 12, 22); }
      const frames = A || (cond === 'nobrain' ? [] : FB.act_loom_real); const pts = frames[Math.min(frame, frames.length - 1)] || [];
      ctx.globalCompositeOperation = 'lighter'; const r = Math.max(4, 6 * s * 2);
      for (let k = 0; k < pts.length; k++) { const p = pts[k]; ctx.drawImage(sprite(CLS[p[2]], 12), ox + p[0] * s - r, oy + p[1] * s - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = C.fog; ctx.font = '10px Inter'; ctx.fillText(`${pts.length} neurons spiking`, 12, h - 12);
    }
    function drawAll() { drawFlight(); drawBrain(); }
    function loop(ts) { if (playing && ts - last > 40) { last = ts; frame = (frame + 1) % run().t.length; drawAll(); } requestAnimationFrame(loop); }
    caption(); onImg(() => { drawAll(); requestAnimationFrame(loop); }); addEventListener('resize', drawAll);
    if (reduce) { playing = false; $('#lab-play').textContent = 'Play'; frame = 60; }
  })();

  /* =====================================================================
     EXPERIMENT 2 — closest-approach grouped bars
     ===================================================================== */
  (function exp2() {
    const host = $('#exp2-chart'); if (!host || !FB.loom) return;
    const L = FB.loom; const rows = [['30', 'From left'], ['-30', 'From right'], ['0', 'Head-on']];
    const series = [['nobrain', 'no brain', C.nobrain], ['real', 'fly brain', C.real], ['shuffle1', 'shuffled #1', C.shuffle], ['shuffle2', 'shuffled #2', C.shuffle2]];
    const W = 560, rowH = 78, padL = 90, padR = 40, H = rows.length * rowH + 40, max = 2.6, sc = v => v / max * (W - padL - padR);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Closest approach in metres by threat bearing and brain condition' });
    const g = el('g', { class: 'grid' }, svg);
    [0.5, 1, 1.5, 2, 2.5].forEach(v => { el('line', { x1: padL + sc(v), y1: 10, x2: padL + sc(v), y2: H - 22 }, g); const t = el('text', { x: padL + sc(v), y: H - 8, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v + ' m'; });
    el('line', { x1: padL + sc(0.3), y1: 10, x2: padL + sc(0.3), y2: H - 22, stroke: '#555', 'stroke-dasharray': '3 4' }, svg);
    const ct = el('text', { x: padL + sc(0.3) + 4, y: 18, style: 'font-size:9px' }, svg); ct.textContent = 'sphere radius';
    rows.forEach(([az, name], i) => {
      const y0 = 26 + i * rowH; const lab = el('text', { x: padL - 10, y: y0 + 30, 'text-anchor': 'end', class: 'strong' }, svg); lab.textContent = name;
      series.forEach(([k, n, col], j) => {
        const d = L[`${k}_${az}`]; const y = y0 + j * 13; if (!d) { const t = el('text', { x: padL + 4, y: y + 9, style: 'font-size:9px;fill:#555' }, svg); t.textContent = n + ': not run'; return; }
        const v = d.min_dist; el('rect', { x: padL, y, width: Math.max(sc(v), 2), height: 11, fill: col, class: 'bar' }, svg);
        const t = el('text', { x: padL + Math.max(sc(v), 2) + 5, y: y + 9, style: 'font-size:10px' }, svg); t.textContent = v < 0.3 ? `${v.toFixed(2)} m · collision` : `${v.toFixed(2)} m`;
        const hit = el('rect', { x: padL, y: y - 1, width: W - padL - padR, height: 13, class: 'hit' }, svg);
        hit.addEventListener('mousemove', e => showTip(`<b>${name} · ${n}</b><br>closest approach ${v.toFixed(2)} m<br>final sideways offset ${d.final_y > 0 ? '+' : ''}${d.final_y.toFixed(2)} m · heading ${d.final_yaw.toFixed(0)}°`, e.clientX, e.clientY));
        hit.addEventListener('mouseleave', hideTip);
      });
    });
    host.appendChild(svg);
  })();

  /* =====================================================================
     EXPERIMENT 3 — optomotor compass replay + heading chart
     ===================================================================== */
  (function exp3() {
    const host = $('#exp3-chart'), cv = $('#opto-compass'); if (!host || !FB.opto) return;
    const O = FB.opto; const series = [['nobrain', 'no brain', C.nobrain], ['real', 'fly brain', C.real], ['shuffle1', 'shuffled #1', C.shuffle], ['shuffle2', 'shuffled #2', C.shuffle2]];
    const n = O.real.t.length; let frame = reduce ? n - 1 : 0, last = 0, playing = !reduce;
    const W = 560, H = 300, padL = 44, padR = 16, padT = 16, padB = 30; const X = t => padL + t / 3 * (W - padL - padR), Y = v => padT + (1 - (v + 10) / 130) * (H - padT - padB);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Heading over time for each brain condition' });
    el('rect', { x: X(0.5), y: padT, width: X(1.5) - X(0.5), height: H - padT - padB, fill: 'rgba(191,138,16,.12)' }, svg);
    const dl = el('text', { x: X(1), y: padT + 12, 'text-anchor': 'middle', style: 'font-size:9px;letter-spacing:2px' }, svg); dl.textContent = 'DISTURBANCE';
    const g = el('g', { class: 'grid' }, svg);
    [0, 30, 60, 90, 120].forEach(v => { el('line', { x1: padL, y1: Y(v), x2: W - padR, y2: Y(v) }, g); const t = el('text', { x: padL - 6, y: Y(v) + 4, 'text-anchor': 'end', style: 'font-size:9px' }, svg); t.textContent = v + '°'; });
    [0, 1, 2, 3].forEach(v => { const t = el('text', { x: X(v), y: H - 10, 'text-anchor': 'middle', style: 'font-size:9px' }, svg); t.textContent = v + ' s'; });
    const paths = {};
    series.forEach(([k, name, col]) => { paths[k] = el('path', { d: '', fill: 'none', stroke: col, 'stroke-width': 2 }, svg); });
    // end labels, pushed apart so they never overlap
    const labs = series.map(([k, name, col]) => ({ k, name, col, y: Y(O[k].total_yaw) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 12) labs[i].y = labs[i - 1].y + 12;
    labs.forEach(l => { const t = el('text', { x: W - padR - 2, y: l.y + 3, 'text-anchor': 'end', style: `fill:${l.col};font-size:10px;paint-order:stroke;stroke:#111;stroke-width:3px` }, svg); t.textContent = `${l.name} · ${O[l.k].total_yaw.toFixed(0)}°`; });
    const cursor = el('line', { x1: X(0), y1: padT, x2: X(0), y2: H - padB, stroke: '#666', 'stroke-dasharray': '3 3' }, svg);
    const yl = el('text', { x: padL, y: padT - 4, style: 'font-size:9px;letter-spacing:2px' }, svg); yl.textContent = 'HEADING · + = LEFT';
    const hit = el('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, class: 'hit' }, svg);
    hit.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const t = Math.max(0, Math.min(3, (e.clientX - r.left) / r.width * W - padL) / (W - padL - padR) * 3); const i = Math.min(n - 1, Math.round(t / 3 * (n - 1)));
      showTip(`<b>t = ${O.real.t[i].toFixed(2)} s</b><br>` + series.map(([k, name, col]) => `<span style="color:${col}">■</span> ${name}: ${O[k].yaw[i].toFixed(1)}°`).join('<br>'), e.clientX, e.clientY); frame = i; playing = false; draw(); });
    hit.addEventListener('mouseleave', hideTip);
    host.appendChild(svg);
    function draw() {
      series.forEach(([k]) => { const d = O[k]; let s = ''; for (let i = 0; i <= frame; i++) s += (i ? 'L' : 'M') + X(d.t[i]).toFixed(1) + ',' + Y(d.yaw[i]).toFixed(1); paths[k].setAttribute('d', s); });
      cursor.setAttribute('x1', X(O.real.t[frame])); cursor.setAttribute('x2', X(O.real.t[frame]));
      const { ctx, w, h } = fit(cv, 1.25); ctx.fillStyle = C.coal; ctx.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2 + 8, R = Math.min(w, h) * 0.36;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, 7); ctx.stroke();
      ctx.fillStyle = C.fog; ctx.font = '10px Inter'; ctx.textAlign = 'center'; ctx.fillText('START HEADING', cx, cy - R - 8); ctx.textAlign = 'left';
      for (let a = 0; a < 360; a += 30) { const r1 = a % 90 ? R - 5 : R - 10; const rad = (a - 90) * Math.PI / 180; ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1); ctx.lineTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R); ctx.stroke(); }
      const t = O.real.t[frame]; if (t >= 0.5 && t < 1.5) { ctx.fillStyle = 'rgba(191,138,16,.9)'; ctx.font = '600 10px Inter'; ctx.fillText('◟ TORQUE PUSHING LEFT', cx - R, cy + R + 22); }
      series.forEach(([k, name, col]) => { const yaw = O[k].yaw[frame] * Math.PI / 180; const rad = -Math.PI / 2 - yaw; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rad) * R * 0.92, cy + Math.sin(rad) * R * 0.92); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + Math.cos(rad) * R * 0.92, cy + Math.sin(rad) * R * 0.92, 5, 0, 7); ctx.fill(); });
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
      ctx.fillStyle = C.fog; ctx.font = '10px Inter'; ctx.fillText(`t = ${t.toFixed(2)} s`, 12, h - 12);
    }
    function loop(ts) { if (playing && ts - last > 45) { last = ts; frame++; if (frame >= n) { frame = n - 1; playing = false; } draw(); } requestAnimationFrame(loop); }
    $('#opto-play').addEventListener('click', () => { frame = 0; playing = true; });
    draw(); requestAnimationFrame(loop); addEventListener('resize', draw);
    const cvObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && frame === 0) playing = !reduce; }), { threshold: 0.4 }); cvObs.observe(cv);
  })();

  /* =====================================================================
     CONTROL table
     ===================================================================== */
  (function control() {
    const tb = $('#control-table'); if (!tb || !FB.loom) return;
    const L = FB.loom, O = FB.opto;
    const row = (name, k, col) => `<tr><td><span style="color:${col}">■</span> ${name}</td>` +
      ['30', '-30'].map(az => { const d = L[`${k}_${az}`]; return `<td class="num">${d ? d.min_dist.toFixed(2) + (d.min_dist < 0.3 ? ' ✕' : '') : '—'}</td>`; }).join('') +
      `<td class="num">${O[k] ? O[k].total_yaw.toFixed(0) + '°' : '—'}</td><td class="num">${O[k] ? fmt(Math.max(...O[k].nact)) : '—'}</td></tr>`;
    tb.innerHTML = `<tr><th>Brain</th><th class="num">Closest, left threat</th><th class="num">Closest, right threat</th><th class="num">Yaw drift</th><th class="num">Peak neurons active</th></tr>` +
      row('No brain', 'nobrain', C.nobrain) + row('Real wiring', 'real', C.real) + row('Shuffled #1', 'shuffle1', C.shuffle) + row('Shuffled #2', 'shuffle2', C.shuffle2) +
      `<tr><td colspan="5" class="muted" style="font-size:.78rem">Distances in metres; ✕ marks a collision (closer than the 0.3 m sphere radius). Yaw drift is the heading 1.5 s after the disturbance ends. Peak neurons active is during the optomotor run.</td></tr>`;
  })();
})();
