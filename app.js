/* DJ Río · scroll films, genre colour maths, 808, paint cursor, i18n, booking. */
(() => {
"use strict";

/* ===== Settings you are expected to change ===== */
// Where booking requests are POSTed as JSON. Empty = not connected: the page
// says plainly that nothing was sent and offers a pre-filled email instead.
const FORM_ENDPOINT = "";
// YouTube id of "Urban Tropics | Río Latin in the City". Empty = the card links
// to youtube.com/@cheapd3lirio/videos instead of embedding.
const YOUTUBE_ID = "";
/* =============================================== */

const qs = new URLSearchParams(location.search);
const FORCE_MUTE = qs.get("mute") === "1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a));

/* ---------- genres: typical tempo + the colour filter applied to every film ---------- */
const GENRES = {
  open:      { hue: 0,    sat: 1.0,  bpm: 120 },
  salsa:     { hue: 85,   sat: 1.15, bpm: 180 },
  merengue:  { hue: 150,  sat: 1.1,  bpm: 150 },
  bachata:   { hue: 40,   sat: 1.0,  bpm: 128 },
  reggaeton: { hue: -130, sat: 1.2,  bpm: 95 },
  house:     { hue: -60,  sat: 1.05, bpm: 124 },
};
let genre = "open";

// The exact matrices the CSS filter functions use (Filter Effects spec), so the
// UI accent goes through the same maths as the paint on the canvases.
function hueMatrix(deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [
    .213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928,
    .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283,
    .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072,
  ];
}
function satMatrix(v) {
  return [
    .213 + .787 * v, .715 - .715 * v, .072 - .072 * v,
    .213 - .213 * v, .715 + .285 * v, .072 - .072 * v,
    .213 - .213 * v, .715 - .715 * v, .072 + .928 * v,
  ];
}
const apply = (m, [r, g, b]) => [
  m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b,
].map(x => Math.round(clamp(x, 0, 255)));
const filterRGB = (rgb, g) => apply(satMatrix(g.sat), apply(hueMatrix(g.hue), rgb));
const hex = rgb => "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");

function parseColor(str) {
  str = str.trim();
  if (str.startsWith("#")) {
    const h = str.length === 4 ? [...str.slice(1)].map(c => c + c).join("") : str.slice(1);
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const m = str.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [59, 20, 102];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255));
}

// Base tones: the logo purple itself (fills) and the same hue lifted for text,
// borders and focus rings on the near-black ground.
const root = document.documentElement;
const brand = parseColor(getComputedStyle(root).getPropertyValue("--rio-purple") || "#35126A");
const [bh, bs] = rgbToHsl(brand);
const TONES = {
  "--accent": hslToRgb([bh, Math.min(.72, bs + .1), .72]),
  "--accent-mid": hslToRgb([bh, Math.min(.62, bs), .5]),
  "--accent-fill": brand,
};

function setGenre(name, announce = true) {
  genre = name; const g = GENRES[name];
  root.style.setProperty("--genre-filter", g.hue === 0 && g.sat === 1 ? "none" : `hue-rotate(${g.hue}deg) saturate(${g.sat})`);
  for (const [k, rgb] of Object.entries(TONES)) root.style.setProperty(k, hex(filterRGB(rgb, g)));
  $$(".chip").forEach(c => c.setAttribute("aria-checked", String(c.dataset.genre === name)));
  $("#genreBpm").textContent = g.bpm;
  if (dropState.hit) $("#bpmValue").textContent = String(g.bpm).padStart(3, "0");
  if (announce) try { localStorage.setItem("rio-genre", name); } catch {}
}
// each chip's swatch is the accent pushed through that genre's filter
$$(".chip").forEach(c => c.style.setProperty("--c", hex(filterRGB(TONES["--accent"], GENRES[c.dataset.genre]))));
$$(".chip").forEach((c, i, all) => {
  c.addEventListener("click", () => setGenre(c.dataset.genre));
  c.addEventListener("keydown", e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return; e.preventDefault();
    const n = all[(i + d + all.length) % all.length]; n.focus(); n.click();
  });
});

