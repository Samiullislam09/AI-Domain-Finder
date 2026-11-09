// 24/7 domain miner (GitHub Actions par chalane ke liye, local par bhi chal sakta hai).
// Run:  node miner.mjs          (MINE_MINUTES=12 default)
// Kya karta hai: NVIDIA AI se brand-naam mangwata hai + syllable generator se naam banata hai,
// DNS + Verisign RDAP se check karta hai, free naam data/found.json mein jodta hai.
// Website (docs/index.html) isi data ko dikhati hai.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { Resolver } from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "data");
mkdirSync(DATA, { recursive: true });
// LEN=4..10 -> sirf utne letter ki alag mining (alag files, taaki parallel jobs ke commit na takraayein). LEN nahi to purana mix mode.
const LEN = +(process.env.LEN || 0);
const TAG = LEN ? `-len${LEN}` : "";
const F_FOUND = path.join(DATA, `found${TAG}.json`);
const F_STATS = path.join(DATA, `stats${TAG}.json`);
const F_CHECKED = path.join(DATA, `checked-ai${TAG}.txt`); // sirf AI ke diye naam

// local .env (GitHub par secrets env se aate hain)
const envFile = path.join(here, ".env");
if (existsSync(envFile)) for (const l of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.NO_AI ? "" : process.env.NVIDIA_API_KEY || ""; // NO_AI=1: sirf syllable naam (test ke liye)
let MODEL = process.env.NVIDIA_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1";
const MINUTES = +(process.env.MINE_MINUTES || 12);
const PRODUCT = process.env.PRODUCT || "an AI automation SaaS that runs a company's marketing, content and sales on autopilot";
const CONC = +(process.env.CONC || 20);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

const found = readJson(F_FOUND, []);
const stats = Object.assign({ scanned: 0, free: found.length, runs: 0, cursor: 0, aiOk: 0, aiFail: 0, updated: "", history: {} }, readJson(F_STATS, {}));
stats.len = LEN || "mix";
stats.runs++;
const bump = (k) => { const d = new Date().toISOString().slice(0, 10); (stats.history[d] ||= { s: 0, f: 0 })[k]++; }; // date-wise history
const have = new Set(found.map((x) => x.n));
const aiSeen = new Set(existsSync(F_CHECKED) ? readFileSync(F_CHECKED, "utf8").split(/\r?\n/).filter(Boolean) : []);

// ---------- naam banane ke tareeqe ----------
const SYL = "ba be bo da de di do ka ko la le li lo ma me mi mo na ne no pa pe po ra re ri ro sa se si so ta te ti to va ve vo zo".split(" ");
const CODA = "nlrsmx".split("");
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const isV = (c) => "aeiou".includes(c);
function buildSyllableNames() {
  const out = new Set();
  const ok = (n) => { const cons = [...n].filter((c) => !isV(c)); return new Set(cons).size === cons.length && new Set([...n].filter(isV)).size >= 2; };
  for (const a of SYL) for (const b of SYL) for (const c of SYL) if (ok(a + b + c)) out.add(a + b + c);
  for (const a of SYL) for (const b of SYL) for (const e of CODA) if (ok(a + b + e)) out.add(a + b + e);
  const arr = [...out], rnd = mulberry(20261105);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const SYLNAMES = LEN ? [] : buildSyllableNames();
const WORDS = "sky bright spark flow wave pilot auto bolt nova bee lift leaf glow bloom rise swift quick smart clever brisk fleet pulse beam crisp fresh grand happy lucky magic noble ocean pearl royal solid sunny tidy urban vivid zesty amber coral daily early gentle honest idea mind work task team grow link loop move path quest scout shift track trend trust unity wise bridge craft drive field forge guide hatch hub kite lumen merit orbit prime scale signal sprint stack storm summit tango thrive vector".split(" ");
const byLen = {}; for (const w of WORDS) (byLen[w.length] ||= []).push(w);
const rnd = mulberry(Date.now() & 0x7fffffff), pick = (a) => a[Math.floor(rnd() * a.length)], tried = new Set();
function genOne(L) { // exact L letter ka bolne layak naam: word+word ya syllable+syllable
  for (let t = 0; t < 80; t++) {
    let n = "";
    if (L >= 6 && rnd() < 0.5) { const a = pick(WORDS), rest = byLen[L - a.length]; if (rest) n = a + pick(rest); }
    if (!n) { let prev = ""; while (n.length + 1 < L) { const sy = pick(SYL); if (sy === prev) continue; prev = sy; n += sy; } if (n.length < L) n += pick(CODA); }
    if (n.length === L && [...n].filter(isV).length >= 2 && !tried.has(n)) { tried.add(n); return n; }
  }
  return null;
}

const THEMES = [
  ["AI: Short & catchy", "short catchy names, 1-2 syllables, like Zoom, Slack, Stripe, Notion, Canva"],
  ["AI: Real-word compounds", "two simple everyday English words joined, like Facebook, Mailchimp, Dropbox, Pinterest, Salesforce"],
  ["AI: Real word + twist", "a real English word with a small twist in spelling, like Lyft, Flickr, Tumblr, Groq, Zapier"],
  ["AI: Smooth & euphonious", "smooth, vowel-rich, pleasant coined names, like Hulu, Nike, Uber, Oracle, Spotify"],
  ["AI: Automation & AI brands", "names fitting an AI automation product, like DeepSeek, Jasper, Zapier, Copilot, Autopilot"],
];

async function pickModel() {
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    const ids = (await r.json()).data.map((m) => m.id).filter((id) => /nemotron|llama-3|llama-4|mistral|qwen|gemma/i.test(id) && !/embed|rerank|vision|vl|guard|safety|reward|parse|clip|retriev/i.test(id));
    ids.sort((a, b) => (/super|nano/.test(b) ? 1 : 0) - (/super|nano/.test(a) ? 1 : 0));
    if (ids[0]) { MODEL = ids[0]; console.log("Model badla:", MODEL); }
  } catch {}
}

let round = 0;
async function aiBatch() {
  if (!KEY) return [];
  const [cat, desc] = THEMES[(stats.runs + round++) % THEMES.length];
  const avoid = [...aiSeen].slice(-150).join(", ") || "none";
  const prompt = `You are a brand naming expert. Product: ${PRODUCT}.
Give 80 brand-name candidates for a .com domain. Style: ${desc}.
Rules: lowercase a-z only, ${LEN ? "EXACTLY " + LEN : "5 to 8"} letters, no digits or hyphens, easy to say and spell, real-brand feel (like Zapier, Groq, Hulu, Canva), made of real English words or natural syllables, NOT random letter strings, NO foreign/Russian-sounding names.
Do NOT repeat: ${avoid}
Reply with ONLY a JSON array of strings.`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature: 1.0, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(170000),
      });
      if (res.status === 404 || res.status === 410) { await pickModel(); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json(); const ch = j.choices?.[0]?.message;
      const text = ch?.content || ch?.reasoning_content || "";
      let arr = []; const m = text.match(/\[[\s\S]*\]/);
      if (m) try { arr = JSON.parse(m[0]); } catch {}
      if (!arr.length) arr = [...text.matchAll(/"([A-Za-z]{4,10})"/g)].map((x) => x[1]);
      const out = [];
      for (const raw of arr) {
        const n = String(raw).toLowerCase().trim().replace(/\.com$/, "");
        if (!(LEN ? new RegExp(`^[a-z]{${LEN}}$`) : /^[a-z]{5,8}$/).test(n) || aiSeen.has(n)) continue;
        aiSeen.add(n); appendFileSync(F_CHECKED, n + "\n"); out.push({ n, cat });
      }
      if (out.length) { stats.aiOk++; return out; }
    } catch (e) { console.log("AI fail:", e.message); await sleep(2000 * (attempt + 1)); }
  }
  stats.aiFail++;
  return [];
}
function syllableBatch(k = 60) {
  const out = [];
  if (LEN) { for (let i = 0; i < k; i++) { const n = genOne(LEN); if (n) out.push({ n, cat: `Generated ${LEN} letter` }); } return out; }
  for (let i = 0; i < k; i++) out.push({ n: SYLNAMES[stats.cursor++ % SYLNAMES.length], cat: "Phonetic syllables (6 letter / 5 letter)" });
  return out;
}

