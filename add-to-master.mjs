// Nayi batch ke free domains ko master file (results/FOUND-ALL-CATEGORIZED.txt) mein NAYI CATEGORY ke roop mein jodta hai.
// Numbering continue hoti hai, summary aur totals update hote hain, duplicate naam skip hote hain.
//
// Run:  node add-to-master.mjs --name "Category ka naam" --file results/scan-FOUND-final.txt --scanned 1924 --note "kya hai"
//   --file : ek naam har line mein (domain.com ya naam). "## Group" wali line se sub-group ban jata hai.
//   --scanned : is batch mein kitne naam scan hue.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (i % 2 === 0 ? [...a, [v.replace(/^--/, ""), arr[i + 1]]] : a), []));
const here = path.dirname(fileURLToPath(import.meta.url));
const MASTER = path.join(here, "results", "FOUND-ALL-CATEGORIZED.txt");
if (!args.name || !args.file) { console.error('Use: node add-to-master.mjs --name "..." --file <file> --scanned N --note "..."'); process.exit(1); }
if (!existsSync(MASTER)) { console.error("Master file nahi mili: " + MASTER); process.exit(1); }

const lines = readFileSync(MASTER, "utf8").split(/\r?\n/);
const iSum = lines.findIndex((l) => l.startsWith("=== SUMMARY"));
const iFirstSec = lines.findIndex((l, i) => i > iSum && l.startsWith("=== ") && !l.startsWith("=== SUMMARY"));
const header = lines.slice(0, iSum);
const summary = lines.slice(iSum, iFirstSec);
const body = lines.slice(iFirstSec);
while (body.length && body[body.length - 1] === "") body.pop();

// pehle se maujood naam aur numbering
const have = new Set(), nums = [];
for (const l of body) { const m = l.match(/^\s*(\d+)\.\s+([a-z0-9-]+)\.com\s*$/); if (m) { nums.push(+m[1]); have.add(m[2]); } }
let k = Math.max(0, ...nums);

// nayi batch parho
const groups = [["", []]];
const dup = [];
for (const raw of readFileSync(path.resolve(args.file), "utf8").split(/\r?\n/)) {
  const t = raw.trim();
  if (!t) continue;
  if (t.startsWith("##")) { groups.push([t.replace(/^#+\s*/, ""), []]); continue; }
  const n = t.replace(/^\d+\.\s*/, "").replace(/\.com$/, "").toLowerCase();
  if (!/^[a-z0-9-]{3,30}$/.test(n)) continue;
  if (have.has(n)) { dup.push(n); continue; }
  have.add(n); groups[groups.length - 1][1].push(n);
}
const fresh = groups.reduce((a, [, l]) => a + l.length, 0);
if (!fresh) { console.log("Koi naya naam nahi (sab pehle se master mein hain)."); process.exit(0); }

// category number = pichli category ke baad
const catNums = body.filter((l) => /^=== \d+\./.test(l)).map((l) => +l.match(/^=== (\d+)\./)[1]);
const catNo = String(Math.max(0, ...catNums) + 1).padStart(2, "0");
const scanned = +(args.scanned ?? 0);
const title = `${catNo}. ${args.name}`;

body.push("", `=== ${title} ===`, `    Scan: ${scanned} | Free: ${fresh} | Jodha gaya: ${new Date().toLocaleDateString()}${args.note ? " | " + args.note : ""}`);
for (const [g, list] of groups) {
  if (!list.length) continue;
  if (g) body.push(`  -- ${g} (${list.length}) --`);
  for (const n of list) body.push(`  ${String(++k).padStart(4)}. ${n}.com`);
}
body.push("");

// summary row + header totals
const hit = scanned ? (100 * fresh / scanned).toFixed(1) : "0.0";
const row = `  ${title}`.slice(0, 64).padEnd(66) + String(scanned).padStart(8) + String(fresh).padStart(7) + `  ${hit}%`;
const sumLines = summary.filter((l) => l !== "");
sumLines.push(row, "");
const num = (s) => +s.replace(/,/g, "");
let newHeader = header.map((l) => {
  if (l.startsWith("Total scan hue")) {
    const m = l.match(/Total scan hue:\s*([\d,]+)[^|]*\|\s*Total free mile:\s*(\d+)/);
    if (m) return `Total scan hue: ${(num(m[1]) + scanned).toLocaleString()} naam (.com)   |   Total free mile: ${num(m[2]) + fresh}`;
  }
  if (l.startsWith("Banaya:")) return `Banaya: ${l.replace("Banaya: ", "").split("  |")[0]}  |  Aakhri update: ${new Date().toLocaleString()}`;
  return l;
});
writeFileSync(MASTER, [...newHeader, ...sumLines, ...body].join("\n") + "\n");
console.log(`Master mein "${title}" jodi: ${fresh} naye domains (numbers ${k - fresh + 1}-${k})${dup.length ? `, ${dup.length} duplicate skip` : ""}`);
