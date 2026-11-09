// Domain Scanner (bina AI ke). Run:  node scan-all.mjs
// Pehle saare 3-letter .com check karta hai, phir 4-letter (bolne layak pehle), jab tak WANT domains na mil jayein.
// Resume: dekhe hue naam results/scan-checked.txt mein save hote hain, dobara run karoge to wahin se aage chalega.
// Flags: node scan-all.mjs --want 5 --conc 50
// Output (results/): scan-FOUND.txt (free domains), scan-checked.txt (har dekha hua naam), scan-status.txt (live progress)

import { Resolver } from "node:dns/promises";
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (i % 2 === 0 ? [...a, [v.replace(/^--/, ""), arr[i + 1]]] : a), []));
const WANT = +(args.want ?? 5);
const CONC = +(args.conc ?? 50);

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "results");
mkdirSync(dir, { recursive: true });
const F_CHECKED = path.join(dir, "scan-checked.txt");
const F_FOUND = path.join(dir, args.mode === "file" ? "scan-FOUND-final.txt" : args.mode === "real" ? "scan-FOUND-real.txt" : args.mode === "brand" ? "scan-FOUND-brand.txt" : "scan-FOUND.txt");
const F_STATUS = path.join(dir, "scan-status.txt");

// pehle se dekhe hue naam (resume)
const done = new Set();
if (existsSync(F_CHECKED)) for (const l of readFileSync(F_CHECKED, "utf8").split(/\r?\n/)) { const n = l.split(",")[0]; if (n) done.add(n); }
const found = existsSync(F_FOUND) ? readFileSync(F_FOUND, "utf8").split(/\r?\n/).filter(Boolean) : [];

const L = "abcdefghijklmnopqrstuvwxyz", V = "aeiou", C = "bcdfghjklmnpqrstvwxyz";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function all(len) { let out = [""]; for (let i = 0; i < len; i++) out = out.flatMap((p) => [...L].map((c) => p + c)); return out; }
function pron4() {
  const pats = ["cvcv", "cvvc", "vcvc", "ccvc", "cvcc", "vccv"], set = new Set();
  for (const p of pats) {
    let out = [""];
    for (const ch of p) out = out.flatMap((s) => [...(ch === "c" ? C : V)].map((c) => s + c));
    out.forEach((s) => set.add(s));
  }
  return [...set];
}

const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
async function hasDns(d) {
  try { await resolver.resolveNs(d); return true; }
  catch (e) { return e.code === "ENOTFOUND" ? false : e.code === "ENODATA" ? true : null; } // null = pata nahi
}
// Verisign RDAP: 404 = free, 200 = taken
async function registry(name) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return "free";
      if (r.status === 200) return "taken";
      await sleep(r.status === 429 ? 5000 * (i + 1) : 1500);
    } catch { await sleep(1500); }
  }
  return "unknown";
}

const stats = { started: Date.now(), checked: 0, taken: 0, free: 0, unknown: 0, phase: "" };
let lastStatus = 0;
function status(force) {
  if (!force && Date.now() - lastStatus < 3000) return;
  lastStatus = Date.now();
  const secs = Math.round((Date.now() - stats.started) / 1000);
  writeFileSync(F_STATUS, [
    `Phase: ${stats.phase}`, `Is run mein check hue: ${stats.checked}  (pehle se done: ${done.size - stats.checked})`,
    `Taken: ${stats.taken}   Free: ${stats.free}   Unknown: ${stats.unknown}   Time: ${secs} sec`,
    "", `=== AVAILABLE .com DOMAINS: ${found.length}/${WANT} ===`,
    ...found.map((d, i) => `${String(i + 1).padStart(3)}. ${d}`),
  ].join("\n") + "\n");
  process.stdout.write(`\r[${stats.phase}] checked ${stats.checked} | free ${found.length}/${WANT}   `);
}

