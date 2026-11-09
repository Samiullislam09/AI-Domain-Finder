// Real-brand-jaise naam banata hai (random letters nahi). Run:  node brand-gen.mjs  [--count 100000]
// Real English words se: compound (Facebook, Deepseek, Chatgpt), word+suffix (Spotify, Shopify), halka badla hua word (Flickr, Tumblr).
// Output: results/candidates-100k.txt  (naam,score,type)  -> sabse achhe naam pehle.
// scan-all.mjs --mode real isi file ko check karta hai.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "results");
mkdirSync(dir, { recursive: true });
const WORDS = path.join(dir, "words-common.txt");
export const CANDIDATES = path.join(dir, "candidates-100k.txt");

// AI / automation / SaaS jaise sahi lagne wale words (jo naam ke saath brand feel dete hain)
const TECH = `auto flow mind deep smart agent task bot chat brain logic sync pilot loop link data cloud code spark wave node core hive nest hub grid stack forge craft swift quick rapid fast bright clear sharp keen wise sage nova apex prime flux pulse signal orbit echo atlas iris onyx lumen vector quant cipher delta sigma alpha beta omega zen ion arc vox pixel byte bit mesh path trace scale boost lift zap jet work ops desk mate buddy ally genie muse oracle scout rover ranger maker builder helper runner solver fixer tuner glide drift bloom grow sprout leaf root seed stream river ocean tide breeze storm bolt blaze ember flame glow shine beam ray lens focus view vision sight insight mirror prism think learn teach tutor study read write draw paint design make build plan route guide map chart graph metric track watch guard shield safe lock key gate door bridge tower pillar beacon lantern compass anchor sail wing feather hawk eagle falcon fox wolf lion tiger otter panda koala lynx raven robin swift crane heron spark ember pixel quark photon atom orbit comet lunar solar stellar cosmic galaxy nebula vertex apex zenith summit peak ridge crest dune delta`.split(/\s+/);
const STRONG = ["ify", "ly", "io", "ai", "er", "ster", "able", "ful", "ora", "ium", "ex", "ix"]; // asli brand suffix
const WEAK = ["ia", "ra", "ee", "ie", "o", "ana", "ova"];                                         // kam score
// common list mein abbreviations / kachra words jo naam mein nahi chahiye
const JUNK = new Set("who had his her him she did how why not few off per end add got non one two its san jan feb mar apr jun jul aug sep sept oct nov dec was has have been were are you your our out any all can may will than then them they that this what when where which while with from into over under also just only very much many more most such some each both same other another ever even still back down here there their these those about after again before being could would should might must shall does done goes gone came come made take took give gave said says see saw yet nor via ago own too pda pdas pdf mrs mls url usb dvd cds cd html http www com org net inc ltd llc mba isbn phd faq fax sms mms mpg rss xml sql ssl dns ftp cpu gpu ram rom lcd led gps cnn bbc nfl nba usa uk eu ie ii iii vs etc ads asp jsp php cgi tel ref rev vol dev pic pics mag mod msg org".split(" "));

// bahut aam words: naam ko "generic" banate hain, inka score kam
const GENERIC = new Set("map key view data link work make read plan code task path track watch write draw design build guide chart graph metric door gate lock safe desk team room name page site list form file fix run get set top big new old low high free open one two".split(" "));

function loadCommon() {
  return readFileSync(WORDS, "utf8").split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]+$/.test(w) && !JUNK.has(w) && /[aeiouy]/.test(w) && !(w.endsWith("s") && !w.endsWith("ss") && w.length > 3));
}

const isVowel = (c) => "aeiou".includes(c);
function pronounceOk(n) {
  if (/(.)\1\1/.test(n)) return false;
  if (/[^aeiouy]{4}/.test(n)) return false;      // 4 consonant ek saath = bolna mushkil
  if (/[aeiou]{3}/.test(n)) return false;
  if (!/[aeiou]/.test(n.replace(/y/g, "")) && !/y/.test(n)) return false;
  return true;
}

