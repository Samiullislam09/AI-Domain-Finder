// Domain Hunter (single file). Run:  node domain-hunter.mjs
// Sab kuch niche CONFIG mein badlo, ya command line se: node domain-hunter.mjs --min 4 --max 4 --want 20 --mode brute
// Output (folder "results/" mein): available-domains.txt, report.txt, all-checked.csv

import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { Resolver } from "node:dns/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ===================== CONFIG (yahan badlo) =====================
const CONFIG = {
  mode: "ai",             // "ai" = NVIDIA se brand-type naam | "list" = apni file se | "brute" = random combinations
  minLen: 4,              // kam se kam letters (4 se 8 default)
  maxLen: 8,              // zyada se zyada letters
  want: 20,               // kitne available domains mil jayein to ruk jao
  limit: 50000,           // maximum kitne naam check karne hain
  pattern: "pronounceable", // brute mode: "pronounceable" (bolne layak) ya "any" (koi bhi letters)
  batchSize: 100,         // ai mode: ek round mein AI se kitne naam maangne hain
  style: "tech / AI / marketing brand", // ai mode: kis type ka naam chahiye (yahan apna prompt likho)
  listFile: "my-list.txt",  // list mode: is file mein ek line = ek naam
};
// ================================================================

const here = path.dirname(fileURLToPath(import.meta.url));

// --- .env loader (NVIDIA_API_KEY yahan se ayegi) ---
const envFile = path.join(here, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1";

// --- command line flags CONFIG ko override karte hain ---
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, "");
  const v = process.argv[i + 1];
  if (!(k in CONFIG) || v === undefined) { console.error(`Galat flag: ${process.argv[i]}`); process.exit(1); }
  CONFIG[k] = typeof CONFIG[k] === "number" ? +v : v;
}
CONFIG.minLen = Math.max(2, Math.min(CONFIG.minLen, 10));
CONFIG.maxLen = Math.max(CONFIG.minLen, Math.min(CONFIG.maxLen, 10));

if (CONFIG.mode === "ai" && !NVIDIA_KEY) {
  console.error("AI mode ke liye .env file mein NVIDIA_API_KEY=... daalo (is script ke saath wale folder mein).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (n) => Math.floor(Math.random() * n);
const lenOk = new RegExp(`^[a-z]{${CONFIG.minLen},${CONFIG.maxLen}}$`);

// --- output files ---
const outDir = path.join(here, "results");
mkdirSync(outDir, { recursive: true });
const F_AVAIL = path.join(outDir, "available-domains.txt");
const F_REPORT = path.join(outDir, "report.txt");
const F_CSV = path.join(outDir, "all-checked.csv");
writeFileSync(F_AVAIL, "");
writeFileSync(F_CSV, "domain,dns,registry,final\n");

// --- stats ---
const S = {
  started: new Date(),
  checked: 0,            // kitne unique naam check hue
  dnsHas: 0,             // DNS mila -> taken
  dnsNone: 0,            // DNS nahi mila -> registry se confirm kiya
  dnsError: 0,           // DNS check fail (network)
  regTaken: 0,           // DNS nahi tha par registry mein registered tha
  regFree: 0,            // registry bhi bola free = AVAILABLE
  regUnknown: 0,         // registry jawab nahi de saki
  aiRounds: 0,
  aiGave: 0,             // AI ne total kitne naam diye
  aiBadFormat: 0,        // AI ne diye par length/letters galat the
  aiRepeat: 0,           // AI ne repeat kar diye
  aiUsable: 0,           // AI ke kitne naam check ke layak nikle
};
const available = [];
const seen = new Set();

// --- DNS (public resolvers, ISP ke jhoote jawab se bachne ke liye) ---
const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
async function dnsState(domain) {
  try { await resolver.resolveNs(domain); return "has"; }
  catch (e) {
    if (e.code === "ENOTFOUND") return "none";
    if (e.code === "ENODATA") return "has";
    return "error";
  }
}

// --- Verisign RDAP: .com ka official registry. 404 = registered nahi ---
async function registry(name) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, {
        headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) return "free";
      if (r.status === 200) return "taken";
      if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
      await sleep(1500);
    } catch { await sleep(1500); }
  }
  return "unknown";
}

// --- candidate sources ---
const V = "aeiou", C = "bcdfghjklmnpqrstvwxyz", L = "abcdefghijklmnopqrstuvwxyz";
const PRON = { 2: ["cv", "vc"], 3: ["cvc", "vcv", "cvv", "vcc"], 4: ["cvcv", "cvvc", "vcvc", "ccvc", "cvcc", "vccv"] };

function bruteBatch(size) {
  const out = []; let misses = 0;
  while (out.length < size && misses < 5000) {
    const len = CONFIG.minLen + rand(CONFIG.maxLen - CONFIG.minLen + 1);
    const pat = CONFIG.pattern === "pronounceable" && PRON[len] ? PRON[len][rand(PRON[len].length)] : "l".repeat(len);
    const name = [...pat].map((ch) => (ch === "c" ? C[rand(C.length)] : ch === "v" ? V[rand(V.length)] : L[rand(26)])).join("");
    if (seen.has(name)) { misses++; continue; }
    seen.add(name); out.push(name);
  }
  return out;
}

