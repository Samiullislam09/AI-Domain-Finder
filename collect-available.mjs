// Ab tak mile saare free .com domains ek file mein, category ke hisaab se.
// Run:  node collect-available.mjs   ->  results/ALL-AVAILABLE-DOMAINS.txt
// (Har scan ke baad dobara chala sakte ho.) Khareedne se pehle registrar par availability dobara confirm karo.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "results");
const read = (f) => (existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).map((l) => l.trim().replace(/\.com$/, "")).filter((n) => /^[a-z]{3,14}$/.test(n)) : []);

// (file, category) : upar wali category ko priority (ek naam sirf ek jagah aayega)
const SOURCES = [
  ["MrLxwa ke apne naam (verify ho chuke)", ["mrlxwa", "getmrlxwa", "trymrlxwa", "usemrlxwa", "mrlxwahq", "gomrlxwa", "mrlxwaai", "lxwaai"]],
  ["PHONETIC", read("scan-FOUND-final.txt")],
  ["Short phonetic (4-5 letter, par gibberish jaise, kamzor)", read("scan-FOUND-phonetic-short.txt")],
  ["Simple English meaning wale (kam mile)", [...read("scan-FOUND-simple-compounds.txt")]],
  ["Hand-written coined naam", read("scan-FOUND-final-hand.txt")],
  ["Brand-style blends (AI/automation words)", [...read("scan-FOUND-brand.txt"), ...read("scan-FOUND-brand-mixed.txt")]],
  ["Word + brand-ending (-ino, -ova, -ora...)", read("scan-FOUND-rule-based.txt")],
  ["English word jod (kamzor)", [...read("scan-FOUND-english-compounds.txt"), ...read("scan-FOUND-real.txt"), ...read("scan-FOUND-real-old-junk.txt")]],
  ["Random coined (sabse kamzor)", read("scan-FOUND.txt")],
];

const isV = (c) => "aeiou".includes(c);
function phoneticType(n) {
  const pat = n.split("").map((c) => (isV(c) ? "v" : "c")).join("");
  const endsV = isV(n[n.length - 1]);
  const soft = /[lmnr]/.test(n);
  if (n.length <= 5) return "1. Short Brand Names (chhote, 4-5 letter)";
  if (endsV && soft) return "2. Euphonious Names (smooth, sunne mein pleasant)";
  if (/^(cv)+c?$/.test(pat)) return "3. Phonetically Simple (bolne mein easy)";
  if (/^[bdkpt]/.test(n)) return "4. Catchy Names (sunte hi yaad)";
  return "5. Memorable Brand Names";
}

const seen = new Set();
const sections = [];
for (const [cat, list] of SOURCES) {
  const names = [];
  for (const n of list) if (!seen.has(n)) { seen.add(n); names.push(n); }
  if (!names.length) continue;
  if (cat === "PHONETIC") {
    const groups = {};
    for (const n of names) (groups[phoneticType(n)] ||= []).push(n);
    for (const g of Object.keys(groups).sort()) sections.push([`PHONETIC / ${g}`, groups[g]]);
  } else sections.push([cat, names]);
}

const total = sections.reduce((a, [, l]) => a + l.length, 0);
const out = [
  "ALL AVAILABLE .com DOMAINS (ab tak ke saare scan, category ke hisaab se)",
  `Total: ${total}   |   Banaya: ${new Date().toLocaleString()}`,
  "NOTE: 'Free' scan ke waqt ka hai. Khareedne se pehle registrar par dobara confirm karo + trademark check karo.",
  "",
];
for (const [cat, list] of sections) out.push(`=== ${cat}  (${list.length}) ===`, ...list.map((n) => `  ${n}.com`), "");
writeFileSync(path.join(dir, "ALL-AVAILABLE-DOMAINS.txt"), out.join("\n"));
console.log(`Total ${total} domains, ${sections.length} categories -> results/ALL-AVAILABLE-DOMAINS.txt`);
for (const [cat, list] of sections) console.log(`  ${String(list.length).padStart(4)}  ${cat}`);
