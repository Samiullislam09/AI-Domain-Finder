// Saari data/found*.json + data/stats*.json ko ek compact index mein jodta hai, taaki website 46 files ki jagah 2 files padhe.
// Output: data/summary.json (chhota: stats + top picks + pehle naam) aur data/all.json (saare naam, compact).
// Run:  node build-index.mjs   (GitHub Actions mein "index" job yehi chalati hai)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { friendly } from "./shortname.mjs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "data");
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

// NOTE: TOPICS aur unka order docs/index.html ke TOPICS se same rakhna (bitmask isi order par based hai).
const TOPICS = [
  ["biz", "business startup team partner work company office boss manager desk hub studio factory agency venture founder enterprise"],
  ["sales", "sales lead market brand growth campaign outreach funnel pipeline deal traffic boost reach pitch promo advert"],
  ["ai", "auto smart bot pilot agent assist genie wizard machine engine robot brain mind logic neural cyber digit code data cloud"],
  ["social", "chat whatsapp social message mail inbox talk post follow friend buddy mate connect community voice"],
  ["content", "content blog video write story page book note scribe news media podcast canvas draft"],
  ["shop", "shop store order customer client review support price cart pay market trade invoice"],
  ["nature", "ocean forest sky mountain river leaf tree stone sun moon star rain wind field valley lake sea garden flower meadow grass"],
  ["power", "swift quick fast rapid bold strong sharp prime peak rocket flash bolt spark pulse forge storm fire thunder power turbo"],
];
const topicMask = (x) => {
  const s = (x.n + " " + (x.m || "")).toLowerCase(); let m = 0;
  TOPICS.forEach((t, i) => { if (t[1].split(" ").some((k) => s.includes(k))) m |= 1 << i; });
  return m || 1 << TOPICS.length; // "other"
};

// ---- ranking (docs/index.html ke rank/wordsOf/topPicks jaisa) ----
const wordsOf = (x) => { const m = (x.cat || "").match(/^(\d)-word/); if (m) return +m[1]; const pr = x.p || (x.m && x.m.includes("+") ? x.m : ""); if (pr) return pr.split(/\s*\+\s*/).length; return /dictionary/i.test(x.cat || "") ? 1 : 2; };
const base = (x) => (/^AI:/.test(x.cat || "") && !x.m ? 60 : x.s);
const rank = (x) => base(x) - (/ads|email/.test(x.n) ? 12 : 0) + (wordsOf(x) === 1 ? 8 : wordsOf(x) === 2 ? 4 : 0) - Math.max(0, x.n.length - 9) * 1.2;
const bucket = (n) => (n <= 5 ? 0 : n <= 7 ? 1 : n <= 10 ? 2 : 3);