/* ---------- frame sequences ---------- */
const isPhone = () => innerWidth <= 860;
const FIT = { // how each film sits in a portrait viewport (fraction of viewport height, vertical anchor)
  drop: { k: .55, y: .985 }, frozen: { k: .6, y: .6 }, set: { k: .62, y: .55 },
};
const SHIFT = { drop: .13, frozen: .15, set: .17 }; // landscape: fraction of width to slide each film right
class Seq {
  constructor(section) {
    this.section = section; this.name = section.dataset.film;
    this.canvas = $("canvas.film", section); this.ctx = this.canvas.getContext("2d");
    this.poster = $(".film__poster", section);
    this.frames = []; this.loaded = []; this.cur = -1; this.p = 0; this.ready = false; this.inflight = 0; this.target = 0;
  }
  async init() {
    try {
      this.manifest = await (await fetch(`assets/frames/${this.name}/manifest.json`)).json();
    } catch { return; }
    this.set = isPhone() ? "m" : "d";
    this.count = this.manifest[this.set === "m" ? "mobile" : "desktop"].count;
    this.frames = new Array(this.count); this.loaded = new Array(this.count).fill(false);
    this.resize();
    // coarse to fine: every 32nd frame first so scrubbing works early, then fill in
    const order = [], seen = new Set();
    for (let step = 32; step >= 1; step = step >> 1)
      for (let i = 0; i < this.count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (!seen.has(this.count - 1)) order.splice(1, 0, this.count - 1);
    this.queue = order; this.ready = true;
  }
  pump(n = 4) {
    if (!this.ready) return;
    while (this.inflight < n && this.queue.length) this.load(this.queue.shift());
  }
  load(i) {
    this.inflight++;
    const img = new Image(); img.decoding = "async";
    img.src = `assets/frames/${this.name}/${this.set}/${String(i + 1).padStart(4, "0")}.webp`;
    img.onload = () => { this.frames[i] = img; this.loaded[i] = true; this.inflight--; if (this.cur === -1 || Math.abs(i - this.target) < Math.abs(this.cur - this.target)) this.draw(true); };
    img.onerror = () => { this.inflight--; };
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.cur = -1; this.draw(true);
  }
  nearest(t) {
    for (let d = 0; d < this.count; d++) {
      if (this.loaded[t - d]) return t - d;
      if (this.loaded[t + d]) return t + d;
    }
    return -1;
  }
  setProgress(p) { this.p = p; this.draw(); }
  draw(force) {
    if (!this.ready) return;
    this.target = Math.round(clamp(this.p) * (this.count - 1));
    const i = this.nearest(this.target);
    if (i < 0 || (!force && i === this.cur)) return;
    this.cur = i;
    const img = this.frames[i], iw = img.naturalWidth, ih = img.naturalHeight, { w, h } = this;
    let s, x, y;
    if (w / h >= 1) { // landscape: fit the whole shot (the plates are pure black, so the edge is invisible)
      // and on wide screens slide it right so the copy owns a clean black column on the left
      const shift = w >= 1000 ? (SHIFT[this.name] || 0) : 0;
      s = Math.min(w / iw, h / ih) * (w >= 1000 ? 1 : 1.12);
      x = (w - iw * s) / 2 + shift * w; y = h - ih * s;
      if (this.name === "drop") {
        this.section.style.setProperty("--cone-x", `${Math.round(x + iw * s * .5)}px`);
        this.section.style.setProperty("--logo-y", `${Math.round(Math.max(76, y + ih * s * .1))}px`);
      }
    } else {          // portrait: show a wider slice of the shot than a plain cover would
      const f = FIT[this.name] || FIT.drop;
      s = Math.max((h * f.k) / ih, w / iw); x = (w - iw * s) / 2;
      y = f.y > .8 ? h * f.y - ih * s : h * f.y - ih * s / 2;   // bottom-anchored or centred
    }
    const c = this.ctx; c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    c.drawImage(img, x, y, iw * s, ih * s);
    if (this.poster && !this.poster.classList.contains("is-gone")) this.poster.classList.add("is-gone");
  }
}
const seqs = $$(".chapter[data-film]").map(s => new Seq(s));
Promise.all(seqs.map(s => s.init())).then(() => { dropState.hitAt = seqs[0].manifest?.hit || .44; });

/* ---------- scroll ---------- */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new Lenis({ lerp: .1, smoothWheel: true, syncTouch: false });
}
function anchorTo(hash, offset = 0) {
  const el = hash === "#top" ? document.body : $(hash);
  if (!el) return;
  if (lenis) { lenis.resize(); lenis.scrollTo(el, { offset, duration: 1.4 }); }
  else scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: reduced ? "auto" : "smooth" });
}
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const ev = a.dataset.event;
  if (ev) { $("#fEvent").value = ev; showForm(); }
  e.preventDefault(); anchorTo(a.getAttribute("href"));
  history.replaceState(null, "", a.getAttribute("href"));
});