// ---------- check ----------
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
async function dnsHas(d) { try { await resolver.resolveNs(d); return true; } catch (e) { return e.code === "ENOTFOUND" ? false : e.code === "ENODATA" ? true : null; } }
async function registry(n) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return "free"; if (r.status === 200) return "taken";
      await sleep(r.status === 429 ? 4000 * (i + 1) : 1500);
    } catch { await sleep(1500); }
  }
  return "unknown";
}
function score(n, cat) {
  let s = 50 - Math.abs(n.length - 6) * 4;
  if (isV(n[n.length - 1])) s += 4; if (cat.startsWith("AI")) s += 8; if (/[xzqj]/.test(n)) s -= 3;
  return Math.round(s);
}
function save() {
  stats.free = found.length; stats.updated = new Date().toISOString(); stats.model = MODEL;
  writeFileSync(F_FOUND, JSON.stringify(found)); writeFileSync(F_STATS, JSON.stringify(stats, null, 1));
}

// ---------- main ----------
const t0 = Date.now(), deadline = t0 + MINUTES * 60000;
let sinceSave = 0, newFree = 0;
console.log(`Miner shuru: ${MINUTES} min, model=${MODEL}, AI key ${KEY ? "hai" : "NAHI (sirf syllable names)"}, pehle se free=${found.length}`);
async function worker(queue) {
  while (queue.length && Date.now() < deadline) {
    const { n, cat } = queue.shift();
    if (have.has(n)) continue;
    const dns = await dnsHas(`${n}.com`);
    const r = dns === true ? "taken" : await registry(n);
    if (r === "unknown") continue;
    stats.scanned++; sinceSave++; bump("s");
    if (r === "free") { have.add(n); found.push({ n, cat, s: score(n, cat), t: new Date().toISOString().slice(0, 10) }); newFree++; bump("f"); console.log("FREE", n + ".com", `(${cat})`); }
    if (sinceSave >= 300) { sinceSave = 0; save(); }
    await sleep(60);
  }
}
while (Date.now() < deadline) {
  let batch = await aiBatch();
  batch = [...batch, ...syllableBatch(batch.length ? 40 : 120)];
  await Promise.all(Array.from({ length: CONC }, () => worker(batch)));
  console.log(`scanned ${stats.scanned} | free total ${found.length} (is run mein +${newFree})`);
}
save();
console.log(`Khatam. Is run mein +${newFree} free. Total free ${found.length}, scanned ${stats.scanned}`);
