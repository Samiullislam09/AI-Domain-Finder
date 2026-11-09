// Phonetically simple / euphonious / catchy / short brand-style naam (v2: sirf aam English syllables).
// Run:  node phonetic-names.mjs   ->  results/candidates-phonetic.txt  (sabse smooth naam pehle)
// Phir:  node scan-all.mjs --mode file --file results/candidates-phonetic.txt --want 200 --conc 30

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(here, "results"), { recursive: true });
const OUT = path.join(here, "results", "candidates-phonetic.txt");

// Sirf woh syllables jo asli brands/words mein aam hain (Nike, Zoom, Bolo, Mino, Vero...)
const SYL = "ba be bo da de di do ka ko la le li lo ma me mi mo na ne no pa pe po ra re ri ro sa se si so ta te ti to va ve vo zo di".split(" ");
const CODA = ["n", "l", "r", "s", "m", "x"];
const isV = (c) => "aeiou".includes(c);
const SOFT = new Set("lmnr");

const cands = new Map();
const add = (n, extra = 0) => {
  const cons = n.split("").filter((c) => !isV(c));
  if (new Set(cons).size !== cons.length) return;           // consonant repeat nahi
  const vows = n.split("").filter(isV);
  if (new Set(vows).size < 2) return;                         // kam se kam 2 alag vowels
  if (/(.)\1/.test(n)) return;
  let s = extra;
  s += cons.filter((c) => SOFT.has(c)).length === 1 ? 3 : 0;  // ek smooth consonant
  s += isV(n[n.length - 1]) ? 3 : 1;
  s += "ao".includes(n[n.length - 1]) ? 2 : 0;                // -a / -o par khatam = catchy
  s += new Set(vows).size;
  if (/[xz]/.test(n)) s -= 1;
  cands.set(n, s + Math.random() * 3);
};
// 6 letter, 3 syllable
for (const a of SYL) for (const b of SYL) for (const c of SYL) add(a + b + c, 4);
// 5 letter: 2 syllable + coda, ya syllable + 'cv' + vowel-ending
for (const a of SYL) for (const b of SYL) for (const e of CODA) add(a + b + e, 2);
// 4 letter (2 syllable) - zyadatar taken, par check ho jayega
for (const a of SYL) for (const b of SYL) add(a + b, 0);

const list = [...cands.entries()].sort((x, y) => y[1] - x[1]);
writeFileSync(OUT, list.map(([n]) => n).join("\n") + "\n");
console.log(`Bane: ${list.length} naam -> ${OUT}`);
console.log("Namoone:", list.slice(0, 40).map((x) => x[0]).join(", "));
