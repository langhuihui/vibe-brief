/* ==========================================================================
   Scroll-scrubbed engine (scroll.html)
   ---------------------------------------------------------------------------
   The stage stays pinned. Scroll position is mapped to a continuous timeline
   t ∈ [0, N-1]; every authored CSS entrance animation (.a / .pop / .draw /
   bars / chains / word cloud …) is paused and its currentTime is driven by t,
   so scrolling plays the choreography forward and scrolling back rewinds it.
   Neighbouring scenes overlap: the outgoing scene lifts and fades while the
   incoming scene's choreography plays — no page breaks.

   Runs after the shared engine prelude, so it can use:
   stage, slides, staticMode, eraName, eraCol, chapters, chapBox, fit,
   cur, timers, clearTimers.
   ========================================================================== */
document.documentElement.classList.add('scrub');
const N = slides.length;
const HOLD = 0.34;            /* share of each step where the scene simply holds */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = x => 1 - Math.pow(1 - x, 3);
const ERA_LABEL = { '2023': '2023', '2024': '2024', '2025': '2025', '2026': '2026', all: '', ht: '附' };

/* ---------- scroll space ---------- */
const spacer = document.createElement('div');
spacer.id = 'scrub-space';
document.body.appendChild(spacer);
let STEP = 1, H = 1;
function measure() {
  H = innerHeight;
  STEP = Math.round(H * 1.15);
  spacer.style.height = ((N - 1) * STEP + H) + 'px';
}
/* y → t with a dwell: first HOLD of each step holds the scene, the rest morphs into the next */
function tOf(y) {
  const r = clamp(y / STEP, 0, N - 1), i = Math.floor(r), f = r - i;
  return i >= N - 1 ? N - 1 : i + clamp((f - HOLD) / (1 - HOLD));
}
function yOf(i) { return i * STEP; }

/* ---------- big era numeral behind everything (continuous morph) ---------- */
const big = document.createElement('div');
big.id = 'bigyr';
big.innerHTML = '<span></span><span></span>';
stage.insertBefore(big, document.getElementById('prog'));
const [bigA, bigB] = big.children;

/* ---------- rail: the scrollbar is the timeline ---------- */
const rail = document.createElement('nav');
rail.id = 'rail';
rail.setAttribute('aria-label', '时间轴，可拖动');
rail.innerHTML = '<div class="rt"></div><div class="rf"></div><div class="rl"></div><div class="rh"><i></i><span></span></div>';
document.body.appendChild(rail);
const rt = rail.querySelector('.rt'), rf = rail.querySelector('.rf'), rl = rail.querySelector('.rl'), rh = rail.querySelector('.rh'), rhs = rh.querySelector('span');
(function paintRail() {
  const stops = [];
  slides.forEach((s, i) => {
    const c = eraCol[s.dataset.era || 'all'];
    stops.push(c + ' ' + (i / N * 100).toFixed(2) + '%', c + ' ' + ((i + 1) / N * 100).toFixed(2) + '%');
  });
  rt.style.background = rf.style.background = 'linear-gradient(to bottom,' + stops.join(',') + ')';
  chapters.forEach(c => {
    const i = slides.findIndex(s => s.id === c.id);
    if (i < 0) return;
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = c.label; b.dataset.go = c.id;
    b.style.top = ((i + 0.5) / N * 100) + '%'; b.style.setProperty('--ch', eraCol[c.era]);
    rl.appendChild(b);
  });
})();

/* ---------- hud ---------- */
document.getElementById('hud-n').parentNode.innerHTML = '滚动播放 · 可回滚 · ↑ ↓ 逐页 · <span class="k" id="hud-n"></span> · <a id="to-deck" href="index.html">翻页版 ↗</a>';
const hudNum = document.getElementById('hud-n'), hudEra = document.getElementById('hud-era'), hudTitle = document.getElementById('hud-title');
const glow = document.getElementById('glow'), prog = document.getElementById('prog');