const ANGLES = [
  "coined blends of two short words (like Pinterest, Instagram, Spotify)",
  "invented words with modern endings like -ly, -ify, -io, -ora, -ex, -ix, -ai",
  "short words from Latin, Greek, Japanese or Sanskrit with a futuristic meaning",
  "nature, space, science and physics words twisted into brand names",
  "clean abbreviations and compound words for a tech startup",
  "strong action verbs and energetic words, slightly misspelled or shortened",
  "smooth, soft-sounding made-up words with vowels, easy to pronounce",
  "sharp, techy words with letters like x, z, q, k, v",
  "words about intelligence, speed, signal, light, mind, data and growth",
  "unusual but real English words that sound premium",
];

async function aiBatch() {
  const all = [...seen];
  const recent = all.slice(-250);
  const older = all.slice(0, -250).sort(() => Math.random() - 0.5).slice(0, 150);
  const avoid = [...recent, ...older].join(", ") || "none";
  // har round mein alag angle, taake AI repeat na kare
  const angle = ANGLES[rand(ANGLES.length)];
  const prompt = `Give me ${CONFIG.batchSize} domain-name candidates (before ".com").
Style / filter: ${CONFIG.style}
This round focus on: ${angle}
Rules: lowercase a-z only, length ${CONFIG.minLen} to ${CONFIG.maxLen} letters (spread the lengths evenly across the whole range, do not only use the shortest), no digits, no hyphens.
Think like a brand naming expert. Names must look and sound like real world brands (e.g. Bing, Hulu, Groq, Bard, Zoom, Slack, Uber, Nike): short, catchy, easy to say and spell, memorable, with a real brand feel. Mix real short words, coined brand words and clean abbreviations. NOT random letter strings.
Do NOT repeat any of these: ${avoid}
Reply with ONLY a JSON array of strings.`;
  // network/timeout/429/5xx par 4 baar retry (fetch failed aksar temporary hota hai)
  let res, lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${NVIDIA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: NVIDIA_MODEL, temperature: 1.0, max_tokens: Math.max(8000, CONFIG.batchSize * 60), messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) break;
      const body = (await res.text()).slice(0, 200);
      lastErr = new Error(`NVIDIA API ${res.status}: ${body}`);
      if (res.status !== 429 && res.status < 500) throw lastErr; // key/model galat: retry bekaar
    } catch (e) {
      if (e === lastErr && res && !res.ok && res.status < 500 && res.status !== 429) throw e;
      lastErr = e.cause ? new Error(`${e.message} (${e.cause.code || e.cause.message})`) : e;
    }
    res = null;
    if (attempt < 4) { console.error(`\nAI call fail (${lastErr.message}), retry ${attempt}/3...`); await sleep(3000 * attempt); }
  }
  if (!res) throw lastErr;
  const choice = (await res.json()).choices?.[0];
  const text = choice?.message?.content || choice?.message?.reasoning_content || "";
  const finish = choice?.finish_reason;
  const m = text.match(/\[[\s\S]*\]/);
  let arr = [];
  if (m) { try { arr = JSON.parse(m[0]); } catch {} }
  // JSON toota/adhoora ho to quotes ke andar ke words nikal lo
  if (!arr.length) arr = [...text.matchAll(/"([A-Za-z.]{2,20})"/g)].map((x) => x[1]);
  S.aiRounds++;
  const out = [];
  let bad = 0, rep = 0;
  for (const raw of arr) {
    S.aiGave++;
    const n = String(raw).toLowerCase().trim().replace(/\.com$/, "");
    if (!lenOk.test(n)) { S.aiBadFormat++; bad++; continue; }
    if (seen.has(n)) { S.aiRepeat++; rep++; continue; }
    seen.add(n); S.aiUsable++; out.push(n);
  }
  if (!out.length) console.log(`\n  (AI ne ${arr.length} diye: ${bad} galat length, ${rep} repeat${arr.length ? "" : ", jawab samajh nahi aaya, finish=" + finish + ": " + JSON.stringify(text.slice(0, 120))})`);
  return out;
}

let listQueue = null;
function listBatch() {
  if (!listQueue) {
    if (!existsSync(path.join(here, CONFIG.listFile))) throw new Error(`List file nahi mili: ${CONFIG.listFile}`);
    const words = readFileSync(path.join(here, CONFIG.listFile), "utf8").toLowerCase().split(/[^a-z]+/);
    listQueue = [...new Set(words.filter((w) => lenOk.test(w)))];
    listQueue.forEach((w) => seen.add(w));
  }
  return listQueue.splice(0, 200);
}

