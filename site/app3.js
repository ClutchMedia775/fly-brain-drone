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

  /* ---------- collapsible contents ---------- */
  (function toc() {
    const sec = $('#contents'), btn = $('#toc-toggle'); if (!sec || !btn) return;
    const word = btn.querySelector('.toc-word');
    const set = (open) => { sec.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); word.textContent = open ? 'Hide chapters' : 'Show chapters'; };
    btn.addEventListener('click', () => set(!sec.classList.contains('open')));
    $('#chapters').addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  })();

  /* ---------- shuffle illustration (SVG): the same nodes, real vs random targets ---------- */
  (function shuffleDiagram() {
    const host = $('#shuffle-diagram'); if (!host) return;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const W = 640, H = 250, half = W / 2, N = 24, cols = [70, 160, 250];
    const panel = (ox, title, shuffled) => {
      seed = 7; const P = Array.from({ length: N }, (_, i) => ({ x: ox + cols[i % 3] + (rnd() - .5) * 16, y: 44 + Math.floor(i / 3) * 22 + (rnd() - .5) * 8, c: i % 3 }));
      const edges = []; P.forEach((p, i) => { if (p.c < 2) { const t = P.map((q, j) => j).filter(j => P[j].c === p.c + 1); for (let k = 0; k < 2; k++) edges.push([i, t[Math.floor(rnd() * t.length)]]); } });
      if (shuffled) { const tg = edges.map(e => e[1]); for (let i = tg.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tg[i], tg[j]] = [tg[j], tg[i]]; } edges.forEach((e, i) => e[1] = tg[i]); }
      const col = shuffled ? 'rgba(191,138,16,.6)' : 'rgba(46,159,191,.65)';
      return `<g>${edges.map(([a, b]) => `<path d="M${P[a].x.toFixed(1)},${P[a].y.toFixed(1)} C${(P[a].x + 45).toFixed(1)},${P[a].y.toFixed(1)} ${(P[b].x - 45).toFixed(1)},${P[b].y.toFixed(1)} ${P[b].x.toFixed(1)},${P[b].y.toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.2"/>`).join('')}` +
        P.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${['#2e9fbf', '#d9d9d9', '#e63946'][p.c]}"/>`).join('') +
        ['EYE', 'BRAIN', 'COMMAND'].map((t, i) => `<text x="${ox + cols[i]}" y="22" fill="#6f6f6f" font-size="9" letter-spacing="2" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${t}</text>`).join('') +
        `<text x="${ox + half / 2}" y="${H - 12}" fill="#ffffff" font-size="12" font-weight="600" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${title}</text></g>`;
    };
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Real wiring versus shuffled wiring, drawn as a toy network"><rect width="${W}" height="${H}" fill="#111"/><line x1="${half}" y1="12" x2="${half}" y2="${H - 12}" stroke="#262626"/>${panel(0, 'Real wiring', false)}${panel(half, 'Shuffled wiring', true)}</svg>`;
  })();
})();
