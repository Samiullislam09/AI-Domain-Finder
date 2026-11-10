// 24/7 domain miner (GitHub Actions par chalane ke liye, local par bhi chal sakta hai).
// Run:  node miner.mjs          (MINE_MINUTES=12 default)
// Kya karta hai: NVIDIA AI se brand-naam mangwata hai + syllable generator se naam banata hai,
// DNS + Verisign RDAP se check karta hai, free naam data/found.json mein jodta hai.
// Website (docs/index.html) isi data ko dikhati hai.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { Resolver } from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildModel, coinedCandidates, friendly } from "./shortname.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "data");
mkdirSync(DATA, { recursive: true });
// LEN=4..10 -> sirf utne letter ki alag mining (alag files, taaki parallel jobs ke commit na takraayein). LEN nahi to purana mix mode.
const [LMIN, LMAX] = (process.env.RANGE || "").split("-").map(Number).filter(Boolean).length === 2 ? process.env.RANGE.split("-").map(Number) : [+(process.env.LMIN || 0), +(process.env.LMAX || 0)], LEN = LMIN ? 1 : 0, W = +(process.env.WORDS || 0); // WORDS=1/2/3: naam kitne words ka // LMIN..LMAX = naam ki total letter range
const VOCAB = !!process.env.VOCAB; // VOCAB=1: sirf curated, vetted words (wordlist/brand-words.txt) se chhote, matlab-wale naam
const COINED = +(process.env.COINED || 0); // COINED=3/4/5: chhote, bolne layak, English jaise naam (invented, Hulu/Canva jaise)
const TAG = COINED ? `-c-len${LMIN}-${LMAX}` : W ? `-${VOCAB ? "v" : "w"}${W}-len${LMIN}-${LMAX}` : LMIN ? `-len${LMIN}-${LMAX}` : "";
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

const found = readJson(F_FOUND, []).filter((x) => !/^(Generated|Phonetic)/.test(x.cat || "")); // purane random/syllable naam hata do
const stats = Object.assign({ scanned: 0, free: found.length, runs: 0, cursor: 0, aiOk: 0, aiFail: 0, updated: "", history: {} }, readJson(F_STATS, {}));
stats.len = LMIN ? `${LMIN}-${LMAX}` : "mix"; stats.words = W || "any";
stats.runs++;
const bump = (k) => { const d = new Date().toISOString().slice(0, 10); (stats.history[d] ||= { s: 0, f: 0 })[k]++; }; // date-wise history
const have = new Set(found.map((x) => x.n));
const aiSeen = new Set(existsSync(F_CHECKED) ? readFileSync(F_CHECKED, "utf8").split(/\r?\n/).filter(Boolean) : []);