const chapterProgress = sec => {
  const r = sec.getBoundingClientRect();
  return clamp(-r.top / (r.height - innerHeight));
};
const near = sec => { const r = sec.getBoundingClientRect(); return r.bottom > -innerHeight && r.top < innerHeight * 2; };

/* ---------- chapter: The Drop ---------- */
const dropState = { hit: false, hitAt: .44, armed: true };
const meter = $("#bpmMeter");
for (let i = 0; i < 14; i++) meter.appendChild(document.createElement("i"));
const bars = $$("i", meter);
const dropEls = { logo: $(".drop__logo"), copy: $(".drop__copy"), bpm: $("#bpmValue"), bpmBox: $(".readout--bpm"), colours: $("#colourCount") };

function updateDrop(p, now) {
  const f = ramp(p, .05, .97);
  seqs[0].setProgress(f);
  const H = dropState.hitAt;
  const fade = 1 - ramp(f, H * .55, H - .03);
  dropEls.logo.style.opacity = fade;
  dropEls.logo.style.transform = `translateX(-50%) translateY(${-f * 60}px) scale(${1 + f * .08})`;
  dropEls.copy.style.opacity = fade;
  dropEls.copy.style.transform = `translateY(${-f * 40}px)`;
  dropEls.copy.style.visibility = fade < .02 ? "hidden" : "visible";
  const hit = f >= H;
  if (hit && !dropState.hit) {
    dropState.hit = true;
    dropEls.bpm.textContent = String(GENRES[genre].bpm).padStart(3, "0");
    dropEls.bpmBox.classList.remove("is-hit"); void dropEls.bpmBox.offsetWidth; dropEls.bpmBox.classList.add("is-hit");
    if (dropState.armed) { dropState.armed = false; play808(); }
  } else if (!hit && dropState.hit) {
    dropState.hit = false; dropEls.bpm.textContent = "000";
  }
  if (f < H - .04) dropState.armed = true;
  dropEls.colours.textContent = hit ? Math.round(8 * ramp(f, H, Math.min(.92, H + .32))) : 0;
  // meter: idle flicker before the hit, pulses at the genre tempo after it
  const beat = (now / 1000) * GENRES[genre].bpm / 60;
  const pulse = hit ? Math.pow(1 - (beat % 1), 2) : 0;
  bars.forEach((b, i) => {
    const lvl = hit ? clamp(.25 + pulse * (1 - i / 18) + Math.sin(now / 90 + i) * .08) : .12 + (Math.sin(now / 400 + i * 1.7) + 1) * .04;
    b.style.height = `${Math.round(lvl * 100)}%`;
    b.classList.toggle("on", hit && lvl > i / 14);
  });
}

/* ---------- chapter: The Sound ---------- */
const orbit = $("#orbitDeg");
function updateSound(p) {
  const f = ramp(p, .02, .98);
  seqs[1].setProgress(f);
  orbit.textContent = String(Math.round(f * 360)).padStart(3, "0");
}

/* ---------- chapter: The Set ---------- */
const layerItems = $$(".layers li"), layerCount = $("#layerCount");
function updateSet(p) {
  const f = ramp(p, .03, .95);
  seqs[2].setProgress(f);
  const shown = Math.min(6, Math.floor(ramp(f, .06, .9) * 6.999));
  layerItems.forEach((li, i) => { li.classList.toggle("on", i < shown); li.classList.toggle("now", i === shown - 1); });
  layerCount.textContent = shown;
}

/* ---------- main loop ---------- */
const chapters = $$(".chapter");
const header = $(".top"), events = $("#events");
function frame(now) {
  if (lenis) lenis.raf(now);
  const [d, s, t] = chapters;
  if (near(d)) updateDrop(chapterProgress(d), now);
  if (near(s)) updateSound(chapterProgress(s));
  if (near(t)) updateSet(chapterProgress(t));
  header.classList.toggle("is-solid", events.getBoundingClientRect().top < 72);
  // load frames for the chapter in view first, then the next one
  const order = seqs.slice().sort((a, b) => Math.abs(a.section.getBoundingClientRect().top) - Math.abs(b.section.getBoundingClientRect().top));
  order.forEach((q, i) => q.pump(i === 0 ? 6 : 2));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => seqs.forEach(s => s.ready && s.resize()), 120); });

