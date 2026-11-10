// Chhote (3-6 letter) brandable naamon ke liye shared helpers: miner.mjs aur build-index.mjs dono use karte hain.
// Idea: asli English words se trigram model seekho, phir wo naam banao/pehchano jo "English jaise bolne mein" lagte hain
// (Hulu, Canva, Groq jaise invented naam), aur random / Russian-type / bolne mein mushkil naam hata do.
import { readFileSync, existsSync } from "node:fs";

const VOWELS = "aeiou";
const isV = (c) => VOWELS.includes(c);

// Bolne mein mushkil / asli brand jaisa nahi lagne wale naam hata do.
// Naam English ki tarah syllables mein toot'na chahiye: [onset] + vowel(s) + [coda], onset sirf valid (bl, br, st, tr ... ya ek consonant).
const ONSETS = new Set("bl br ch cl cr dr fl fr gl gr ph pl pr sc sh sk sl sm sn sp st sw th tr tw wh wr".split(" "));
const END_CODA = new Set("nd nt rd rt rk rm rn rl lt ld lk lm ls st sk sp ct ft mp nk ng ts ps ks".split(" "));
const CONS = "bcdfghjklmnprstvwyz";
const DIGRAPHS = new Set("ai ea ee oa oo ui ia io".split(" "));
function syllables(s, i, count) {
  if (i === s.length) return count > 0;
  for (const ol of [2, 1, 0]) {
    const on = s.slice(i, i + ol);
    if (ol === 2 && !ONSETS.has(on)) continue;
    if (ol === 1 && !CONS.includes(on)) continue;
    for (const vl of [2, 1]) {
      const v = s.slice(i + ol, i + ol + vl);
      if (v.length !== vl || ![...v].every((c) => isV(c))) continue;
      const k = i + ol + vl;
      if (k === s.length) return true;
      // coda: 0 (next syllable starts right away), 1 consonant, or (at the very end) a valid 2-letter cluster
      if (syllables(s, k, count + 1)) return true;
      if (CONS.includes(s[k]) && syllables(s, k + 1, count + 1)) return true;
      if (k + 2 === s.length && END_CODA.has(s.slice(k, k + 2))) return true;
    }
  }
  return false;
}
export function friendly(n) {
  if (!/^[a-z]{3,8}$/.test(n)) return false;
  if (/q(?!u)/.test(n) || /[jqxz]{2}/.test(n)) return false;
  if (/(ov|ova|ev|eva|ski|sky|vich|zh|kh|shch|iy|yy|yev|yov)/.test(n)) return false;  // Russian/Slavic jaise
  if (/(pe|di|ve|i|j|q|v)$/.test(n)) return false;                                      // aap ne jo endings mana ki (pe, di, ve, i) + awkward ends
  if (!CONS.includes(n[0])) return false;                                               // consonant se shuru (brand jaise)
  if (/(ed|es|er|ly|ng|ts|ds|gs|ks|ns|rs|ls)$/.test(n)) return false;                    // verb / plural jaise endings
  for (const m of n.matchAll(/[aeiou]{2}/g)) if (!DIGRAPHS.has(m[0])) return false;     // sirf aam vowel jodi
  const v = [...n].filter((c) => isV(c)).length;
  if (v / n.length < 0.3 || v / n.length > 0.6) return false;
  return syllables(n, 0, 0);
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
  // sabse kam "English jaise" 30% hata do, baaki ko mila do (Random naam: -tion/-mance jaise tukde pehle na aayein)
  const sorted = [...out.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const keep = sorted.slice(0, Math.ceil(sorted.length * 0.7));
  for (let i = keep.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [keep[i], keep[j]] = [keep[j], keep[i]]; }
  return keep;
}