// ---------- naam ke source: (1) asli words ko jodkar brand (Mailchimp/ChatGPT/Dropbox jaisa), (2) AI ----------
const isV = (c) => "aeiou".includes(c);
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Meaningful descriptive compounds (TripTravelingGuide / Mailchimp jaise): simple, India mein samajh aane wale words.
const TOPIC = "sales lead leads market marketing content social chat whatsapp mail brand growth customer client business outreach post campaign video blog traffic funnel pipeline deal followup message inbox store shop order review support".split(" ");
const MOD = "auto smart quick easy instant daily simple fast bright clever super total happy ready pure true prime fresh".split(" ");
const ROLE = "pilot buddy helper assistant agent manager engine booster maker studio desk hub coach mate bot worker team genie wizard factory machine guru expert planner writer sender scheduler tracker finder builder creator runner partner friend".split(" ");
const PAIRS = (() => {
  if (!LMIN) return [];
  const out = new Map(), fit = (n) => n.length >= LMIN && n.length <= LMAX && !/i$/.test(n);
  if (COINED) { // trigram model: English jaise bolne wale chhote naam, sabse "English jaisa" pehle
    const model = buildModel(path.join(here, "wordlist", "words.txt"));
    const rnd = mulberry(20261110 + COINED * 131);
    return coinedCandidates(model, COINED, rnd, COINED <= 4 ? 80000 : 150000).map((n) => [n, ""]);
  }
  if (VOCAB) { // curated words: adjective + noun, nature + nature/place, adjective + nature + noun (jaise boldfalcon, oakfield, bluesunhill)
    const txt = readFileSync(path.join(here, "wordlist", "brand-words.txt"), "utf8");
    const sect = (h) => { const i = txt.indexOf("# --- " + h); if (i < 0) return []; const j = txt.indexOf("# ---", i + 5); return txt.slice(i, j < 0 ? undefined : j).split(/\r?\n/).filter((l) => !l.startsWith("#")).join(" ").split(/\s+/).filter((w) => /^[a-z]{3,8}$/.test(w)); };
    const ADJ = new Set(sect("quality")), NAT = new Set([...sect("nature"), ...sect("animals")]), PEO = new Set(sect("business and people")), PLA = new Set(sect("places and objects"));
    const NOUN = [...new Set([...NAT, ...PEO, ...PLA])].filter((w) => !ADJ.has(w)), NATP = [...NAT, ...PLA];
    const put = (parts) => { const n = parts.join(""); if (fit(n) && new Set(parts).size === parts.length && !out.has(n)) out.set(n, parts.join(" + ")); };
    if (W === 2) { for (const a of ADJ) for (const b of NOUN) put([a, b]); for (const a of NAT) for (const b of NATP) put([a, b]); }
    else if (W === 3 && LMAX <= 11) { for (const a of ADJ) for (const b of NAT) { if (a.length + b.length + 3 > LMAX) continue; for (const c of NOUN) put([a, b, c]); } }
    const arr = [...out], rnd = mulberry(20261110 + LMIN * 31 + W * 97);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  if (W === 1) { // 1 asli dictionary word (common pehle)
    const f = path.join(here, "wordlist", "words.txt");
    if (existsSync(f)) readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean).forEach((n) => { if (fit(n)) out.set(n, "dictionary word"); });
    return [...out];
  }
  const add = (parts) => { const n = parts.join(""); if ((!W || parts.length === W) && fit(n) && new Set(parts).size === parts.length && !out.has(n)) out.set(n, parts.join(" + ")); };
  for (const c of ROLE) {
    if (W !== 3) { for (const a of TOPIC) add([a, c]); for (const b of MOD) add([b, c]); }
    if (W !== 2) { for (const b of MOD) for (const a of TOPIC) add([b, a, c]); for (const a of TOPIC) for (const a2 of TOPIC) add([a, a2, c]); }
  }
  if (W !== 3) { for (const b of MOD) for (const a of TOPIC) add([b, a]); for (const a of TOPIC) for (const a2 of TOPIC) add([a, a2]); }
  const arr = [...out], rnd = mulberry(20261109 + LMIN + W * 97);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
})();

const THEMES = [
  ["AI: Powerful words", "powerful, strong words (like Forge, Prime, Titan, Apex)"],
  ["AI: Action words", "action words / verbs (like Bolt, Swift, Spark, Launch)"],
  ["AI: Creative words", "creative, imaginative real words (like Muse, Prism, Canvas, Ember)"],
  ["AI: Nature-inspired", "nature-inspired real words (like Oasis, Cedar, Breeze, Falcon)"],
  ["AI: Technology words", "technology-related real words (like Pulse, Vector, Signal, Orbit)"],
];

// sirf AI ke naamon ke liye halka filter (dictionary words pe nahi lagta)
function looksBrand(n) {
  if (/[^aeiouy]{6,}/.test(n)) return false;
  if (/(ovich|vich|ovna|skiy|shch|zhk|zhn|vsk|tsk|ova$|eva$|iy$|yev|yov|ski$)/.test(n)) return false;
  if (/q(?!u)/.test(n)) return false;
  return true;
}

// ---------- model auto-select: tez + achha (chhota/medium instruct pehle, slow ultra/reasoning peeche) ----------
let RANKED = null;
async function loadModels() {
  if (RANKED) return RANKED;
  RANKED = [];
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    const ids = (await r.json()).data.map((m) => m.id).filter((id) => /nemotron|llama|mistral|qwen|gemma|deepseek|phi|granite/i.test(id) && !/embed|rerank|vision|guard|safety|reward|parse|clip|retriev|code|math|translate|vila|ocr|asr|tts|arctic|-vl|vl-/i.test(id));
    const size = (id) => { const m = id.match(/(\d+(?:\.\d+)?)b/i); return m ? +m[1] : 50; };
    const cost = (id) => { let c = Math.abs(Math.log(size(id) / 50)); if (/ultra|r1|reason|think|405b|235b|480b|550b|253b/i.test(id)) c += 3; if (size(id) < 8) c += 3; if (/instruct|chat/i.test(id)) c -= 0.3; return c; };
    RANKED = ids.sort((x, y) => cost(x) - cost(y)).slice(0, 20);
    console.log("Model order:", RANKED.join(" > "));
  } catch (e) { console.log("Model list fail:", e.message); }
  return RANKED;
}

