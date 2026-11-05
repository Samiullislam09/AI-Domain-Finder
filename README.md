# AI Domain Finder

Ek simple Node.js tool jo khaali (available) `.com` domains dhoondta hai.
Naam teen tareeqon se aate hain: AI se, random combinations se, ya aapki apni list se.

## Kaise kaam karta hai

1. Naam generate hota hai (AI / brute / list).
2. Har naam ka DNS check hota hai (1.1.1.1 aur 8.8.8.8 se). DNS mila to domain taken hai.
3. DNS nahi mila to Verisign RDAP (.com ka official registry) se confirm hota hai. Wahan bhi free nikla to **AVAILABLE**.

## Requirements

- [Node.js](https://nodejs.org) 18 ya usse naya (built-in `fetch` chahiye)
- Sirf `ai` mode ke liye: NVIDIA API key (https://build.nvidia.com se free milti hai)

Koi `npm install` nahi chahiye, yeh tool bina kisi package ke chalta hai.

## Setup

1. `_env.example` ko copy karke `.env` naam do.
2. `.env` mein apni key daalo:

```
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1
```

`NVIDIA_MODEL` optional hai. Na likho to default model use hoga.
`brute` aur `list` mode ko key ki zaroorat nahi.

## Run karna

Folder mein terminal kholo aur:

```
node "real domain name finder.mjs"
```

Default mein `ai` mode chalta hai. Rokne ke liye `Ctrl+C` dabao. Report phir bhi likhi jati hai.

## Modes

| Mode | Kya karta hai | Example |
|------|---------------|---------|
| `ai` | NVIDIA AI se brand-type naam mangwata hai | `node "real domain name finder.mjs" --mode ai` |
| `brute` | Random bolne layak letters banata hai | `node "real domain name finder.mjs" --mode brute --min 4 --max 4` |
| `list` | `my-list.txt` se naam leta hai (ek line = ek naam) | `node "real domain name finder.mjs" --mode list` |

## Options

Command line se, ya file ke upar `CONFIG` mein badlo:

| Flag | Matlab | Default |
|------|--------|---------|
| `--mode` | `ai`, `brute` ya `list` | `ai` |
| `--min` / `--max` | Naam mein kam se kam / zyada se zyada letters | `4` / `4` |
| `--want` | Itne available domains milte hi ruk jao | `20` |
| `--limit` | Maximum kitne naam check karne hain | `5000` |
| `--pattern` | brute mode: `pronounceable` ya `any` | `pronounceable` |
| `--style` | ai mode: kis type ke naam chahiye | `tech / AI / marketing brand` |
| `--listFile` | list mode: file ka naam | `my-list.txt` |

> Flags ke naam `minLen` / `maxLen` ke hisaab se `CONFIG` mein hain, isliye command line mein `--minLen 5 --maxLen 7` likho.

Example:

```
node "real domain name finder.mjs" --mode ai --minLen 5 --maxLen 7 --want 10 --style "travel startup"
```

## Output

Sab kuch `results/` folder mein banta hai:

- `available-domains.txt`: sirf free domains
- `report.txt`: poori summary (kitne check hue, kitne taken, AI ne kitne naam diye)
- `all-checked.csv`: har naam ka result

## Tips

- 3 se 5 letter ke famous-type naam lagbhag sab pehle se taken hote hain. Zyada hit chahiye to letters badhao (6 se 8) ya `--style` mein kuch alag likho.
- Agar `Galat flag` error aaye to flag ka naam upar wali table se check karo.
- Domain mil jaye to register karne se pehle kisi registrar (Namecheap, GoDaddy, etc.) par ek baar dobara confirm kar lo.

## Push karne se pehle

- `.env` ko kabhi push mat karo. `.gitignore` mein `.env` aur `results/` daal do.
- `_env.example` mein sirf placeholder rakho, asli key nahi.