async function check(n) {
  const dns = await hasDns(`${n}.com`);
  let result;
  if (dns === true) result = "taken";
  else result = await registry(n); // DNS nahi ya pata nahi -> registry se pakka karo
  if (result === "unknown") { stats.unknown++; return; } // save nahi karte, agli run mein dobara try hoga
  done.add(n); stats.checked++;
  appendFileSync(F_CHECKED, `${n},${result}\n`);
  if (result === "free") {
    stats.free++; found.push(`${n}.com`); appendFileSync(F_FOUND, `${n}.com\n`);
    console.log(`\n✅ AVAILABLE  ${n}.com   (${found.length}/${WANT})`);
  } else stats.taken++;
}

async function runPhase(label, names) {
  stats.phase = label;
  const queue = names.filter((n) => !done.has(n));
  console.log(`\n${label}: ${queue.length} naam baaki (${names.length - queue.length} pehle se dekhe hue)`);
  let i = 0;
  const worker = async () => { while (i < queue.length && found.length < WANT) { await check(queue[i++]); status(); } };
  await Promise.all(Array.from({ length: CONC }, worker));
  status(true);
}

// --- coined mode: 5-6 letter brand-jaise bolne layak naam (random, kam memory) ---
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const ON = ["b","br","c","cr","d","dr","f","fl","g","gr","h","j","k","l","m","n","p","pr","r","s","st","t","tr","v","z","qu","w","bl","cl","gl","pl"];
const VW = ["a","e","i","o","u","a","e","i","o","io","ea"];
const CD = ["","","","n","r","l","s","x","m","t","k"];
const END = ["ix","ex","ora","ify","ly","io","ia","eo","ino","ova","ara","ium","era","ox","um","ano","ula","eon"];
function coinedName(minL, maxL) {
  for (let t = 0; t < 50; t++) {
    let n;
    const k = Math.random();
    if (k < 0.45) n = rnd(ON) + rnd(VW) + rnd(CD) + rnd(ON) + rnd(VW) + rnd(CD);           // 2 syllables
    else if (k < 0.8) n = rnd(ON) + rnd(VW) + rnd(ON.slice(0, 30)) + rnd(END);              // syllable + brand-ending
    else n = rnd(ON) + rnd(VW) + rnd(CD) + rnd(ON) + rnd(VW);                               // clean 2-syllable
    if (/^[a-z]+$/.test(n) && n.length >= minL && n.length <= maxL && !/(.)\1\1/.test(n)) return n;
  }
  return null;
}
async function runCoined(minL, maxL, limit) {
  stats.phase = `coined ${minL}-${maxL} letter`;
  console.log(`\n${stats.phase}: random bolne layak naam, max ${limit} check`);
  let tried = 0, fails = 0;
  const worker = async () => {
    while (found.length < WANT && tried < limit && fails < 50000) {
      const n = coinedName(minL, maxL);
      if (!n || done.has(n)) { fails++; continue; }
      done.add(n); // abhi mark, check mein save hoga
      tried++; await check(n); status();
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  status(true);
}

// --- brand mode: AI / automation SaaS jaise naam (Groq, DeepSeek, AutoAgent style blends) ---
const PRE = ["auto","flow","mind","nex","syn","cog","neur","zen","arc","vox","lum","data","bot","agi","pilot","logic","sync","loop","wave","spark","node","core","vect","prime","nova","apex","flux","hive","kern","deep","smart","swift","quick","rapid","brain","think","quant","omni","ultra","hyper","meta","pixel","signal","orbit","pulse","cloud","task","work","agent","chain","trace","scale","boost","lift","zap","jet","ion","iris","echo","atlas","helix","onyx","lyra","nimbus","vertex","cipher","delta","sigma","alpha","beta","gamma","omega"];
const SUF = ["ly","io","ai","ify","flow","mind","bot","hub","base","grid","wise","pilot","forge","loop","ops","mate","sync","stack","deck","kit","lab","nest","works","able","ize","ora","ix","ex","ia","ar","or","en","on","us","um","eo","ino","wave","spark","node","core","brain","think","agent","task","path","gen","mesh","line","yard","dock","port","bit","byte"];
function brandName(minL, maxL) {
  for (let t = 0; t < 60; t++) {
    const a = rnd(PRE), b = rnd(SUF), k = Math.random();
    let n;
    if (k < 0.45) n = a + b;                                              // autoflow, mindops
    else if (k < 0.75) n = a.slice(0, 2 + Math.floor(Math.random() * 3)) + b; // clipped: nexora, cogify
    else if (k < 0.9) n = rnd(PRE).slice(0, 3 + Math.floor(Math.random() * 2)) + rnd(PRE).slice(-3 - Math.floor(Math.random() * 2)); // blend: deepmind-style
    else n = a + rnd(["a","o","i","e","y"]); // nova -> novae etc
    if (/^[a-z]+$/.test(n) && n.length >= minL && n.length <= maxL && !/(.)\1\1/.test(n) && !/[^aeiou]{4}/.test(n) && /[aeiou]/.test(n)) return n;
  }
  return null;
}
async function runGen(label, gen, minL, maxL, limit) {
  stats.phase = `${label} ${minL}-${maxL} letter`;
  console.log(`\n${stats.phase}: max ${limit} naam check honge`);
  let tried = 0, fails = 0;
  const worker = async () => {
    while (found.length < WANT && tried < limit && fails < 50000) {
      const n = gen(minL, maxL);
      if (!n || done.has(n)) { fails++; continue; }
      done.add(n); tried++; await check(n); status();
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  status(true);
}

process.on("SIGINT", () => { status(true); console.log("\nRok diya. Dobara chalaoge to wahin se aage chalega."); process.exit(0); });

if (args.mode === "file") {
  // koi bhi candidates file: har line ka pehla hissa (comma se pehle) = naam, upar wale pehle check hote hain
  const cf = path.resolve(args.file ?? "results/candidates-startup.txt");
  if (!existsSync(cf)) { console.error(`File nahi mili: ${cf}`); process.exit(1); }
  const list = [...new Set(readFileSync(cf, "utf8").split(/\r?\n/).flatMap((l) => (/\s/.test(l.trim()) ? l.trim().split(/\s+/) : [l.split(",")[0]])).map((n) => n.trim().toLowerCase()).filter((n) => /^[a-z]{3,12}$/.test(n)))];
  console.log(`Shuru (file): ${WANT} domain chahiye, ${list.length} naam queue mein (best pehle).`);
  await runPhase("startup names", list);
} else if (args.mode === "real") {
  const cf = path.join(dir, "candidates-100k.txt");
  if (!existsSync(cf)) { console.error("Pehle chalao: node brand-gen.mjs"); process.exit(1); }
  const list = readFileSync(cf, "utf8").split(/\r?\n/).map((l) => l.split(",")[0]).filter(Boolean);
  console.log(`Shuru (real): ${WANT} domain chahiye, ${list.length} real-brand-jaise naam queue mein (best pehle).`);
  await runPhase("real brand", list);
} else if (args.mode === "brand") {
  console.log(`Shuru (brand): ${WANT} domain chahiye, ${args.min ?? 5}-${args.max ?? 7} letter, AI/automation SaaS style.`);
  // brand blends mein hit rate kam hota hai, isliye aadhe coined (saaf bolne layak) se mix karte hain
  await runGen("brand", (a, b) => (Math.random() < +(args.blend ?? 0.7) ? brandName(a, b) : coinedName(a, b)), +(args.min ?? 5), +(args.max ?? 7), +(args.limit ?? 300000));
} else if (args.mode === "coined") {
  console.log(`Shuru (coined): ${WANT} domain chahiye, ${args.min ?? 5}-${args.max ?? 6} letter.`);
  if (found.length < WANT) await runCoined(+(args.min ?? 5), +(args.max ?? 6), +(args.limit ?? 200000));
} else {
  console.log(`Shuru: ${WANT} domain chahiye. Pehle 3-letter, phir 4-letter.`);
  if (found.length < WANT) await runPhase("3-letter", all(3));
  if (found.length < WANT) await runPhase("4-letter bolne layak", shuffle(pron4()));
  if (found.length < WANT) await runPhase("4-letter koi bhi", shuffle(all(4)));
}
status(true);
console.log(`\n\nKhatam. Mile: ${found.length}\n${found.join("\n")}\nFile: ${F_FOUND}`);