// User ki di hui live NVIDIA models: text-naming ke liye theek pehle, baaki (vision/guard/translate/etc) aakhir mein
const PREFER = ["nvidia/nemotron-3.5-bolt", "nvidia/nemotron-3-nano-omni", "z.ai/glm-5-3-flash", "meta/muse-glimmer-30b", "google/gemma-4-31b-it", "deepseek-ai/deepseek-v4.1-flash"];
const ODD = ["nvidia/riva-translate-4b-instruct-v2", "nvidia/ising-calibration-1.5-31b", "nvidia/cosmos3-nano-reasoner", "nvidia/kumo-relational01", "meta/llama-3.2-90b-vision-instruct", "meta/llama-guard-4-12b"];
let round = 0;
async function aiBatch() {
  if (!KEY || Date.now() > deadline - 5 * 60000) return [];
  const [cat, desc] = THEMES[(stats.runs + round++) % THEMES.length];
  const avoid = [...aiSeen].slice(-150).join(", ") || "none";
  let prompt = `Act as an expert brand naming strategist for global technology companies and startups.
Product: ${PRODUCT}.
Give 50 brand names for a modern technology company. Category: ${desc}.
Inspiration: TripTravelingGuide, ChatGPT, Mailchimp, Dropbox, Salesforce, Facebook, Pinterest, Zapier.
Requirements:
- Lowercase a-z, total ${LMIN ? LMIN + " to " + LMAX : "8 to 16"} letters.
- Made of ${W ? "EXACTLY " + W + " real English word" + (W > 1 ? "s joined" : "") : "TWO or THREE simple, real English words joined"} (like TripTravelingGuide, Mailchimp, Dropbox, ChatGPT, Salesforce). Every part must be a common English word that Indian users already know.
- Must NOT end in -i, -pe, -di, -ve or any made-up syllable; end on a real word.
- Easy to say and spell for Indian English speakers; people should instantly understand it. Bold, modern, memorable, professional.
Strictly avoid: random letter strings (like Vomepo, Zokati, Vavodo), invented fantasy words, difficult spellings, foreign-sounding names, and generic use of Tech, Digital, AI, Solutions, Systems.
Do NOT repeat: ${avoid}
Reply with ONLY a JSON array of objects: [{"n":"name","p":"the words joined by + (example: wide+open+sky)","m":"short plain-English meaning"}]`;
  if (LMAX && LMAX <= 6) { // chhote naam: AI se invented-but-natural brandable naam (Hulu, Canva, Groq jaise)
    prompt = `You are a brand naming expert. Product: ${PRODUCT}.
Give 60 SHORT brand-name candidates for a .com domain, each EXACTLY ${LMIN === LMAX ? LMIN : LMIN + " to " + LMAX} letters, lowercase a-z only.
Style: invented or real-word names that sound natural in English and are easy to say for Indian English speakers, like Hulu, Uber, Nike, Zoom, Canva, Groq, Slack, Lyft, Zapier, Tumblr. Use soft vowels, at most 2 syllables, and a strong first sound.
Strictly avoid: plain common dictionary words (they are all taken), random letter strings, hard consonant clusters, Russian, Slavic or Hindi-sounding names, and endings like -ov, -ova, -ski, -ino, -ora, -pe, -di, -ve, -i.
Do NOT repeat: ${avoid}
Reply with ONLY a JSON array of objects: [{"n":"name","m":"short note on the sound or idea"}]`;
  }
  const list = await loadModels();
  const tryModels = [...new Set([process.env.FORCE_MODEL && process.env.NVIDIA_MODEL, stats.goodModel, ...PREFER, ...list, ...ODD, process.env.NVIDIA_MODEL].filter(Boolean))].filter((m) => !(stats.bad || []).includes(m) && ((stats.slow || {})[m] || 0) < 2);
  let slowFails = 0;
  for (const model of tryModels) {
    if (slowFails >= 4) break; // 4 slow/timeout ke baad is round ko chhod do
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 1.0, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(100000),
      });
      if (!res.ok) { if ([400, 403, 404, 410, 422].includes(res.status)) { (stats.bad ||= []).push(model); console.log("Model chalta nahi, skip:", model, res.status); continue; } throw new Error("HTTP " + res.status); }
      const j = await res.json(); const ch = j.choices?.[0]?.message;
      const text = ch?.content || ch?.reasoning_content || "";
      let arr = []; const m = text.match(/\[[\s\S]*\]/);
      if (m) try { arr = JSON.parse(m[0]); } catch {}
      if (!arr.length) arr = [...text.matchAll(/"([A-Za-z]{4,12})"/g)].map((x) => x[1]);
      const out = [];
      for (const raw of arr) {
        const nm = typeof raw === "object" && raw ? raw.n || raw.name : raw, mean = typeof raw === "object" && raw ? String(raw.m || raw.meaning || "").slice(0, 90) : "", parts = typeof raw === "object" && raw ? String(raw.p || "").toLowerCase().replace(/[^a-z+]/g, "") : "";
        const n = String(nm || "").toLowerCase().trim().replace(/\.com$/, "");
        if (!(LMIN ? n.length >= LMIN && n.length <= LMAX && /^[a-z]+$/.test(n) : /^[a-z]{8,16}$/.test(n)) || aiSeen.has(n)) continue;
        aiSeen.add(n); appendFileSync(F_CHECKED, n + "\n");
        if (looksBrand(n)) out.push({ n, cat, m: mean, ...(parts.split("+").join("") === n && parts.includes("+") ? { p: parts } : {}) });
      }
      if (out.length) { stats.aiOk++; stats.goodModel = MODEL = model; if (stats.slow) delete stats.slow[model]; return out; }
      console.log("AI khali/filter:", model);
    } catch (e) { slowFails++; stats.slow ||= {}; stats.slow[model] = (stats.slow[model] || 0) + 1; console.log("AI fail:", model, e.message); if (stats.goodModel === model) stats.goodModel = ""; }
  }
  stats.aiFail++;
  return [];
}
function dictBatch(k = 60) {
  const out = [];
  if (!PAIRS.length) return out;
  for (let i = 0; i < k; i++) { const [n, m] = PAIRS[stats.cursor++ % PAIRS.length]; out.push({ n, cat: COINED ? `Coined ${COINED}-letter` : VOCAB ? `Curated ${W}-word (${LMIN}-${LMAX} letter)` : W === 1 ? `1-word dictionary (${LMIN}-${LMAX} letter)` : `${W || "2-3"}-word compound (${LMIN}-${LMAX} letter)`, m }); }
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
  let sc = cat.startsWith("AI") ? 92 : cat.startsWith("Coined") ? 85 : cat.startsWith("Curated") ? 80 : 72;
  sc -= Math.abs(n.length - 11) * 1.5; if (/[xzqj]/.test(n)) sc -= 3; return Math.round(sc);
}
function save() {
  stats.free = found.length; stats.updated = new Date().toISOString(); stats.model = MODEL;
  writeFileSync(F_FOUND, JSON.stringify(found)); writeFileSync(F_STATS, JSON.stringify(stats, null, 1));
}