/* ---------- per-scene state: paused CSS animations + JS-driven bits ---------- */
const scene = slides.map(s => ({ s, on: false, anims: [], end: 1, counts: [...s.querySelectorAll('.count')], tws: [...s.querySelectorAll('.tw')] }));
function wake(sc) {
  if (sc.on) return;
  sc.on = true;
  sc.s.classList.add('active');
  /* collect every finite CSS animation the scene just started and take manual control of it */
  sc.anims = sc.s.getAnimations({ subtree: true }).filter(a => {
    const tm = a.effect && a.effect.getComputedTiming();
    return tm && isFinite(tm.endTime) && tm.iterations !== Infinity;
  });
  sc.end = 1;
  sc.anims.forEach(a => { a.pause(); sc.end = Math.max(sc.end, a.effect.getComputedTiming().endTime); });
}
function sleep(sc) {
  if (!sc.on) return;
  sc.on = false;
  sc.anims.forEach(a => a.cancel());
  sc.anims = [];
  sc.s.classList.remove('active');
  sc.s.style.cssText = '';
}
function fmtCount(el, v) {
  const dec = +(el.dataset.dec || 0);
  return (el.dataset.prefix || '') + (dec ? v.toFixed(dec) : String(Math.round(v))) + (el.dataset.suffix || '');
}
/* e: entrance progress 0..1, x: exit progress 0..1 */
function render(sc, e, x, isCur) {
  const s = sc.s;
  const T = e * sc.end;
  for (const a of sc.anims) a.currentTime = T;
  for (const el of sc.counts) el.textContent = fmtCount(el, (+el.dataset.to || 0) * ease(clamp((e - 0.25) / 0.6)));
  for (const el of sc.tws) { const t = el.dataset.text || ''; el.textContent = t.slice(0, Math.round(t.length * clamp((e - 0.3) / 0.6))); }
  if (s.id === 's-prelude') ghost(e);
  /* scene container: quick fade-in so un-animated bits don't pop; lift + shrink + fade on the way out */
  const op = clamp(e / 0.14) * (1 - clamp(x / 0.42));
  const ex = ease(clamp(x / 0.6));
  s.style.opacity = op.toFixed(3);
  s.style.transform = x > 0 ? 'translateY(' + (-ex * 180).toFixed(1) + 'px) scale(' + (1 - ex * 0.08).toFixed(4) + ')' : '';
  s.style.zIndex = isCur ? 3 : 2;
  s.style.pointerEvents = isCur ? 'auto' : 'none';
  s.style.visibility = op > 0.002 ? 'visible' : 'hidden';
}
function ghost(e) {
  const el = document.getElementById('ghostText');
  if (!el) return;
  const key = document.getElementById('tabKey'), chip = document.getElementById('accChip');
  const t = el.dataset.text || '', g = clamp((e - 0.35) / 0.5);
  el.textContent = g > 0 ? t.slice(0, Math.round(t.length * g)) || ' ' : ' ';
  el.classList.toggle('show', g > 0);
  el.classList.toggle('done', g >= 1);
  if (key) key.classList.toggle('flash', g >= 1);
  if (chip) chip.classList.toggle('show', g >= 1);
}

/* ---------- continuous colour ---------- */
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, f) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',') + ')'; }

