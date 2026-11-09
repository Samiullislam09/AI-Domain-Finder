// Saari data/found*.json + data/stats*.json ko ek compact index mein jodta hai, taaki website 46 files ki jagah 2 files padhe.
// Output: data/summary.json (chhota: stats + top picks + pehle naam) aur data/all.json (saare naam, compact).
// Run:  node build-index.mjs   (GitHub Actions mein "index" job yehi chalati hai)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "data");
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

// NOTE: TOPICS aur unka order docs/index.html ke TOPICS se same rakhna (bitmask isi order par based hai).
const TOPICS = [
  ["biz", "business startup team partner work company office boss manager desk hub studio factory agency venture founder enterprise"],
  ["sales", "sales lead market brand growth campaign outreach funnel pipeline deal traffic boost reach pitch promo advert"],
  ["ai", "auto smart bot pilot agent assist genie wizard machine engine robot brain mind logic neural cyber digit code data cloud"],
  ["social", "chat whatsapp social message mail inbox talk post follow friend buddy mate connect community voice"],
  ["content", "content blog video write story page book note scribe news media podcast canvas draft"],
  ["shop", "shop store order customer client review support price cart pay market trade invoice"],
  ["nature", "ocean forest sky mountain river leaf tree stone sun moon star rain wind field valley lake sea garden flower meadow grass"],
  ["power", "swift quick fast rapid bold strong sharp prime peak rocket flash bolt spark pulse forge storm fire thunder power turbo"],
];
const topicMask = (x) => {
  const s = (x.n + " " + (x.m || "")).toLowerCase(); let m = 0;
  TOPICS.forEach((t, i) => { if (t[1].split(" ").some((k) => s.includes(k))) m |= 1 << i; });
  return m || 1 << TOPICS.length; // "other"
};

// ---- ranking (docs/index.html ke rank/wordsOf/topPicks jaisa) ----
const wordsOf = (x) => { const m = (x.cat || "").match(/^(\d)-word/); if (m) return +m[1]; const pr = x.p || (x.m && x.m.includes("+") ? x.m : ""); if (pr) return pr.split(/\s*\+\s*/).length; return /dictionary/i.test(x.cat || "") ? 1 : 2; };
const base = (x) => (/^AI:/.test(x.cat || "") && !x.m ? 60 : x.s);
const rank = (x) => base(x) - (/ads|email/.test(x.n) ? 12 : 0) + (wordsOf(x) === 1 ? 8 : wordsOf(x) === 2 ? 4 : 0) - Math.max(0, x.n.length - 9) * 1.2;
const bucket = (n) => (n <= 5 ? 0 : n <= 7 ? 1 : n <= 10 ? 2 : 3);
const partsOf = (x) => (x.p || (x.m && x.m.includes("+") ? x.m.replace(/\s/g, "") : "")).split("+");

// ---- read everything ----
const files = readdirSync(DATA);
const seen = new Map();
for (const f of files.filter((f) => /^found.*\.json$/.test(f)).sort()) for (const x of readJson(path.join(DATA, f), [])) if (x && x.n && (!seen.has(x.n) || (!seen.get(x.n).m && x.m))) seen.set(x.n, x); // meaning wali entry ko tarjeeh
const all = [...seen.values()];

const types = {}, hist = {}; let scanned = 0, runs = 0, updated = "";
for (const f of files.filter((f) => /^stats.*\.json$/.test(f)).sort()) {
  const s = readJson(path.join(DATA, f), null); if (!s) continue;
  const tag = f.replace(/^stats/, "").replace(/\.json$/, "");
  const found = readJson(path.join(DATA, "found" + tag + ".json"), []).length;
  scanned += s.scanned || 0; runs += s.runs || 0; if ((s.updated || "") > updated) updated = s.updated;
  const mm = tag.match(/^-w(\d)-len(\d+)-(\d+)$/);
  const label = mm ? `${mm[1]} word, ${mm[2]}-${mm[3]} letters` : tag ? `Earlier run, ${tag.slice(4)} letters` : "Earlier archive";
  types[label] = { s: s.scanned || 0, f: found };
  for (const [d, v] of Object.entries(s.history || {})) { (hist[d] ||= { s: 0, f: 0 }); hist[d].s += v.s; hist[d].f += v.f; }
}

// ---- compact tuples ----
const cats = [], catIdx = new Map();
const tuple = (x) => { let c = catIdx.get(x.cat || ""); if (c === undefined) { c = cats.length; cats.push(x.cat || ""); catIdx.set(x.cat || "", c); } return [x.n, c, x.s || 0, x.t || "", x.m || "", x.p || "", topicMask(x)]; };
all.sort((a, b) => rank(b) - rank(a) || a.n.localeCompare(b.n));

// top picks (meaning wale asli naam, chhote pehle)
const tier = (x) => (x.m && !x.m.includes("+") ? 0 : 1);
const okTop = (x) => {
  if (/^(Generated|Phonetic|Manual:)/.test(x.cat || "") || (/^AI:/.test(x.cat || "") && !x.m)) return false;
  if (tier(x) === 1) { const p = partsOf(x); if (p.length < 2 || /ads|email/.test(x.n) || p.some((a, i) => p.some((b, k) => i !== k && (a.includes(b) || b.includes(a))))) return false; }
  return true;
};
const top = [], seenEnd = {};
for (const x of all.filter(okTop).sort((a, b) => tier(a) - tier(b) || bucket(a.n.length) - bucket(b.n.length) || rank(b) - rank(a))) {
  const p = partsOf(x), e = p.length > 1 ? p[p.length - 1] : x.n.slice(-3);
  if ((seenEnd[e] || 0) >= 2) continue; seenEnd[e] = (seenEnd[e] || 0) + 1; top.push(x); if (top.length >= 12) break;
}

const items = all.map(tuple);
const raw = JSON.stringify({ cats, items }); let h = 2166136261;
for (let i = 0; i < raw.length; i += 5) h = Math.imul(h ^ raw.charCodeAt(i), 16777619) >>> 0;
const v = (updated || "0") + "-" + h.toString(36); // cache key: badlega jab bhi data ya ranking badle
const summary = { v, updated, scanned, runs, free: all.length, types, hist, cats, top: top.map(tuple), first: all.slice(0, 40).map(tuple) };
writeFileSync(path.join(DATA, "all.json"), JSON.stringify({ v, cats, items }));
writeFileSync(path.join(DATA, "summary.json"), JSON.stringify(summary));
console.log(`Index: ${all.length} naam, scanned ${scanned}, summary ${(JSON.stringify(summary).length / 1024).toFixed(0)} KB, all ${(JSON.stringify({ v, cats, items }).length / 1048576).toFixed(2)} MB`);
