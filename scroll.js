/* ==========================================================================
   Scroll engine — replaces the paged engine's navigation part in scroll.html.
   Runs in the same <script> after the shared engine prelude, so it can use:
   slides, staticMode, eraName, eraCol, chapters, chapBox, timers, clearTimers,
   ghostLoop.
   ========================================================================== */
document.documentElement.classList.add('scrolly');
const body = document.body;
['chapters', 'hud', 'glow', 'prog'].forEach(id => body.appendChild(document.getElementById(id)));

/* each slide gets a frame (layout box) and a fit layer (scale + parallax) */
const frames = slides.map(s => {
  const f = document.createElement('div');
  f.className = 'frame';
  const fit = document.createElement('div');
  fit.className = 'fit';
  s.parentNode.insertBefore(f, s);
  f.appendChild(fit);
  fit.appendChild(s);
  f.dataset.era = s.dataset.era || 'all';
  return f;
});
const N = slides.length;

/* ---------- hud ---------- */
const hudR = document.getElementById('hud-n').parentNode;
hudR.innerHTML = '滚动阅读 · ↑ ↓ 逐页 · <span class="k" id="hud-n"></span> · <a id="to-deck" href="index.html">翻页版 ↗</a>';
const hudN = document.getElementById('hud-n'), hudEra = document.getElementById('hud-era'), hudTitle = document.getElementById('hud-title');

/* ---------- rail: the scrollbar is the timeline ---------- */
const rail = document.createElement('nav');
rail.id = 'rail';
rail.setAttribute('aria-label', '时间轴进度，可拖动');
rail.innerHTML = '<div class="rt"></div><div class="rf"></div><div class="rl"></div><div class="rh"><i></i><span></span></div>';
body.appendChild(rail);
const rt = rail.querySelector('.rt'), rf = rail.querySelector('.rf'), rl = rail.querySelector('.rl'), rh = rail.querySelector('.rh'), rhs = rh.querySelector('span');

let W = 0, H = 0, S = 1, FH = 0, maxScroll = 1;
function layout() {
  W = document.documentElement.clientWidth;
  H = innerHeight;
  const gut = W > 900 ? 76 : 14;              /* keep the rail off the content */
  S = Math.min((W - gut) / 1920, H / 1080);
  const sh = 1080 * S;
  FH = Math.round(Math.max(sh, Math.min(H, sh * 1.25)));
  frames.forEach(f => { f.style.height = FH + 'px'; f._ox = (W - gut - 1920 * S) / 2; f._oy = (FH - sh) / 2; });
  maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
  /* rail colour = era of each slide, in scroll order */
  const stops = [];
  frames.forEach((f, i) => {
    const c = eraCol[f.dataset.era];
    const a = (f.offsetTop / maxScroll * 100).toFixed(3), b = (Math.min(1, (f.offsetTop + FH) / maxScroll) * 100).toFixed(3);
    stops.push(c + ' ' + a + '%', c + ' ' + b + '%');
  });
  const g = 'linear-gradient(to bottom,' + stops.join(',') + ')';
  rt.style.background = g; rf.style.background = g;
  /* chapter labels at the scroll position where each chapter starts */
  rl.innerHTML = '';
  chapters.forEach(c => {
    const i = slides.findIndex(s => s.id === c.id);
    if (i < 0) return;
    const p = Math.min(1, frames[i].offsetTop / maxScroll);
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = c.label; b.dataset.go = c.id;
    b.style.top = (p * 100) + '%'; b.style.setProperty('--ch', eraCol[c.era]);
    rl.appendChild(b);
  });
  update(true);
}