/* ---------- main update ---------- */
let lastT = -1, ticking = false;
cur = -1;
function update() {
  ticking = false;
  const tt = tOf(scrollY);
  const t = staticMode ? Math.round(tt) : tt;
  if (t === lastT) return;
  lastT = t;
  const i = Math.floor(t), f = t - i;
  const n = f < 0.5 ? i : Math.min(N - 1, i + 1);

  /* scenes: i (outgoing / holding) and i+1 (incoming); everything else asleep */
  scene.forEach((sc, k) => {
    if (k === i) { wake(sc); render(sc, 1, f, k === n); }
    else if (k === i + 1 && f > 0) { wake(sc); render(sc, clamp((f - 0.22) / 0.78), 0, k === n); }
    else if (Math.abs(k - t) > 1.5) sleep(sc);
    else if (sc.on) { sc.s.style.visibility = 'hidden'; sc.s.style.pointerEvents = 'none'; }
  });

  /* era colour + numeral morph continuously between scenes */
  const ea = slides[i].dataset.era || 'all', eb = slides[Math.min(N - 1, i + 1)].dataset.era || 'all';
  const col = ea === eb ? eraCol[ea] : mix(eraCol[ea], eraCol[eb], ease(f));
  glow.style.background = col;
  document.documentElement.style.setProperty('--era', col);
  bigA.textContent = ERA_LABEL[ea];
  bigB.textContent = ERA_LABEL[eb];
  const m = ea === eb ? 0 : ease(f);
  bigA.style.cssText = 'color:' + eraCol[ea] + ';opacity:' + (1 - m) + ';transform:translateY(' + (-m * 160) + 'px)';
  bigB.style.cssText = 'color:' + eraCol[eb] + ';opacity:' + m + ';transform:translateY(' + ((1 - m) * 160) + 'px)';

  /* progress: rail, top bar */
  rf.style.clipPath = 'inset(0 0 ' + ((1 - (t + 0.5) / N) * 100).toFixed(2) + '% 0)';
  rh.style.top = ((t + 0.5) / N * 100) + '%';
  rh.style.setProperty('--ch', col);
  prog.style.width = (t / (N - 1) * 100) + '%';

  if (n !== cur) {
    cur = n;
    const s = slides[n], e = s.dataset.era || 'all';
    hudEra.textContent = eraName[e];
    hudTitle.textContent = s.dataset.title || '';
    hudNum.textContent = String(n + 1).padStart(2, '0') + ' / ' + N;
    rhs.textContent = s.dataset.title || '';
    let active = -1;
    chapters.forEach((c, k) => { const idx = slides.findIndex(x => x.id === c.id); if (idx >= 0 && n >= idx) active = k; });
    [...chapBox.children].forEach((b, k) => b.classList.toggle('on', k === active));
    [...rl.children].forEach(b => b.classList.toggle('on', b.dataset.go === (chapters[active] || {}).id));
    history.replaceState(null, '', '#' + (n + 1));
    document.getElementById('to-deck').href = 'index.html#' + (n + 1);
  }
}
const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
addEventListener('scroll', kick, { passive: true });
addEventListener('resize', () => { const n = Math.max(0, cur); measure(); scrollTo(0, yOf(n)); lastT = -1; kick(); });

/* ---------- navigation ---------- */
function go(n, instant) {
  n = Math.max(0, Math.min(N - 1, n));
  scrollTo({ top: yOf(n), behavior: instant || staticMode ? 'instant' : 'smooth' });
}
window.go = go;
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  const here = Math.round(tOf(scrollY));
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(here + 1); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(here - 1); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(N - 1); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (!g) return;
  const k = slides.findIndex(s => s.id === g.dataset.go);
  if (k >= 0) { e.preventDefault(); go(k); }
});
let dragging = false;
function railTo(cy) {
  const r = rt.getBoundingClientRect();
  const k = clamp((cy - r.top) / r.height) * N - 0.5;
  scrollTo({ top: clamp(k, 0, N - 1) * STEP, behavior: 'instant' });
}
rail.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  dragging = true; rail.classList.add('drag'); rail.setPointerCapture(e.pointerId); railTo(e.clientY);
});
rail.addEventListener('pointermove', e => { if (dragging) railTo(e.clientY); });
rail.addEventListener('pointerup', () => { dragging = false; rail.classList.remove('drag'); });

/* ---------- boot ---------- */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
measure();
function fromHash() { const h = parseInt(location.hash.slice(1)); if (h > 0 && h - 1 !== cur) go(h - 1, true); }
fromHash();
addEventListener('hashchange', fromHash);
update();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastT = -1; update(); });
