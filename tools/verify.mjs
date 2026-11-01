// Visual + functional check of the DJ Río site.
//   node tools/verify.mjs [--url http://localhost:5287] [--out lab]
// Screens every chapter mid-scroll on desktop and phone, then exercises the
// genre chips, the language toggle and the booking summary. Needs playwright.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:5287"), OUT = arg("--out", "lab");
fs.mkdirSync(OUT, { recursive: true });
const report = [];
const log = (...a) => { const s = a.join(" "); report.push(s); console.log(s); };

async function settle(page) {
  await page.waitForFunction(() => window.__rio && window.__rio.seqs.every(s => !s.ready || s.cur === -1 || s.cur === s.target || !s.section.getBoundingClientRect || Math.abs(s.section.getBoundingClientRect().top) > innerHeight * 6), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(350);
}
async function scrollToChapter(page, sel, p) {
  await page.evaluate(([sel, p]) => {
    const el = document.querySelector(sel), top = el.getBoundingClientRect().top + scrollY;
    const y = top + p * (el.offsetHeight - innerHeight);
    const l = window.__rio.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
  }, [sel, p]);
  await page.waitForTimeout(200);
  // wait for the exact frame to be drawn
  await page.waitForFunction(() => window.__rio.seqs.every(s => {
    const r = s.section.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return true;
    return s.ready && s.cur === s.target;
  }), null, { timeout: 20000 }).catch(() => log("  ! frame not settled at", sel, p));
  await page.waitForTimeout(250);
}
async function scrollToEl(page, sel) {
  await page.evaluate(sel => { const el = document.querySelector(sel); const y = el.getBoundingClientRect().top + scrollY - 40; const l = window.__rio.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }, sel);
  await page.waitForTimeout(700);
}

async function run(name, ctxOpts) {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/mixcloud|youtube|ERR_|404|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(BASE + "/?mute=1&lang=en", { waitUntil: "load" });
  await page.waitForFunction(() => window.__rio && window.__rio.seqs.every(s => s.ready));
  const shots = [
    ["drop", 0], ["drop", .3], ["drop", .55], ["drop", .85],
    ["sound", .3], ["sound", .65],
    ["set", .25], ["set", .6], ["set", .95],
  ];
  for (const [c, p] of shots) {
    await scrollToChapter(page, "#" + c, p);
    const info = await page.evaluate(() => ({
      bpm: document.querySelector("#bpmValue").textContent, colours: document.querySelector("#colourCount").textContent,
      orbit: document.querySelector("#orbitDeg").textContent, layers: document.querySelector("#layerCount").textContent,
    }));
    const f = `${OUT}/${name}-${c}-${String(Math.round(p * 100)).padStart(2, "0")}.png`;
    await page.screenshot({ path: f });
    log(`${name} ${c}@${p}: bpm=${info.bpm} colours=${info.colours} orbit=${info.orbit}° layers=${info.layers} -> ${f}`);
  }
  for (const s of ["#events", ".venues", "#listen", "#about", ".reviews", "#book", ".foot"]) {
    await scrollToEl(page, s);
    const f = `${OUT}/${name}-section-${s.replace(/[#.]/g, "")}.png`;
    await page.screenshot({ path: f }); log(`${name} ${s} -> ${f}`);
  }

  // genre chips: canvas filter, accent and BPM must all change together
  await scrollToChapter(page, "#sound", .5);
  for (const g of ["salsa", "reggaeton", "house", "open"]) {
    await page.click(`.chip[data-genre="${g}"]`);
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({
      filter: getComputedStyle(document.querySelector("#sound canvas")).filter,
      accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      bpm: document.querySelector("#genreBpm").textContent,
      checked: document.querySelector('.chip[aria-checked="true"]').dataset.genre,
    }));
    log(`${name} chip ${g}: checked=${st.checked} bpm=${st.bpm} accent=${st.accent} filter=${st.filter}`);
    if (g === "salsa" || g === "reggaeton") await page.screenshot({ path: `${OUT}/${name}-genre-${g}.png` });
  }

  // language toggle
  await scrollToChapter(page, "#drop", 0);
  await page.click('[data-lang="es"]');
  await page.waitForTimeout(300);
  const es = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector(".h1__line").textContent, title: document.title, cta: document.querySelector(".drop__copy .btn").textContent }));
  log(`${name} ES: lang=${es.lang} h1="${es.h1}" cta="${es.cta}" title="${es.title}"`);
  await page.screenshot({ path: `${OUT}/${name}-es-hero.png` });
  const untranslated = await page.evaluate(() => [...document.querySelectorAll("[data-i18n]")].filter(e => !(window.I18N.es[e.dataset.i18n] !== undefined)).map(e => e.dataset.i18n));
  log(`${name} ES keys missing: ${untranslated.length ? untranslated.join(",") : "none"}`);

  // booking: empty submit shows errors, then a full request shows the summary, then send says nothing was sent
  await scrollToEl(page, "#book");
  await page.click("#bookForm button[type=submit]");
  await page.waitForTimeout(400);
  log(`${name} empty submit error: "${await page.textContent("#formError")}"`);
  await page.selectOption("#fEvent", "wedding");
  await page.fill("#fDate", "2027-06-12");
  await page.fill("#fVenue", "Wrightsville Beach");
  await page.fill("#fGuests", "140");
  await page.evaluate(() => { const lo = document.querySelector("#mixLo"), hi = document.querySelector("#mixHi"); lo.value = 50; lo.dispatchEvent(new Event("input")); hi.value = 80; hi.dispatchEvent(new Event("input")); });
  await page.check('input[name=mc][value=yes]');
  await page.fill("#fName", "Test Planner");
  await page.fill("#fEmail", "planner@example.com");
  await page.fill("#fPhone", "910-555-0100");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-book-form.png` });
  await page.click("#bookForm button[type=submit]");
  await page.waitForTimeout(1600);
  const sum = await page.evaluate(() => [...document.querySelectorAll("#summaryList dt")].map(dt => dt.textContent + "=" + dt.nextElementSibling.textContent).join(" | "));
  log(`${name} summary (ES): ${sum}`);
  await page.screenshot({ path: `${OUT}/${name}-book-summary.png` });
  await page.click('[data-lang="en"]'); await page.waitForTimeout(300);
  const sumEn = await page.evaluate(() => [...document.querySelectorAll("#summaryList dt")].map(dt => dt.textContent + "=" + dt.nextElementSibling.textContent).join(" | "));
  log(`${name} summary (EN): ${sumEn}`);
  await page.click("#sendBtn"); await page.waitForTimeout(600);
  log(`${name} result: "${await page.textContent("#resultTitle")}" / "${await page.textContent("#resultBody")}"`);
  log(`${name} mailto: ${(await page.getAttribute("#mailtoBtn", "href")).slice(0, 120)}...`);
  await page.screenshot({ path: `${OUT}/${name}-book-result.png` });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  log(`${name} horizontal overflow: ${overflow}px`);
  const alts = await page.evaluate(() => [...document.images].filter(i => !i.hasAttribute("alt")).length);
  log(`${name} images without alt: ${alts}`);
  log(`${name} errors: ${errors.length ? errors.join(" || ") : "none"}`);
  await browser.close();
}

await run("desktop", { viewport: { width: 1440, height: 900 } });
await run("phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
fs.writeFileSync(`${OUT}/report.txt`, report.join("\n") + "\n");