// =====================  QUALITY ENGINE  =====================
// Ek naam "clean" tabhi hai jab wo poori tarah 1-3 asli, professional English words se bana ho.
// Words: (1) wordlist/brand-words.txt (curated, vetted)  (2) strict common-word fallback (top 4000, filtered).
// Score q = 0..100 (0 = clean nahi). Chhota naam, kam words, curated words, aur AI ka meaning = zyada score.
const CUR = new Set(readFileSync(path.join(here, "wordlist", "brand-words.txt"), "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).join(" ").split(/\s+/).filter((w) => /^[a-z]{3,8}$/.test(w)));
const sect = (hdr) => { const t = readFileSync(path.join(here, "wordlist", "brand-words.txt"), "utf8"); const i = t.indexOf("# --- " + hdr); if (i < 0) return []; const j = t.indexOf("# ---", i + 5); return t.slice(i, j < 0 ? undefined : j).split(/\r?\n/).filter((l) => !l.startsWith("#")).join(" ").split(/\s+/).filter((w) => /^[a-z]{3,8}$/.test(w)); };
const ADJ = new Set(sect("quality"));                                  // bold, swift, old, blue ...
const NATURE = new Set([...sect("nature"), ...sect("animals")]);       // oak, falcon, river ...
const PEOPLE = new Set(sect("business and people"));                  // pilot, coach, guru ...
const PLACES = new Set(sect("places and objects"));                   // harbor, garden, nest ...
const NOUN_OK = new Set([...NATURE, ...PEOPLE, ...PLACES]);           // nouns that read like a real brand ("Bold Falcon", "Smart Pilot")
const POS = new Set("bold brave bright brisk calm clear clean clever cool crisp eager epic fair fast fine firm fresh gentle glad grand great green happy honest ideal keen kind light lively lucky mighty noble open pure quick rapid ready rich royal safe sharp shiny simple sleek smart smooth solid steady strong sunny super sure sweet swift tidy true trusty vivid warm wise prime peak top best golden silver".split(" ")); // positive adjectives
const STOP = new Set("the and for that this with you not are from your all have but was will can has our one other they what when which where who why how out its were been being them their then than there these those into over under about after before again also any only just very much more most some such each both few many own same too her him his she let get got did does done off yet nor per via had say said say may might must shall should would could jan feb mar apr jun jul aug sep sept oct nov dec mon tue wed thu fri sat".split(" "));
const BAD = new Set((
  // sensitive / offensive / adult
  "sex sexy porn xxx fuck shit damn dick cock nude naked rape kill dead death drug drugs gun bomb hate slut bitch ass crap piss weed beer wine drunk gay lust nazi terror attack murder suicide abuse cancer virus toxic poison weapon blood" +
  // common person / place names that are not brand words
  " john james david michael robert william richard thomas mark paul steve peter chris jack tom sam ben dan joe kate mary anna lisa sara emma jane anne bill bob jim tim tony andy kevin brian jason jeff gary larry harry henry george edward frank fred ray roy lee jay ken ron don rick nick eric alan adam alex amy ann beth carol diane dawn? helen jenny julie karen laura linda maria nancy sandra susan tina india china japan korea texas london paris york california florida africa europe asia america canada mexico italy spain france german english british indian chinese american" +
  // web / UI junk
  " click login email www http html https com org net privacy terms policy cookie cookies shipping reviews contact search cart checkout subscribe unsubscribe download upload submit comment comments posted forum thread url link links home page pages site sites blog? mens womens kids"
).split(" ").filter((w) => w && !w.endsWith("?")));
const BAD_ANY = /(fuck|shit|porn|nazi|rape|slut|bitch|dick|cock|nude|naked|sexy|\bsex)/;
const FREQ = new Set(readFileSync(path.join(here, "wordlist", "words.txt"), "utf8").split(/\r?\n/).filter(Boolean).slice(0, 2500)
  .filter((w) => /^[a-z]{4,7}$/.test(w) && !BAD.has(w) && !STOP.has(w) && !/(ing|ed|ly|ness|tion|ment|ity|ers)$/.test(w) && !(w.endsWith("s") && !CUR.has(w))));
const isWord = (w) => CUR.has(w) || FREQ.has(w);
function segment(n) { // best split into <=3 words: fewer parts first, then more curated words
  const memo = new Map();
  const go = (i) => {
    if (i === n.length) return { parts: [], cur: 0 };
    if (memo.has(i)) return memo.get(i);
    let best = null;
    for (let j = i + 3; j <= Math.min(n.length, i + 8); j++) {
      const w = n.slice(i, j); if (!isWord(w)) continue;
      const rest = go(j); if (!rest) continue;
      const cand = { parts: [w, ...rest.parts], cur: rest.cur + (CUR.has(w) ? 1 : 0) };
      if (cand.parts.length > 3) continue;
      if (!best || cand.parts.length < best.parts.length || (cand.parts.length === best.parts.length && cand.cur > best.cur)) best = cand;
    }
    memo.set(i, best); return best;
  };
  return go(0);
}
function quality(x) {
  if (BAD_ANY.test(x.n)) return { q: 0, random: true };
  const seg = segment(x.n);
  if (!seg || !seg.parts.length) {
    // chhote invented naam (Coined / AI, <=6 letter) jo bolne mein English jaise hon: shortest-first mein sabse upar
    if (/^Coined/.test(x.cat || "") && x.n.length <= 6 && friendly(x.n)) return { q: 30 + (7 - x.n.length) * 2, parts: null, sense: false, coined: true, random: true }; // random: asli words ke neeche
    if (/^AI:/.test(x.cat || "") && x.n.length <= 6 && friendly(x.n)) return { q: 100 + (7 - x.n.length) * 10, parts: null, sense: true, coined: true, random: true }; // AI ne khud chuna: upar
    return { q: 0, random: true }; // asli words mein nahi tootta = random naam
  }
  const parts = seg.parts;
  if (parts.some((w) => STOP.has(w) || BAD.has(w)) || new Set(parts).size !== parts.length) return { q: 0 };
  // overlapping words like "leads"+"lead" look sloppy
  if (parts.some((a, i) => parts.some((b, k) => i !== k && (a.includes(b) || b.includes(a))))) return { q: 0 };
  let q = 40;
  q += seg.cur === parts.length ? 20 : seg.cur * 2 >= parts.length ? 6 : 0;
  const L = x.n.length; q += L <= 6 ? 40 : L === 7 ? 34 : L === 8 ? 28 : L === 9 ? 22 : L === 10 ? 16 : L === 11 ? 10 : L === 12 ? 6 : L === 13 ? 3 : 0;
  q += parts.length === 1 ? 10 : parts.length === 2 ? 4 : 0;
  const last = parts[parts.length - 1];
  // "sense": natural phrase  (adjective + real noun)  |  1 real word  |  2-3 nature/place words (oak + field)
  const midOk = parts.length < 3 || parts.slice(1, -1).every((w) => ADJ.has(w) || NOUN_OK.has(w));
  const adjLed = parts.length >= 2 && ADJ.has(parts[0]) && NOUN_OK.has(last) && !ADJ.has(last) && midOk;
  const natPair = !adjLed && parts.length >= 2 && parts.every((w) => NATURE.has(w) || PLACES.has(w));
  const sense = parts.length === 1 || adjLed || natPair;
  if (parts.length === 1 || adjLed) q += 25; else if (natPair) q += 12; // "bold falcon" (+25 +18) > "wet dove" (+25 +8) > "owl elk" (+12)
  if (adjLed) q += POS.has(parts[0]) ? 18 : 8;
  if (x.m && !x.m.includes("+")) q += 3;
  if (/ads|email/.test(x.n)) q -= 20;
  q = Math.max(0, q); // cap nahi: chhote + achhe naam ke beech farak dikhe
  if (!sense) q = Math.round(q * 0.4); // asli words par matlab-hin jod (jaise "botdune") score aadha: achhe naamon ke neeche
  return { q, parts, sense };
}

const partsOf = (x) => (x.p || (x.m && x.m.includes("+") ? x.m.replace(/\s/g, "") : "")).split("+");

// ---- read everything ----
const files = readdirSync(DATA);
const seen = new Map();
for (const f of files.filter((f) => /^found.*\.json$/.test(f)).sort()) for (const x of readJson(path.join(DATA, f), [])) if (x && x.n && (!seen.has(x.n) || (!seen.get(x.n).m && x.m))) seen.set(x.n, x); // meaning wali entry ko tarjeeh
// verify.mjs ne jo naam ab registered paaye (state/taken.json) unko available list se hata do
const takenMap = readJson(path.join(here, "state", "taken.json"), {});
for (const n of Object.keys(takenMap)) seen.delete(n);
for (const x of seen.values()) if (x.m === "coined") x.m = ""; // purana label meaning ki jagah dikh raha tha
const all = [...seen.values()].filter((x) => !/^Coined/.test(x.cat || "") || friendly(x.n)); // random naam jo bolne mein theek nahi lagte unhe site par mat dikhao

const types = {}, hist = {}; let scanned = 0, runs = 0, updated = "";
for (const f of files.filter((f) => /^stats.*\.json$/.test(f)).sort()) {
  const s = readJson(path.join(DATA, f), null); if (!s) continue;
  const tag = f.replace(/^stats/, "").replace(/\.json$/, "");
  const found = readJson(path.join(DATA, "found" + tag + ".json"), []).length;
  scanned += s.scanned || 0; runs += s.runs || 0; if ((s.updated || "") > updated) updated = s.updated;
  const cm = tag.match(/^-c-len(\d+)-(\d+)$/);
  const mm = tag.match(/^-([wv])(\d)-len(\d+)-(\d+)$/);
  const label = cm ? `Short random, ${cm[1]}-${cm[2]} letters` : mm ? `${mm[2]} word${mm[1] === "v" ? " (curated)" : ""}, ${mm[3]}-${mm[4]} letters` : tag ? `Earlier run, ${tag.slice(4)} letters` : "Earlier archive";
  types[label] = { s: s.scanned || 0, f: found };
  for (const [d, v] of Object.entries(s.history || {})) { (hist[d] ||= { s: 0, f: 0 }); hist[d].s += v.s; hist[d].f += v.f; }
}

// ---- compact tuples ----
const cats = [], catIdx = new Map();
const tuple = (x) => { let c = catIdx.get(x.cat || ""); if (c === undefined) { c = cats.length; cats.push(x.cat || ""); catIdx.set(x.cat || "", c); } return [x.n, c, x.s || 0, x.t || "", x.m || "", x.p || (x._parts && x._parts.length > 1 ? x._parts.join("+") : ""), topicMask(x), x.q || 0, x._rand ? 1 : 0]; };
for (const x of all) { const r = quality(x); x.q = r.q; x._parts = r.parts || null; x._sense = !!r.sense; x._rand = !!r.random; }
// clean (q>0) naam pehle: score, phir chhota naam; baaki purane rank se
// sense wale (q>=60) pehle, unmein sabse zyada score (chhota naam + achha pattern) pehle; phir baaki clean; phir baaki
all.sort((a, b) => (b.q >= 60) - (a.q >= 60) || (a.q >= 60 ? b.q - a.q || a.n.length - b.n.length : (b.q > 0) - (a.q > 0) || b.q - a.q || rank(b) - rank(a)) || a.n.localeCompare(b.n));

// top picks: sirf clean naam, sabse zyada score pehle; ek hi word 2 se zyada baar nahi
const top = [], used = {};
for (const x of all) {
  if (x.q < 60) break; // all sorted: clean naam score ke order mein
  if (!x._sense) continue; // matlab saaf nahi (jaise "botdune") to top picks mein nahi
  const ps = x._parts || [];
  if (ps.some((w) => (used[w] || 0) >= 2)) continue;
  ps.forEach((w) => { used[w] = (used[w] || 0) + 1; }); top.push(x); if (top.length >= 12) break;
}

// topPool: 120 achhe naam (q>=85, nahi to >=70); website har visit par inme se naye 12 chunti hai
const pool = [], usedPool = {};
for (const minQ of [60]) {
  for (const x of all) {
    if (pool.length >= 36 || x.q < minQ) continue;
    if (pool.includes(x)) continue;
    const ps = x._parts || [x.n.slice(0, 3)];
    if (ps.some((w) => (usedPool[w] || 0) >= 2)) continue;
    ps.forEach((w) => { usedPool[w] = (usedPool[w] || 0) + 1; }); pool.push(x);
  }
}
const items = all.map(tuple);
const raw = JSON.stringify({ cats, items }); let h = 2166136261;
for (let i = 0; i < raw.length; i += 5) h = Math.imul(h ^ raw.charCodeAt(i), 16777619) >>> 0;
const v = (updated || "0") + "-" + h.toString(36); // cache key: badlega jab bhi data ya ranking badle
const summary = { v, updated, scanned, runs, free: all.length, types, hist, cats, top: top.map(tuple), topPool: pool.map(tuple),
  taken: Object.values(takenMap).sort((a, b) => (b.bt || "").localeCompare(a.bt || "")).slice(0, 300), takenTotal: Object.keys(takenMap).length };
writeFileSync(path.join(DATA, "all.json"), JSON.stringify({ v, cats, items }));
writeFileSync(path.join(DATA, "summary.json"), JSON.stringify(summary));
console.log(`Clean naam (q>0): ${all.filter((x) => x.q > 0).length}, q>=60: ${all.filter((x) => x.q >= 60).length}`);
console.log("TOP:", top.map((x) => x.n + "(" + x.q + ")").join(" "));
console.log(`Taken (verify se hata): ${Object.keys(takenMap).length}`);
console.log(`Index: ${all.length} naam, scanned ${scanned}, summary ${(JSON.stringify(summary).length / 1024).toFixed(0)} KB, all ${(JSON.stringify({ v, cats, items }).length / 1048576).toFixed(2)} MB`);