/* ---------- sound: an 808 drop, synthesised, off by default ---------- */
let audio = null, soundOn = false;
const soundBtn = $("#soundToggle");
if (FORCE_MUTE) { soundBtn.disabled = true; soundBtn.title = "Muted by ?mute=1"; }
soundBtn.addEventListener("click", () => {
  if (FORCE_MUTE) return;
  soundOn = !soundOn;
  if (soundOn && !audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const ctx = new AC(), comp = ctx.createDynamicsCompressor(), master = ctx.createGain();
      master.gain.value = .9; master.connect(comp); comp.connect(ctx.destination);
      audio = { ctx, master };
    }
  }
  if (soundOn && audio) audio.ctx.resume();
  soundBtn.setAttribute("aria-pressed", String(soundOn));
  paintSoundLabel();
});
function paintSoundLabel() { $("span:last-child", soundBtn).textContent = t(soundOn ? "sound.on" : "sound.off"); }
function play808() {
  if (!soundOn || FORCE_MUTE || !audio) return;
  const { ctx, master } = audio, t0 = ctx.currentTime + .01;
  // body: pitch-dropping sine through a soft clipper
  const osc = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper();
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); }
  sh.curve = curve;
  osc.type = "sine"; osc.frequency.setValueAtTime(165, t0); osc.frequency.exponentialRampToValueAtTime(52, t0 + .09); osc.frequency.exponentialRampToValueAtTime(41, t0 + 1.8);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.95, t0 + .006); g.gain.exponentialRampToValueAtTime(.5, t0 + .5); g.gain.exponentialRampToValueAtTime(.0001, t0 + 2.4);
  osc.connect(sh); sh.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + 2.5);
  // click: a few ms of filtered noise for the attack
  const len = Math.floor(ctx.sampleRate * .03), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
  hp.type = "highpass"; hp.frequency.value = 1800; ng.gain.value = .35;
  n.buffer = buf; n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t0);
}

/* ---------- paint cursor ---------- */
const PAINT = ["#D0102B", "#1446C8", "#F4F1EA", "#FF8A1E", "#D3168C", "#14B8C4", "#86D11B", "#E0A92A"];
(function paintCursor() {
  if (!finePointer) return;
  const cv = $("#paint"), c = cv.getContext("2d");
  document.body.classList.add("has-paint");
  cv.style.filter = "var(--genre-filter, none)";
  let W, H, dpr; const parts = [], splats = []; let mx = -99, my = -99, lx = -99, ly = -99, ci = 0, running = false, visible = false;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);
  const kick = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    visible = true; mx = e.clientX; my = e.clientY;
    if (lx < -50) { lx = mx; ly = my; }
    const dx = mx - lx, dy = my - ly, sp = Math.hypot(dx, dy);
    if (!reduced) {
      const n = Math.min(5, Math.floor(sp / 7));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = Math.random() * 1.6;
        parts.push({ x: mx - dx * Math.random(), y: my - dy * Math.random(), vx: dx * .06 + Math.cos(a) * v, vy: dy * .06 + Math.sin(a) * v - .4,
          r: .8 + Math.random() * 2.6, life: 1, decay: .016 + Math.random() * .02, col: PAINT[(ci + (Math.random() * 2 | 0)) % 8] });
      }
      ci = (ci + (sp > 20 ? 1 : 0)) % 8;
    }
    lx = mx; ly = my; kick();
  }, { passive: true });
  addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse") return;
    const col = PAINT[(Math.random() * 8) | 0], blobs = [];
    const R = 9 + Math.random() * 8;
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, d = Math.random() * R * .7; blobs.push([Math.cos(a) * d, Math.sin(a) * d, R * (.45 + Math.random() * .5)]); }
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283, d = R * (1.3 + Math.random() * 1.8); blobs.push([Math.cos(a) * d, Math.sin(a) * d, 1 + Math.random() * 3]); }
    splats.push({ x: e.clientX, y: e.clientY, blobs, col, life: 1, grow: reduced ? 1 : 0 });
    if (splats.length > 14) splats.shift();
    kick();
  });
  document.addEventListener("pointerleave", () => { visible = false; kick(); });
  function tick() {
    c.clearRect(0, 0, W, H);
    for (const s of splats) {
      s.grow = Math.min(1, s.grow + .18); s.life -= .006;
      c.globalAlpha = clamp(s.life * 1.6) * .92; c.fillStyle = s.col;
      for (const [bx, by, br] of s.blobs) { c.beginPath(); c.arc(s.x + bx * s.grow, s.y + by * s.grow, br * (.4 + .6 * s.grow), 0, 6.283); c.fill(); }
    }
    for (let i = splats.length - 1; i >= 0; i--) if (splats[i].life <= 0) splats.splice(i, 1);
    for (const p of parts) {
      p.vy += .09; p.x += p.vx; p.y += p.vy; p.vx *= .98; p.life -= p.decay;
      c.globalAlpha = clamp(p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    if (visible) { // the cursor itself: a paint-tip dot inside a thin ring
      c.globalAlpha = 1; c.fillStyle = PAINT[ci]; c.beginPath(); c.arc(mx, my, 4, 0, 6.283); c.fill();
      c.strokeStyle = "rgba(243,240,247,.75)"; c.lineWidth = 1.25; c.beginPath(); c.arc(mx, my, 11, 0, 6.283); c.stroke();
    }
    c.globalAlpha = 1;
    if (parts.length || splats.length || visible) requestAnimationFrame(tick); else running = false;
  }
})();