// ---------- main ----------
const t0 = Date.now(), deadline = t0 + MINUTES * 60000;
let sinceSave = 0, newFree = 0;
console.log(`Miner shuru: ${MINUTES} min, model=${MODEL}, AI key ${KEY ? "hai" : "NAHI"}, compound candidates=${PAIRS.length}, pehle se free=${found.length}`);
async function worker(queue) {
  while (queue.length && Date.now() < deadline) {
    const { n, cat, m, p: pp, r: rk } = queue.shift();
    if (have.has(n)) continue;
    const dns = await dnsHas(`${n}.com`);
    const r = dns === true ? "taken" : await registry(n);
    if (r === "unknown") continue;
    stats.scanned++; sinceSave++; bump("s");
    if (r === "free") { have.add(n); found.push({ n, cat, s: score(n, cat), t: new Date().toISOString().slice(0, 10), ...(m ? { m } : {}), ...(pp ? { p: pp } : {}) }); newFree++; bump("f"); console.log("FREE", n + ".com", `(${cat})`); }
    if (sinceSave >= 300) { sinceSave = 0; save(); }
    await sleep(60);
  }
}
while (Date.now() < deadline) {
  let batch = await aiBatch();
  batch = [...batch, ...dictBatch(batch.length ? 40 : 120)];
  await Promise.all(Array.from({ length: CONC }, () => worker(batch)));
  console.log(`scanned ${stats.scanned} | free total ${found.length} (is run mein +${newFree})`);
}
save();
console.log(`Khatam. Is run mein +${newFree} free. Total free ${found.length}, scanned ${stats.scanned}`);
