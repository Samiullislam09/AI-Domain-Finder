# AI Domain Finder

Ek simple Node.js tool jo khaali (available) `.com` domains dhoondta hai.
Do script hain:

| Script | Kaam |
|--------|------|
| `real domain name finder.mjs` | AI / brute / list se naam bana kar check karta hai |
| `scan-all.mjs` | Bina AI ke, bade scan: saare 3-letter, 4-letter, ya 5-6 letter coined naam. Resume hota hai |

## Kaise kaam karta hai

1. Naam generate hota hai (AI / brute / list / coined).
2. Har naam ka DNS check hota hai (1.1.1.1 aur 8.8.8.8 se). DNS mila to domain taken hai.
3. DNS nahi mila to Verisign RDAP (`.com` ka official registry) se confirm hota hai. Wahan bhi free nikla to **AVAILABLE**.

## Requirements

- [Node.js](https://nodejs.org) 18 ya usse naya (built-in `fetch` chahiye)
- Sirf `ai` mode ke liye: NVIDIA API key (https://build.nvidia.com)

Koi `npm install` nahi chahiye.

## Setup (sirf ai mode ke liye)

1. `_env.example` ko copy karke `.env` naam do.
2. `.env` mein apni key aur model daalo:

```
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
```

NVIDIA ke models badalte rehte hain. Agar `404` ya "model not found" aaye to build.nvidia.com par chalta hua model dekh kar `NVIDIA_MODEL` badlo. Bade reasoning models slow hote hain, chhota model tez rehta hai.

`.env` kabhi GitHub par push mat karo (`.gitignore` mein pehle se hai).

## 1) real domain name finder.mjs

```
node "real domain name finder.mjs"
```

Default: `ai` mode, 4 se 8 letter, 20 domain milne tak chalta hai. `Ctrl+C` se roko, report phir bhi likhi jati hai.

| Mode | Kya karta hai | Example |
|------|---------------|---------|
| `ai` | NVIDIA AI se brand-type naam mangwata hai | `node "real domain name finder.mjs" --mode ai` |
| `brute` | Random bolne layak letters banata hai | `node "real domain name finder.mjs" --mode brute --minLen 4 --maxLen 4` |
| `list` | `my-list.txt` se naam leta hai (ek line = ek naam) | `node "real domain name finder.mjs" --mode list` |

| Flag | Matlab | Default |
|------|--------|---------|
| `--mode` | `ai`, `brute` ya `list` | `ai` |
| `--minLen` / `--maxLen` | Naam mein kam se kam / zyada se zyada letters | `4` / `8` |
| `--want` | Itne available domains milte hi ruk jao | `20` |
| `--limit` | Maximum kitne naam check karne hain | `50000` |
| `--batchSize` | ai mode: ek round mein AI se kitne naam maangne hain | `100` |
| `--style` | ai mode: kis type ke naam chahiye | `tech / AI / marketing brand` |
| `--pattern` | brute mode: `pronounceable` ya `any` | `pronounceable` |
| `--listFile` | list mode: file ka naam | `my-list.txt` |

Example:

```
node "real domain name finder.mjs" --minLen 5 --maxLen 7 --want 10 --style "travel startup"
```

AI ka round khali ya repeat aaye to script dobara try karti hai (lagataar 25 baar khali aaye tabhi rukti hai). Network fail ya timeout par bhi retry hota hai.

Output `results/` mein: `available-domains.txt`, `report.txt`, `all-checked.csv`.

## 2) scan-all.mjs (bina AI ke)

```
# 3-letter, phir 4-letter (bahut kam free milte hain)
node scan-all.mjs --want 5

# 5-6 letter brand jaise naam (sabse zyada free milte hain)
node scan-all.mjs --mode coined --want 20 --min 5 --max 6
```

| Flag | Matlab | Default |
|------|--------|---------|
| `--want` | Itne free domains milte hi ruk jao | `5` |
| `--conc` | Ek saath kitne check (memory kam ho to 20-30 karo) | `50` |
| `--mode coined` | 5-6 letter bolne layak random naam | (band) |
| `--min` / `--max` | coined mode: letters | `5` / `6` |
| `--limit` | coined mode: max kitne naam check karne hain | `200000` |

Resume: dekhe hue har naam `results/scan-checked.txt` mein save hote hain. Rok kar dobara chalao to wahin se aage chalega, dobara check nahi karega.

Output `results/` mein:

- `scan-FOUND.txt`: free domains
- `scan-checked.txt`: har dekha hua naam (`naam,taken` ya `naam,free`)
- `scan-status.txt`: live progress

## Pata hona chahiye

- Saare 3-letter `.com` aur lagbhag saare 4-letter bolne layak `.com` pehle se registered hain. Free domain 5-6 letter ke coined naam mein milta hai.
- "Free" ka matlab hai abhi registry mein registered nahi dikha. Khareedne se pehle registrar (Namecheap, GoDaddy) par confirm karo aur trademark check karo.
- Bahut zyada parallel checks (`--conc`) se memory ya timeouts badh sakte hain.

## 3) Website + 24/7 mining (bilkul free)

- **Mining (backend) = GitHub Actions.** `.github/workflows/mine.yml` har 30 min `miner.mjs` chalata hai. NVIDIA AI yahin connect hota hai (GitHub Secret `NVIDIA_API_KEY`). Free domains `data/found.json` mein commit ho jate hain.
- **Website = Vercel.** `docs/index.html` static page hai. Yeh data seedha GitHub se (`raw.githubusercontent.com/.../data/found.json`) padhta hai, isliye miner ke har push par Vercel ko redeploy nahi karna padta.

Setup (ek baar):
1. GitHub repo: Settings -> Secrets and variables -> Actions -> secret `NVIDIA_API_KEY` (aapki key). Optional variable `NVIDIA_MODEL`.
2. Actions tab -> "Mine domains" -> Run workflow (pehli baar haath se).
3. Vercel: Add New Project -> repo import -> Framework `Other`, Root Directory `docs`, Build Command khali. Settings -> Git -> **Ignored Build Step** mein: `git diff --quiet HEAD^ HEAD -- .` (sirf docs/ badle tab deploy).

Local: `node miner.mjs` (mining), `npx serve docs` (website).

Dhyan: repo public rakho (private mein Actions ke sirf 2000 min/mahina). Public mein free domains sabko dikhte hain.

## GitHub par push karne se pehle

- `.env` push mat karo, `_env.example` mein sirf placeholder rakho.
- `results/` bhi `.gitignore` mein hai.