// --- report ---
function writeReport(reason) {
  const secs = Math.round((Date.now() - S.started) / 1000);
  const lines = [
    "DOMAIN HUNTER REPORT",
    `Chala: ${S.started.toLocaleString()}   |   Time laga: ${secs} sec   |   Roka kyun: ${reason}`,
    "",
    "--- Settings ---",
    `Mode: ${CONFIG.mode}   |   Letters: ${CONFIG.minLen} se ${CONFIG.maxLen}   |   Chahiye: ${CONFIG.want}   |   Max check: ${CONFIG.limit}`,
    CONFIG.mode === "ai" ? `AI style: ${CONFIG.style}` : CONFIG.mode === "brute" ? `Pattern: ${CONFIG.pattern}` : `List file: ${CONFIG.listFile}`,
    "",
    "--- Kitne naam check hue ---",
    `Total unique naam check kiye:            ${S.checked}`,
    `  DNS mila (matlab taken):               ${S.dnsHas}`,
    `  DNS nahi mila (registry se confirm):   ${S.dnsNone}`,
    `  DNS check fail (network):              ${S.dnsError}`,
    "",
    "--- Registry (Verisign) ne kya bola, un par jinka DNS nahi tha ---",
    `  Registered (taken, bina DNS ke):       ${S.regTaken}`,
    `  Free = AVAILABLE:                      ${S.regFree}`,
    `  Jawab nahi mila (unknown):             ${S.regUnknown}`,
  ];
  if (CONFIG.mode === "ai") {
    lines.push("",
      "--- AI ne kitne naam diye ---",
      `AI rounds:                               ${S.aiRounds}`,
      `AI ne total naam diye:                   ${S.aiGave}`,
      `  Galat format / length (hata diye):     ${S.aiBadFormat}`,
      `  Repeat (hata diye):                    ${S.aiRepeat}`,
      `  Check ke layak (check kiye gaye):      ${S.aiUsable}`);
  }
  lines.push("", `=== AVAILABLE .com DOMAINS: ${available.length} ===`, ...available);
  writeFileSync(F_REPORT, lines.join("\n") + "\n");
}

// --- main ---
let stopping = false;
process.on("SIGINT", () => { stopping = true; console.log("\nRok raha hoon, report likh raha hoon..."); });

console.log(`Shuru: mode=${CONFIG.mode}, ${CONFIG.minLen}-${CONFIG.maxLen} letter, ${CONFIG.want} domain chahiye (Ctrl+C se rok sakte ho)`);
let reason = "pura hua";
let emptyRounds = 0;
const MAX_EMPTY = 26;
try {
  while (!stopping && available.length < CONFIG.want && S.checked < CONFIG.limit) {
    const batch = CONFIG.mode === "ai" ? await aiBatch() : CONFIG.mode === "list" ? listBatch() : bruteBatch(200);
    if (!batch.length) {
      // AI ek round mein kaam ka kuch na de to dobara try karo; 25 baar lagataar khali aaye tabhi ruko
      if (CONFIG.mode === "ai" && ++emptyRounds < MAX_EMPTY) { console.log(`\nAI round khali/repeat aaya, dobara try (${emptyRounds}/${MAX_EMPTY - 1})...`); continue; }
      reason = "naam khatam ho gaye"; break;
    }
    emptyRounds = 0;
    // DNS 40-40 ek saath
    for (let i = 0; i < batch.length && !stopping && available.length < CONFIG.want && S.checked < CONFIG.limit; i += 40) {
      const chunk = batch.slice(i, i + 40);
      const states = await Promise.all(chunk.map((n) => dnsState(`${n}.com`)));
      for (let k = 0; k < chunk.length; k++) {
        if (stopping || available.length >= CONFIG.want || S.checked >= CONFIG.limit) break;
        const n = chunk[k]; S.checked++;
        const domain = `${n}.com`;
        if (states[k] === "has") { S.dnsHas++; appendFileSync(F_CSV, `${domain},has,,taken\n`); continue; }
        if (states[k] === "error") { S.dnsError++; appendFileSync(F_CSV, `${domain},error,,unknown\n`); continue; }
        S.dnsNone++;
        const r = await registry(n);
        if (r === "free") {
          S.regFree++; available.push(domain);
          appendFileSync(F_AVAIL, domain + "\n");
          appendFileSync(F_CSV, `${domain},none,free,AVAILABLE\n`);
          console.log(`✅ AVAILABLE  ${domain}   (${available.length}/${CONFIG.want})`);
        } else if (r === "taken") { S.regTaken++; appendFileSync(F_CSV, `${domain},none,taken,taken\n`); }
        else { S.regUnknown++; appendFileSync(F_CSV, `${domain},none,unknown,unknown\n`); }
        await sleep(500);
      }
      process.stdout.write(`\rchecked: ${S.checked}  available: ${available.length}   `);
    }
  }
  if (stopping) reason = "aapne Ctrl+C dabaya";
  else if (available.length >= CONFIG.want) reason = "chahiye utne mil gaye";
  else if (S.checked >= CONFIG.limit) reason = "max check limit poori hui";
} catch (e) {
  reason = "error: " + e.message;
  console.error("\nError:", e.message);
}
writeReport(reason);
console.log(`\n\nKhatam (${reason}). Checked: ${S.checked}, Available: ${available.length}`);
if (CONFIG.mode === "ai") console.log(`AI ne diye: ${S.aiGave}, check ke layak: ${S.aiUsable}`);
console.log(`Files: ${outDir}\n  report.txt  available-domains.txt  all-checked.csv`);
