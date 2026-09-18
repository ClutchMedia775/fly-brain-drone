/* Fly Brain Drone — navigation aids, video cards and the illustrative diagrams. */
(() => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- iconography: section badges, chapter grid, card icons ---------- */
  (function icons() {
    const ico = (id, cls = '') => `<span class="ico-badge ${cls}"><svg class="ico"><use href="#${id}"/></svg></span>`;
    const SEC = { idea: ['i-bulb', 'teal', 'The idea', 'The smallest fully mapped brain, run as a simulation'], pipeline: ['i-chip', 'amber', 'How it works', 'Real biology in the middle, engineering at the edges'], map: ['i-map', 'teal', 'Brain map', 'Where the circuit lives, neuron by neuron'], exp1: ['i-scale', 'red', 'Left vs right', 'Does the wiring know which side a threat is on?'], exp2: ['i-target', 'red', 'Dodge', 'A ball flies at the drone. Watch it bank away'], replay3d: ['i-cube', 'blue', '3D replay', 'The dodge from the logs, in three dimensions'], exp3: ['i-compass', 'red', 'Heading', 'The optomotor reflex holds the drone straight'], control: ['i-shuffle', 'amber', 'Control', 'Shuffle the wiring and the behaviour dies'], motion: ['i-expand', 'teal', 'Round two', 'The brain computes looming from motion by itself'], twobrains: ['i-layers', 'amber', 'Two brains', 'A second fly, with its nerve cord, agrees'], stress: ['i-lab', 'red', 'Stress test', 'Hundreds of flights, three controls, ablations'], roadmap: ['i-flag', 'blue', 'Next', 'From simulation to a palm-sized drone'], meaning: ['i-spark', 'red', 'What it means', 'Why this matters and what it does not show'], method: ['i-list', 'teal', 'Method', 'Numbers, parameters, notation'], links: ['i-link', 'blue', 'Links', 'Videos and pages from the people who built the data'], sources: ['i-book', 'amber', 'Sources', 'Every paper and dataset behind the page'] };
    // eyebrow badges
    Object.keys(SEC).forEach(id => { const s = document.getElementById(id); const e = s && s.querySelector('.eyebrow'); if (e && !e.querySelector('.ico-badge')) e.insertAdjacentHTML('beforeend', ico(SEC[id][0], SEC[id][1])); });
    // chapter grid
    const ch = $('#chapters'); if (ch) { let n = 0; ch.innerHTML = Object.keys(SEC).map(id => { n++; const [i, c, t, d] = SEC[id]; return `<a class="chapter" href="#${id}">${ico(i, c)}<span class="n">${String(n).padStart(2, '0')}</span><span class="t">${t}</span><span class="d">${d}</span></a>`; }).join(''); }
    // card icons by heading text
    const CARD = { 'Eyes': ['i-eye', 'teal'], 'Brain': ['i-brain', 'red'], 'Wings': ['i-drone', 'blue'], 'Retina': ['i-eye', 'amber'], 'Connectome': ['i-brain', 'red'], 'Bridge + autopilot': ['i-drone', 'amber'],
      'Function survives extreme simplification': ['i-bolt', 'red'], 'The signs were right without tuning': ['i-scale', 'teal'], 'Two reflexes, one read-out': ['i-compass', 'amber'], 'A testable model of the fly': ['i-lab', 'blue'], 'The detector is in the wiring too': ['i-expand', 'teal'], 'It fails the way a reflex fails': ['i-shuffle', 'amber'],
      'Pixels in, not geometry': ['i-camera', 'teal'], 'Real time': ['i-chip', 'amber'], 'Hardware in the loop': ['i-drone', 'red'], 'Preregistered trials': ['i-clipboard', 'blue'] };
    $$('.cell > h3, .finding > h3').forEach(h => { const k = h.textContent.trim(); const c = CARD[k]; if (!c) return; const card = h.parentElement;
      if (card.classList.contains('finding')) { const head = document.createElement('div'); head.className = 'fhead'; const idx = [...card.parentElement.children].indexOf(card) + 1; head.innerHTML = ico(c[0], c[1]); card.insertBefore(head, h); head.appendChild(h); h.style.margin = '0'; }
      else { const num = card.querySelector('.num'); const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem'; row.innerHTML = ico(c[0], c[1]); if (num) { row.appendChild(num); num.style.fontSize = '2.2rem'; } card.insertBefore(row, card.firstChild); const tag = card.querySelector('.tag'); if (tag) row.appendChild(tag); } });
  })();

  /* ---------- reading progress + side rail + back to top ---------- */
  (function navAids() {
    const bar = $('#progress'), rail = $('#rail'), top = $('#totop'); const secs = $$('section.block[id]').filter(s => s.id !== 'contents');
    if (rail) { rail.innerHTML = secs.map(s => { const lab = (s.querySelector('.eyebrow .label') || {}).textContent || s.id; return `<a href="#${s.id}" aria-label="${lab}"><span>${lab.replace(/^\d\d · /, '')}</span></a>`; }).join(''); }
    const dots = rail ? $$('a', rail) : [];
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { const i = secs.indexOf(e.target); dots.forEach((d, j) => d.classList.toggle('on', j === i)); } }); }, { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach(s => io.observe(s));
    const onScroll = () => { const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); if (bar) bar.style.width = (p * 100).toFixed(2) + '%'; if (top) top.classList.toggle('show', h.scrollTop > 900); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    if (top) top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  })();

  /* ---------- click-to-play YouTube cards (no iframe until asked) ---------- */
  (function videos() {
    $$('.video .frame[data-yt]').forEach(f => {
      const id = f.dataset.yt; const img = f.querySelector('img'); if (img && !img.src) img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      f.addEventListener('click', () => { const ifr = document.createElement('iframe'); ifr.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`; ifr.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'; ifr.allowFullscreen = true; ifr.title = f.dataset.title || 'video'; f.innerHTML = ''; f.appendChild(ifr); });
    });
  })();

  /* ---------- shuffle illustration: the same nodes, real vs random targets ---------- */
  (function shuffleDiagram() {
    const cv = $('#shuffle-diagram'); if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 2); const w = cv.parentElement.clientWidth || 600, h = Math.round(w * 0.46); cv.width = w * dpr; cv.height = h * dpr; cv.style.width = '100%'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = 26, half = w / 2;
    const layout = (ox) => Array.from({ length: N }, (_, i) => { const col = i % 3, row = Math.floor(i / 3); return { x: ox + 40 + col * ((half - 80) / 2) + (rnd() - .5) * 18, y: 30 + row * ((h - 70) / 8) + (rnd() - .5) * 10, c: col }; });
    const draw = (ox, title, shuffled) => {
      seed = 7; const P = layout(ox); const edges = [];
      P.forEach((p, i) => { if (p.c < 2) { const targets = P.map((q, j) => j).filter(j => P[j].c === p.c + 1); for (let k = 0; k < 2; k++) edges.push([i, targets[Math.floor(rnd() * targets.length)]]); } });
      if (shuffled) { const tg = edges.map(e => e[1]); for (let i = tg.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tg[i], tg[j]] = [tg[j], tg[i]]; } edges.forEach((e, i) => e[1] = tg[i]); }
      ctx.lineWidth = 1.2; edges.forEach(([a, b]) => { ctx.strokeStyle = shuffled ? 'rgba(191,138,16,.55)' : 'rgba(46,159,191,.6)'; ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.bezierCurveTo(P[a].x + 40, P[a].y, P[b].x - 40, P[b].y, P[b].x, P[b].y); ctx.stroke(); });
      P.forEach(p => { ctx.fillStyle = ['#2e9fbf', '#d9d9d9', '#e63946'][p.c]; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#ffffff'; ctx.font = '600 11px Inter'; ctx.fillText(title, ox + 16, h - 12);
      ['eye', 'brain', 'command'].forEach((t, i) => { ctx.fillStyle = '#6f6f6f'; ctx.font = '9px Inter'; ctx.fillText(t.toUpperCase(), ox + 32 + i * ((half - 80) / 2), 16); });
    };
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); draw(0, 'Real wiring: each cell keeps its partners', false); ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(half, 10); ctx.lineTo(half, h - 10); ctx.stroke(); draw(half, 'Shuffled: same cells, same counts, random partners', true);
  })();
})();
