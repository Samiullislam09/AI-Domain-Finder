// Startup-brand names, product ke hisaab se (AI automation: marketing + sales + content on autopilot).
// Run:  node startup-names.mjs   ->  results/candidates-startup.txt  (best naam pehle)
// Phir:  node scan-all.mjs --mode file --file results/candidates-startup.txt --want 500 --conc 30
// Roots ko apne product ke hisaab se badal sakte ho (THEMES).

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(here, "results"), { recursive: true });
const OUT = path.join(here, "results", "candidates-startup.txt");

// 1) Haath se chune hue standalone naam (sabse zyada score)
const HAND = `
sprout growly bloomi thrivo thrivly risely ascend ascenta upwell liftly liftoff boostly surgely leapfy soarly climbo
autopilot autopilo pilotly pilotra autoly autify autova automa autora autonix autoro autovia autolo
crewly crewai crewo crewify squadly teamly teamo hivera hivemind hively hiveo hivify allyo allyra allyly matey
mindly mindora mindify mindova thinkly thinko thinkra sagely sageo savvy savvyo savvly cleverly geniusly musely musea muso
neuro cognia cognito cogly cogify synapse synapto synaply logica logiq logix logico logora
leadly leadify leadora leado reachly reacho reachify pitchly pitcho closely closo dealio dealify winly winna winova huntly hunto scoutly scouto
pingly pingo pingify hello helio helloa heyly heyo ringly
quilly quillo inkly inkora storyo storify storyly pagely pageo scribly scribo scribe prosely proso draftly drafto
launchly launchi orbitly orbito orbita novaly novao novara cometly cometo rocketly lunaro astrio apexly apexo
roboly robify robota gearly gearo cogsy boltly bolto motorly engino enginy
growthly growio growora growify growva scaleo scalify scalora scalex scaler
zaply zapo zipli zipo zipify dashly dasho swiftly swifto rapido rapidly quickly jetly jeto rushly gliding glideo sprinto
workly worko workify workora workaly deskly desko deskify
marketo marketly markify marketa reachar traffo trafly trafio
ranko rankly rankify rankora seoly seoro seoify
sendly sendo sendify mailo mailly mailify chatly chatio chatify chatora talkly talko talkify
bookly booko bookify meetly meeto meetify
audity auditly audito checkly checko checkify
publy publio publify postly posto postify
flowly floworx flowio flowify flowra flowva
brainly brainio brainova brainera
wisely wiseo wiseora wisify
lumo lumio lumina lumora lumify
vivid vividly vivio vivora vivify
kinetic kinetix kinexa
nexa nexly nexio nexora nexify
vero verio verly verova verify
zenly zenio zenora zenify
alto altio altora altify
primo primly primora primify
novo novly novio novify
omnio omnira omnify
ultra ultro ultrio
helm helmly helmo helmify
steer steerly steero
captain captly capto
conduct conducto
maestro maestra
orchestro orchestra
`.split(/\s+/).filter(Boolean);

// 2) Roots (product se jude) x brand endings (Spotify, Zapier, Jasper style)
const THEMES = {
  growth: "grow sprout seed bloom rise lift peak summit thrive scale boost surge climb leap soar ascend uplift elev bright shine",
  auto: "auto pilot flow zip zap swift dash rapid quick jet rush glide sprint turbo hyper",
  team: "crew squad team hive guild band ally mate buddy pal",
  mind: "mind brain think sage wise smart savvy clever muse cogni neuro synap logic insight lumen",
  sales: "lead reach pitch close deal win hunt scout spark ping hello ring magnet",
  content: "write quill ink story tale page scribe draft prose word",
  launch: "launch orbit nova comet rocket lunar astro apex vector atlas",
  work: "work task desk ops job shift gear bolt engine motor",
};
const ENDINGS = ["ly", "ify", "io", "ora", "ia", "o", "a", "ix", "ex", "ova", "ara", "ino", "ee", "er", "ful", "wise", "ium", "ora", "eo"];
const isV = (c) => "aeiou".includes(c);

function pron(n) {
  if (n.length < 4 || n.length > 9) return false;
  if (/(.)\1\1/.test(n) || /[^aeiouy]{4}/.test(n) || /[aeiou]{3}/.test(n)) return false;
  if (/(.{2,3})\1/.test(n)) return false; // repeat pattern
  return /[aeiouy]/.test(n);
}

const map = new Map();
const put = (n, s, t) => { if (pron(n) && (!map.has(n) || map.get(n).s < s)) map.set(n, { s, t }); };

for (const w of HAND) put(w, 100 - Math.abs(w.length - 6) * 3, "hand");

for (const [theme, roots] of Object.entries(THEMES)) {
  for (const r of roots.split(" ")) {
    put(r, 55 - Math.abs(r.length - 6) * 3, "root");
    for (const e of ENDINGS) {
      let n = r.endsWith("e") && isV(e[0]) ? r.slice(0, -1) + e : r + e;
      if (r.endsWith(e[0]) && e.length === 1) continue;
      if (n.endsWith("yly") || n.endsWith("lly")) continue;
      const strong = ["ly", "ify", "io", "ora", "ia", "ix", "ova", "ara", "ino", "er"].includes(e) ? 12 : 4;
      put(n, 60 + strong - Math.abs(n.length - 6.5) * 4, "root+end");
    }
  }
}
// 3) cross-theme: do roots ka pehla hissa + ending (Pinterest-style blends), sirf achhe bolne wale
const all = Object.values(THEMES).flatMap((x) => x.split(" ")).filter((w) => w.length >= 3 && w.length <= 6);
for (const a of all) for (const b of all) {
  if (a === b) continue;
  const n = a + b;
  if (n.length >= 6 && n.length <= 8) put(n, 40 - Math.abs(n.length - 6.5) * 3, "compound");
}

const list = [...map.entries()].sort((x, y) => y[1].s - x[1].s);
writeFileSync(OUT, list.map(([n, v]) => `${n},${v.s.toFixed(1)},${v.t}`).join("\n") + "\n");
console.log(`Bane: ${list.length} naam -> ${OUT}`);
console.log("Top 40:", list.slice(0, 40).map(([n]) => n).join(", "));
