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
const F_FOUND = path.join(dir, "scan-FOUND.txt");
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
    `Taken: ${stats.taken}   Free: ${stats.free}   Unknown: ${stats.unknown}`,
    `Mile hue (total ${found.length}/${WANT}): ${found.join(", ") || "-"}`, `Time: ${secs} sec`,
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

process.on("SIGINT", () => { status(true); console.log("\nRok diya. Dobara chalaoge to wahin se aage chalega."); process.exit(0); });

if (args.mode === "coined") {
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