export function generate(count = 100000) {
  const common = loadCommon();
  const rank = new Map(); common.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });
  const techSet = new Set(TECH);
  const techRank = (w) => (rank.has(w) ? rank.get(w) : 3000);
  // common words jo naam ke hisse bante hain: 3-6 letter, rank 60..7000
  const parts = [...new Set(common.filter((w, i) => i > 60 && i < 7000 && w.length >= 3 && w.length <= 6))];
  const tech = [...new Set(TECH.filter((w) => w.length >= 2 && w.length <= 7))];

  const map = new Map(); // naam -> {score,type}
  let curParts = [];
  const add = (n, score, type) => {
    if (n.length < 5 || n.length > 7 || !pronounceOk(n)) return;
    for (const w of curParts) if (GENERIC.has(w)) score -= 14;
    const old = map.get(n);
    if (!old || old.score < score) map.set(n, { score, type, parts: curParts });
  };
  const lenBonus = (n) => (n.length === 6 ? 6 : n.length === 7 ? 5 : 3);
  const fam = (w) => 12 - Math.min(12, techRank(w) / 600); // jaana-pehchana word = zyada score

  // 1) compound: tech+tech, tech+word, word+tech  (Deepseek, Chatgpt, Autoagent jaisa)
  for (const a of tech) for (const b of tech) if (a !== b) { curParts = [a, b]; add(a + b, 60 + fam(a) + fam(b) + lenBonus(a + b), "tech+tech"); }
  for (const a of tech) for (const b of parts) {
    if (a === b || b.includes(a) || a.includes(b)) continue;
    curParts = [a, b];
    add(a + b, 45 + fam(a) + fam(b) + lenBonus(a + b), "tech+word");
    add(b + a, 42 + fam(a) + fam(b) + lenBonus(a + b), "word+tech");
  }
  // 2) word + suffix (Spotify, Shopify, Grammarly jaisa)
  for (const w of [...tech, ...parts.filter((p) => p.length <= 5)]) {
    for (const s of [...STRONG, ...WEAK]) {
      if (w.endsWith("y") && (s[0] === "l" || "aeiouy".includes(s[0]))) continue; // easy+ly jaisa kharab
      if (w.endsWith(s[0]) && s.length === 1) continue;
      curParts = [w, s];
      let n = w + s;
      if (w.endsWith("e") && "aeiouy".includes(s[0])) n = w.slice(0, -1) + s; // make+ify -> makify
      const weak = WEAK.includes(s) ? -18 : 0;
      add(n, 50 + weak + fam(w) + (techSet.has(w) ? 10 : 0) + lenBonus(n), "word+suffix");
    }
  }
  // 3) halka badla hua word (Flickr, Tumblr, Lyft style): er->r, c->k, ck->k, ee->i, ight->ite
  for (const w of [...tech, ...parts]) {
    curParts = [w];
    const alts = [];
    if (w.endsWith("er")) alts.push(w.slice(0, -2) + "r");
    if (w.endsWith("or")) alts.push(w.slice(0, -2) + "r");
    if (w.includes("ck")) alts.push(w.replace("ck", "k"));
    if (w.includes("c") && !w.includes("ch") && !w.includes("ck")) alts.push(w.replace("c", "k"));
    if (w.includes("ee")) alts.push(w.replace("ee", "i"));
    if (w.endsWith("y")) alts.push(w.slice(0, -1) + "i");
    if (w.endsWith("s") && w.length > 4) alts.push(w.slice(0, -1) + "z");
    for (const a of alts) add(a, 35 + fam(w) + (techSet.has(w) ? 8 : 0) + lenBonus(a), "twist");
  }
  // 4) tech compound ke saath twist: auto+flow -> autoflo
  for (const a of tech) for (const b of tech) if (a !== b && b.endsWith("er") === false) {
    const n = a + b;
    if (n.length >= 6 && n.length <= 8 && n.endsWith("w")) add(n.slice(0, -1) + "", 30 + fam(a) + fam(b), "clip");
  }
  // 5) asli single words (Slack, Zoom, Stripe jaisa) - mostly taken par check karte hain
  curParts = [];
  for (const w of common.slice(60, 5000)) if (w.length >= 5 && w.length <= 7) add(w, 40 + fam(w) + lenBonus(w), "word");
  for (const w of tech) if (w.length >= 5 && w.length <= 7) add(w, 55 + fam(w) + lenBonus(w), "word");

  // diversity: ek hi word (jaise "map") baar-baar top par na aaye
  const sorted = [...map.entries()].sort((x, y) => y[1].score - x[1].score);
  const used = new Map();
  const adj = sorted.map(([n, v]) => {
    let pen = 0;
    for (const w of v.parts) { const c = used.get(w) || 0; pen += Math.min(c, 400) * 0.08; used.set(w, c + 1); }
    return { n, score: v.score - pen, type: v.type };
  });
  return adj.sort((x, y) => y.score - x.score).slice(0, count);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ci = process.argv.indexOf("--count");
  const count = ci > 0 ? +process.argv[ci + 1] : 100000;
  if (!existsSync(WORDS)) {
    console.log("Word list download ho rahi hai...");
    const r = await fetch("https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt");
    writeFileSync(WORDS, await r.text());
  }
  const list = generate(count);
  writeFileSync(CANDIDATES, list.map((x) => `${x.n},${x.score.toFixed(1)},${x.type}`).join("\n") + "\n");
  const byType = {}; for (const x of list) byType[x.type] = (byType[x.type] || 0) + 1;
  console.log(`Bane: ${list.length} naam -> ${CANDIDATES}`);
  console.log("Type-wise:", byType);
  console.log("Top 25:", list.slice(0, 25).map((x) => x.n).join(", "));
}
