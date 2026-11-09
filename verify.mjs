// Re-verify: pehle se mile hue naamon ko dobara Verisign RDAP se check karta hai.
// Jo naam ab registered (taken) nikle wo state/taken.json mein jate hain, aur build-index.mjs unko available list se hata deta hai.
// Priority: sabse achhe naam (q>=120) har ~30 min, q>=60 har ~2 ghante, baaki har ~24 ghante. Time-boxed (VERIFY_MINUTES, default 12).
// Input:  data/all.json (build-index.mjs ka output)   State: state/verified.json, state/taken.json
// Run:    node verify.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(here, "state");
mkdirSync(STATE, { recursive: true });
const F_ALL = path.join(here, "data", "all.json");
const F_VER = path.join(STATE, "verified.json");
const F_TAKEN = path.join(STATE, "taken.json");
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MINUTES = +(process.env.VERIFY_MINUTES || 12);
const CONC = +(process.env.VERIFY_CONC || 6);
const deadline = Date.now() + MINUTES * 60000;

if (!existsSync(F_ALL)) { console.log("data/all.json nahi mila (pehla index abhi nahi bana). Kuch verify nahi karna."); process.exit(0); }
const all = readJson(F_ALL, { cats: [], items: [] });
const verified = readJson(F_VER, {});   // name -> last verified (ms)
const taken = readJson(F_TAKEN, {});    // name -> { n, cat, s, t, m, p, q, bt }

const AGE = [30 * 60000, 2 * 3600000, 24 * 3600000]; // class 0 (q>=85), 1 (q>=60), 2 (baaki)
const now = Date.now();
const due = [];
for (const t of all.items) {
  const n = t[0]; if (taken[n]) continue;
  const q = t[7] || 0, cls = q >= 120 ? 0 : q >= 60 ? 1 : 2, last = verified[n] || 0;
  if (now - last >= AGE[cls]) due.push({ t, cls, last });
}
due.sort((a, b) => a.cls - b.cls || a.last - b.last);
console.log(`Verify: ${all.items.length} naam, ${due.length} due, ${MINUTES} min, conc ${CONC}`);

async function rdap(n) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return "free";
      if (r.status === 200) return "taken";
      if (r.status === 429) { rl++; await sleep(4000 * (i + 1)); continue; }
      await sleep(1500);
    } catch { await sleep(1500); }
  }
  return null;
}

let idx = 0, ok = 0, newTaken = 0, fail = 0, rl = 0;
function save() { writeFileSync(F_VER, JSON.stringify(verified)); writeFileSync(F_TAKEN, JSON.stringify(taken)); }
async function worker() {
  while (Date.now() < deadline && idx < due.length) {
    if (rl >= 40) break; // registry bahut rate-limit kar raha hai: aaj itna kaafi
    const { t } = due[idx++], n = t[0];
    const res = await rdap(n);
    if (res === "free") { verified[n] = Date.now(); ok++; }
    else if (res === "taken") {
      ok++; newTaken++;
      taken[n] = { n, cat: all.cats[t[1]] || "", s: t[2], t: t[3], m: t[4], p: t[5], q: t[7] || 0, bt: new Date().toISOString() };
      delete verified[n];
      console.log("TAKEN ab:", n + ".com", `(q=${t[7] || 0})`);
    } else fail++;
    if ((ok + fail) % 400 === 0) save();
    await sleep(80);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
// purane verified entries jo ab list mein nahi hain hata do (file chhoti rahe)
const live = new Set(all.items.map((t) => t[0]));
for (const n of Object.keys(verified)) if (!live.has(n)) delete verified[n];
save();
console.log(`Khatam: ${ok} check hue, ${newTaken} naye taken, ${fail} fail, rate-limit ${rl}. Total taken ${Object.keys(taken).length}`);
