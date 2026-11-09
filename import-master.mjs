// Ek baar chalao: results/FOUND-ALL-CATEGORIZED.txt ke saare domains website ke data (data/found.json) mein daalta hai.
// Run:  node import-master.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const MASTER = path.join(here, "results", "FOUND-ALL-CATEGORIZED.txt");
const DATA = path.join(here, "data");
mkdirSync(DATA, { recursive: true });
const F_FOUND = path.join(DATA, "found.json");
const F_STATS = path.join(DATA, "stats.json");

const old = existsSync(F_FOUND) ? JSON.parse(readFileSync(F_FOUND, "utf8")) : [];
const have = new Set(old.map((x) => x.n));
let cat = "", added = 0, scannedTotal = 0;
for (const l of readFileSync(MASTER, "utf8").split(/\r?\n/)) {
  const h = l.match(/^=== (\d+)\.\s*(.+?) ===$/);
  if (h) { cat = h[2].replace(/\s*★.*$/, "").replace(/\s*\(\d+\)$/, ""); continue; }
  const m = l.match(/^\s*\d+\.\s+([a-z0-9-]+)\.com\s*$/);
  if (m && cat && !have.has(m[1])) { have.add(m[1]); old.push({ n: m[1], cat: "Manual: " + cat, s: 40, t: "2026-11-05" }); added++; }
  const t = l.match(/^Total scan hue:\s*([\d,]+)/);
  if (t) scannedTotal = +t[1].replace(/,/g, "");
}
writeFileSync(F_FOUND, JSON.stringify(old));
const st = existsSync(F_STATS) ? JSON.parse(readFileSync(F_STATS, "utf8")) : {};
st.scanned = Math.max(st.scanned || 0, scannedTotal);
st.free = old.length;
st.updated = st.updated || new Date().toISOString();
writeFileSync(F_STATS, JSON.stringify(st, null, 1));
console.log(`Import: ${added} naye, total ${old.length} domains -> ${F_FOUND}`);
