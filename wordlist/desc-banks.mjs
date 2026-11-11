// 15 categories ke liye "matlab wale" lambe naam (12-20 letter, 2-4 asli English words), jaise weeklyshiftplanner, familybudgetbook.
// Har naam: [modifier] + [object] + [tool]. Modifier sirf aise rakhe hain jo us category ki har cheez ke saath sahi baithte hain
// (daily, weekly, family, team ...), taaki naam ka matlab bana rahe. Miner.mjs (DESC=1) aur review script isi file se naam banate hain.
export const DESC_CATS = [
  { id: "business", name: "Business",
    mod: "daily weekly monthly team office client shop local",
    obj: "meeting invoice client order shift payroll expense inventory project task contract quote supplier sales booking staff deadline report lead stock delivery appointment",
    tool: "planner tracker log book notes board list checklist organizer calendar reminder manager ledger helper desk" },
  { id: "startup", name: "Startup",
    mod: "founder seed weekly team product launch beta solo daily",
    obj: "idea pitch launch roadmap feedback customer investor milestone waitlist prototype metric hiring growth experiment feature demo interview budget",
    tool: "planner tracker journal board log checklist notes list playbook guide room lab book" },
  { id: "ai", name: "AI & Automation",
    mod: "daily team workflow personal office",
    obj: "prompt chatbot agent automation workflow task script assistant model data report email reply template recipe idea",
    tool: "library planner board builder notes book tracker checklist helper maker desk studio" },
  { id: "marketing", name: "Marketing",
    mod: "weekly monthly campaign brand social content email local launch client daily",
    obj: "post caption hashtag campaign audience lead newsletter content offer poster reel blog review follower coupon idea",
    tool: "planner calendar tracker ideabook log board notes checklist scheduler manager helper maker builder" },
  { id: "finance", name: "Finance",
    mod: "monthly weekly family student personal household yearly daily",
    obj: "budget expense bill savings rent loan tax receipt allowance income debt spending salary subscription goal",
    tool: "tracker planner book log calculator reminder checklist ledger tally diary notes jar" },
  { id: "health", name: "Health",
    mod: "daily weekly family personal morning evening",
    obj: "habit sleep mood water symptom medicine checkup wellness stress diet energy pain doctor appointment vitamin",
    tool: "log tracker diary journal planner notes reminder checklist chart calendar" },
  { id: "fitness", name: "Fitness",
    mod: "daily weekly home morning beginner running gym personal",
    obj: "workout exercise step run lift stretch yoga cardio muscle protein calorie goal routine swim",
    tool: "planner tracker log diary journal calendar schedule chart notes builder timer" },
  { id: "food", name: "Food",
    mod: "weekly family home daily healthy seasonal",
    obj: "meal recipe grocery pantry menu kitchen snack lunch dinner spice breakfast leftover dessert cooking",
    tool: "planner book list tracker diary maker organizer calendar notes log box" },
  { id: "travel", name: "Travel",
    mod: "weekend family road solo budget summer winter group city beach",
    obj: "trip packing route hotel flight visa itinerary journey passport luggage stay tour booking expense map",
    tool: "planner list log journal diary book tracker checklist folder notes organizer" },
  { id: "education", name: "Education",
    mod: "student weekly daily school college exam class home language study",
    obj: "homework lesson exam quiz flashcard grade reading revision assignment notes timetable project vocabulary practice course",
    tool: "planner tracker log book journal notes calendar organizer checklist maker helper" },
  { id: "pets", name: "Pets",
    mod: "daily weekly family home",
    obj: "dog cat pet vet vaccine feeding walk grooming training puppy kitten fish bird litter treat",
    tool: "diary log tracker planner schedule journal notes book calendar reminder checklist" },
  { id: "home", name: "Home",
    mod: "weekly family household monthly seasonal spring",
    obj: "chore repair cleaning garden plant laundry lease moving decor warranty furniture utility maintenance grocery storage",
    tool: "planner list log book schedule tracker checklist organizer calendar board notes folder" },
  { id: "music", name: "Music",
    mod: "daily weekly band guitar piano practice live studio",
    obj: "setlist chord song lyric rehearsal gig melody rhythm scale lesson playlist concert recording tune riff",
    tool: "planner log book notes journal pad tracker diary schedule sheet builder maker" },
  { id: "realestate", name: "Real estate",
    mod: "local family weekend city student budget",
    obj: "home house rental lease mortgage listing tenant landlord property apartment viewing deposit renovation neighborhood inspection",
    tool: "finder tracker planner checklist log book organizer calculator guide folder notes" },
  { id: "freelance", name: "Freelance",
    mod: "weekly solo client creative remote monthly",
    obj: "invoice project proposal deadline portfolio contract client rate gig timesheet brief payment pitch task hours",
    tool: "tracker planner log book notes board checklist organizer calendar reminder manager helper maker" },
];

const words = (s) => s.split(/\s+/).filter(Boolean);
const MIN = 12, MAX = 20;

// Saare candidates: { n, cat, p }  (p = "weekly+shift+planner")
export function descCandidates() {
  const out = new Map();
  for (const c of DESC_CATS) {
    const M = words(c.mod), O = words(c.obj), T = words(c.tool);
    for (const o of O) for (const t of T) {
      if (o === t) continue;
      const two = o + t; if (two.length >= MIN && two.length <= MAX && !out.has(two)) out.set(two, { n: two, cat: "Curated: " + c.id, p: o + "+" + t });
      for (const m of M) {
        if (m === o || m === t) continue;
        const n = m + o + t; if (n.length < MIN || n.length > MAX || out.has(n)) continue;
        out.set(n, { n, cat: "Curated: " + c.id, p: m + "+" + o + "+" + t });
      }
    }
  }
  return [...out.values()];
}
