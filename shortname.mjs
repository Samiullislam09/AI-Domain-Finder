// Chhote (3-6 letter) brandable naamon ke liye shared helpers: miner.mjs aur build-index.mjs dono use karte hain.
// Idea: asli English words se trigram model seekho, phir wo naam banao/pehchano jo "English jaise bolne mein" lagte hain
// (Hulu, Canva, Groq jaise invented naam), aur random / Russian-type / bolne mein mushkil naam hata do.
import { readFileSync, existsSync } from "node:fs";

const VOWELS = "aeiou";
const isV = (c) => VOWELS.includes(c);

// Bolne mein mushkil / asli brand jaisa nahi lagne wale naam hata do
export function friendly(n) {
  if (!/^[a-z]{3,8}$/.test(n)) return false;
  if (/[^aeiouy]{3,}/.test(n)) return false;                         // 3 consonant ek saath
  if (/[aeiou]{3,}/.test(n) || /(.)\1\1/.test(n)) return false;      // 3 vowel / teen baar same letter
  if (/(.)\1/.test(n) && /(aa|ii|uu|ww|vv|jj|qq|xx|zz)/.test(n)) return false;
  if (/q(?!u)/.test(n) || /[jqxz]{2}/.test(n)) return false;
  if (/(ov|ova|ev|eva|ski|sky|vich|zh|kh|shch|iy|yy|yev|yov)/.test(n)) return false;  // Russian/Slavic jaise
  if (/(pe|di|ve|i|u|j|q|v)$/.test(n)) return false;                // aap ne jo endings mana ki (pe, di, ve, i) + awkward ends
  const v = [...n].filter((c) => isV(c) || c === "y").length;
  if (v / n.length < 0.3 || v / n.length > 0.6) return false;
  return true;
}

// ---- trigram model (asli English words se) ----
export function buildModel(wordsFile) {
  const words = existsSync(wordsFile) ? readFileSync(wordsFile, "utf8").split(/\r?\n/).filter((w) => /^[a-z]{3,10}$/.test(w)) : [];
  const tri = new Map();
  for (const w of words) {
    const s = "^^" + w + "$";
    for (let i = 0; i + 2 < s.length; i++) {
      const k = s.slice(i, i + 2), c = s[i + 2];
      let m = tri.get(k); if (!m) tri.set(k, (m = new Map()));
      m.set(c, (m.get(c) || 0) + 1);
    }
  }
  for (const m of tri.values()) { let t = 0; for (const n of m.values()) t += n; m.total = t; }
  return { tri, dict: new Set(words), words };
}

// kitna "English jaisa" lagta hai (zyada = behtar)
export function likeness(model, n) {
  const s = "^^" + n + "$"; let lp = 0;
  for (let i = 0; i + 2 < s.length; i++) {
    const m = model.tri.get(s.slice(i, i + 2));
    lp += Math.log(((m ? m.get(s[i + 2]) || 0 : 0) + 0.01) / ((m ? m.total : 0) + 1));
  }
  return lp / (n.length + 1);
}

export function sampleName(model, len, rnd) {
  let s = "^^";
  while (s.length - 2 < len) {
    const m = model.tri.get(s.slice(-2)); if (!m) return null;
    let r = rnd() * m.total, pick = null;
    for (const [c, n] of m) { if (c === "$") { r -= n; continue; } r -= n; if (r <= 0) { pick = c; break; } }
    if (!pick) return null;
    s += pick;
  }
  return s.slice(2);
}

// Ek length ke liye candidates: model se sample, friendly + dictionary-word nahi, English-likeness ke hisaab se best pehle.
export function coinedCandidates(model, len, rnd, want = 120000) {
  const out = new Map(), tries = Math.min(4000000, want * 40);
  for (let i = 0; i < tries && out.size < want; i++) {
    const n = sampleName(model, len, rnd);
    if (n && n.length === len && !out.has(n) && !model.dict.has(n) && friendly(n)) out.set(n, likeness(model, n));
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}