/* ---------- Listen: Mixcloud + YouTube ---------- */
const embedMixes = () => $$(".mix").forEach(m => {
  if (m.querySelector("iframe")) return;
  const f = document.createElement("iframe");
  f.src = `https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=0&feed=${encodeURIComponent(m.dataset.mix)}`;
  f.title = `${m.textContent.trim()}, mix by DJ Río on Mixcloud`; f.loading = "lazy"; f.allow = "autoplay";
  m.appendChild(f);
});
if (YOUTUBE_ID) {
  const v = $("#video");
  v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(YOUTUBE_ID)}" title="Urban Tropics | Río Latin in the City" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}
new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { embedMixes(); o.disconnect(); } }, { rootMargin: "600px" }).observe($("#listen"));

/* ---------- i18n ---------- */
let lang = "en";
const t = (k, vars) => {
  let s = (I18N[lang] && I18N[lang][k]) ?? I18N.en[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, b);
  return s;
};
function setLang(l) {
  lang = I18N[l] ? l : "en";
  root.lang = lang; document.title = t("title");
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-alt]").forEach(el => { el.alt = t(el.dataset.i18nAlt); });
  $$("figure").forEach(f => f.dataset.pending = t("photo.pending"));
  $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $("#mixLo").setAttribute("aria-label", t("aria.lo")); $("#mixHi").setAttribute("aria-label", t("aria.hi"));
  const note = $(".quotes__note"); note.hidden = !t("reviews.note");
  paintSoundLabel(); updateMix();
  if (!$("#summary").hidden) renderSummary();
  if (!$("#result").hidden && lastResult) showResult(lastResult);
  try { localStorage.setItem("rio-lang", lang); } catch {}
}
$$("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

/* ---------- booking ---------- */
const form = $("#bookForm"), lo = $("#mixLo"), hi = $("#mixHi");
let mix = { a: 40, b: 35, c: 25 };
function updateMix(e) {
  let l = +lo.value, h = +hi.value;
  if (l > h) { if (e && e.target === lo) hi.value = h = l; else lo.value = l = h; }
  mix = { a: l, b: h - l, c: 100 - h };
  $("#mixA").textContent = mix.a; $("#mixB").textContent = mix.b; $("#mixC").textContent = mix.c;
  const seg = (sel, len, off) => { const el = $(sel); el.style.strokeDasharray = `${len} ${100 - len}`; el.style.strokeDashoffset = String(-off); el.style.opacity = len ? 1 : 0; };
  seg(".ring__seg--a", mix.a, 0); seg(".ring__seg--b", mix.b, mix.a); seg(".ring__seg--c", mix.c, mix.a + mix.b);
  $(".dual__a").style.width = mix.a + "%"; $(".dual__b").style.width = mix.b + "%"; $(".dual__c").style.width = mix.c + "%";
  const vt = t("s.mixVal", mix); lo.setAttribute("aria-valuetext", vt); hi.setAttribute("aria-valuetext", vt);
}
lo.addEventListener("input", updateMix); hi.addEventListener("input", updateMix);
// keep the upper handle on top when both meet at the right edge
lo.addEventListener("pointerdown", () => { lo.style.zIndex = 3; hi.style.zIndex = 2; });
hi.addEventListener("pointerdown", () => { hi.style.zIndex = 3; lo.style.zIndex = 2; });

const today = new Date(); $("#fDate").min = today.toISOString().slice(0, 10);

function data() {
  const fd = new FormData(form);
  return {
    event: fd.get("event"), date: fd.get("date"), venue: (fd.get("venue") || "").trim(), guests: fd.get("guests"),
    mix: { ...mix }, mc: fd.get("mc"), name: (fd.get("name") || "").trim(), email: (fd.get("email") || "").trim(), phone: (fd.get("phone") || "").trim(),
  };
}
const eventLabel = v => { const o = $(`#fEvent option[value="${v}"]`); return o ? o.textContent : v; };
const dateLabel = d => { if (!d) return ""; const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); };
function rows(d) {
  return [
    [t("f.event"), eventLabel(d.event)], [t("f.date"), dateLabel(d.date)], [t("f.venue"), d.venue],
    [t("f.guests"), d.guests || t("s.notGiven")], [t("f.mix"), t("s.mixVal", d.mix)],
    [t("f.mc"), d.mc === "yes" ? t("f.yes") : t("f.no")], [t("f.name"), d.name], [t("f.email"), d.email], [t("f.phone"), d.phone || t("s.notGiven")],
  ];
}
function renderSummary() {
  const dl = $("#summaryList"); dl.replaceChildren();
  for (const [k, v] of rows(data())) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
}
function showForm() { form.hidden = false; $("#summary").hidden = true; $("#result").hidden = true; }
form.addEventListener("submit", e => {
  e.preventDefault();
  const req = [["fEvent", "f.event"], ["fDate", "f.date"], ["fVenue", "f.venue"], ["fName", "f.name"], ["fEmail", "f.email"]];
  const missing = [];
  req.forEach(([id, k]) => { const el = $("#" + id), bad = !el.value.trim(); el.setAttribute("aria-invalid", String(bad)); if (bad) missing.push(t(k)); });
  const err = $("#formError"), email = $("#fEmail");
  if (missing.length) { err.textContent = t("f.missing") + missing.join(", "); err.hidden = false; $("[aria-invalid=true]").focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { email.setAttribute("aria-invalid", "true"); err.textContent = t("f.badEmail"); err.hidden = false; email.focus(); return; }
  err.hidden = true; renderSummary(); form.hidden = true; $("#summary").hidden = false; $("#summary").focus({ preventScroll: true });
  anchorTo("#summary", -110);
});
$("#editBtn").addEventListener("click", () => { showForm(); $("#fEvent").focus({ preventScroll: true }); anchorTo("#bookForm", -110); });
function mailto(d) {
  const body = rows(d).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `mailto:info@riorocksyourparty.com?subject=${encodeURIComponent(t("mail.subject", { event: eventLabel(d.event), date: d.date }))}&body=${encodeURIComponent(body)}`;
}
let lastResult = null;
function showResult(kind) {
  lastResult = kind; const d = data();
  $("#resultTitle").textContent = t(`r.${kind}Title`);
  $("#resultBody").textContent = t(`r.${kind}Body`, { email: d.email });
  const m = $("#mailtoBtn"); m.href = mailto(d); m.parentElement.hidden = kind === "sent";
  $("#summary").hidden = true; $("#result").hidden = false; $("#result").focus({ preventScroll: true });
  anchorTo("#result", -110);
}
$("#sendBtn").addEventListener("click", async () => {
  if (!FORM_ENDPOINT) { showResult("notSent"); return; }
  const btn = $("#sendBtn"); btn.disabled = true;
  try {
    const r = await fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ ...data(), lang, source: "riorocksyourparty.com" }) });
    showResult(r.ok ? "sent" : "fail");
  } catch { showResult("fail"); } finally { btn.disabled = false; }
});

/* ---------- start ---------- */
let startLang = qs.get("lang"), startGenre = null;
try { startLang = startLang || localStorage.getItem("rio-lang"); startGenre = localStorage.getItem("rio-genre"); } catch {}
if (!startLang && (navigator.language || "").toLowerCase().startsWith("es")) startLang = "es";
setGenre(GENRES[qs.get("genre")] ? qs.get("genre") : GENRES[startGenre] ? startGenre : "open", false);
setLang(startLang || "en");
updateMix();
window.__rio = { setGenre, setLang, filterRGB, GENRES, get lenis() { return lenis; }, seqs, dropState };
})();