/* ---------- activation: replay entrance animations each time a slide enters ---------- */
function countUp(el, s) {
  const to = +el.dataset.to || 0, dec = +(el.dataset.dec || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '', dur = +(el.dataset.dur || 1400);
  const fmt = v => pre + (dec ? v.toFixed(dec) : String(Math.floor(v))) + suf;
  if (staticMode) { el.textContent = pre + (dec ? to.toFixed(dec) : String(to)) + suf; return; }
  const t0 = performance.now(), tok = s._tok;
  (function tick() {
    if (s._tok !== tok) return;
    const p = Math.min(1, (performance.now() - t0) / dur);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })();
}
function typeOut(el, s) {
  const t = el.dataset.text || '';
  if (staticMode) { el.textContent = t; return; }
  el.textContent = '';
  let i = 0;
  const step = () => { el.textContent = t.slice(0, ++i); if (i < t.length) s._t.push(setTimeout(step, 70)); };
  s._t.push(setTimeout(step, +el.dataset.delay || 600));
}
function activate(s) {
  if (s.classList.contains('active')) return;
  s._tok = (s._tok || 0) + 1;
  s._t = [];
  s.classList.add('active');
  s.querySelectorAll('.tw').forEach(el => typeOut(el, s));
  s.querySelectorAll('.count').forEach(el => countUp(el, s));
  if (s.id === 's-prelude') { clearTimers(); ghostLoop(); }
}
function deactivate(s) {
  if (!s.classList.contains('active')) return;
  s._tok = (s._tok || 0) + 1;
  (s._t || []).forEach(clearTimeout);
  s.classList.remove('active');
  if (s.id === 's-prelude') clearTimers();
}

/* ---------- scroll-linked update ---------- */
cur = -1; /* `cur` and `timers` are declared by the shared engine prelude */
let ticking = false;
function setCurrent(n) {
  if (n === cur) return;
  cur = n;
  const s = slides[n], e = s.dataset.era || 'all';
  hudEra.textContent = eraName[e];
  hudTitle.textContent = s.dataset.title || '';
  hudN.textContent = String(n + 1).padStart(2, '0') + ' / ' + N;
  document.getElementById('glow').style.background = eraCol[e];
  document.documentElement.style.setProperty('--era', eraCol[e]);
  rhs.textContent = s.dataset.title || '';
  rh.style.setProperty('--ch', eraCol[e]);
  let active = -1;
  chapters.forEach((c, i) => { const idx = slides.findIndex(x => x.id === c.id); if (idx >= 0 && n >= idx) active = i; });
  [...chapBox.children].forEach((b, i) => b.classList.toggle('on', i === active));
  [...rl.children].forEach(b => b.classList.toggle('on', b.dataset.go === chapters[active]?.id));
  history.replaceState(null, '', '#' + (n + 1));
  document.getElementById('to-deck').href = 'index.html#' + (n + 1);
}
function update(force) {
  ticking = false;
  const y = scrollY, mid = y + H / 2;
  const p = Math.min(1, Math.max(0, y / maxScroll));
  rf.style.clipPath = 'inset(0 0 ' + ((1 - p) * 100).toFixed(2) + '% 0)';
  rh.style.top = (p * 100) + '%';
  document.getElementById('prog').style.width = (p * 100) + '%';
  let best = 0;
  frames.forEach((f, i) => {
    const top = f.offsetTop, bot = top + FH, s = slides[i];
    if (mid >= top) best = i;
    const vis = Math.max(0, Math.min(bot, y + H) - Math.max(top, y)) / FH;
    if (staticMode) { activate(s); }
    else if (vis > 0.3) activate(s);
    else if (vis === 0) deactivate(s);
    if (!force && (bot < y - FH || top > y + H + FH)) return;
    /* continuous change while scrolling: drift, slight zoom, cross-fade */
    const full = FH >= H * 0.9;                 /* one slide per screen (desktop) vs several (phone) */
    const d = staticMode || !full ? 0 : (top + FH / 2 - mid) / FH;
    const ad = Math.min(1, Math.abs(d));
    const k = 1 - ad * 0.06;
    f.firstChild.style.transform = 'translate(' + (f._ox + 960 * S * (1 - k)) + 'px,' + (f._oy + 540 * S * (1 - k) - d * FH * 0.12) + 'px) scale(' + (S * k) + ')';
    s.style.opacity = staticMode ? 1 : (0.1 + 0.9 * Math.max(0, Math.min(1, (vis - 0.12) / 0.6))).toFixed(3);
  });
  setCurrent(best);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => update(false)); } }, { passive: true });
addEventListener('resize', () => { const n = cur; layout(); scrollTo(0, frames[Math.max(0, n)].offsetTop); });

/* ---------- navigation ---------- */
function go(n, instant) {
  n = Math.max(0, Math.min(N - 1, n));
  scrollTo({ top: frames[n].offsetTop, behavior: instant || staticMode ? 'instant' : 'smooth' });
}
window.go = go;
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); go(cur + 1); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(N - 1); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (!g) return;
  const i = slides.findIndex(s => s.id === g.dataset.go);
  if (i >= 0) { e.preventDefault(); go(i); }
});

/* drag the rail like a scrollbar */
let dragging = false;
function railTo(clientY) {
  const r = rt.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
  scrollTo({ top: p * maxScroll, behavior: 'instant' });
}
rail.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  dragging = true; rail.classList.add('drag'); rail.setPointerCapture(e.pointerId); railTo(e.clientY);
});
rail.addEventListener('pointermove', e => { if (dragging) railTo(e.clientY); });
rail.addEventListener('pointerup', () => { dragging = false; rail.classList.remove('drag'); });

/* ---------- boot ---------- */
layout();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const n = cur; layout(); });
function fromHash() { const h = parseInt(location.hash.slice(1)); if (h > 0 && h - 1 !== cur) go(h - 1, true); }
fromHash();
addEventListener('hashchange', fromHash);
update(true);
