# 🏗️ DealFlow AI — Architecture Guide

> **⚠️ READ THIS BEFORE MAKING ANY CODE CHANGES ⚠️**
>
> This document explains how the bot works. If you are an AI assistant
> helping Gabbar with this project, READ THIS FIRST so you don't break
> the automation system.

---

## 🔒 PROTECTED FILES — DO NOT MODIFY

These files contain the core bot algorithm. **NEVER modify them**, even
for "small fixes" or "improvements". If you change them, the entire
automation pipeline will break.

### `src/lib/stealth-scraper.ts`
**What it does:** Fetches Amazon product prices using a multi-identity
crawler camouflage system that races 5 trusted bot identities in parallel.

**Why it must not be changed:**
- The User-Agent strings are specifically chosen because Amazon whitelists
  them (Googlebot, Facebookbot, TelegramBot, Discordbot, Twitterbot).
- The 4-second timeout is tuned for Vercel's 10-second function limit.
- The `Promise.any()` racing pattern ensures the fastest identity wins.
- Changing ANY of these values will cause Amazon to block the bot.
- **DO NOT** suggest PA-API or paid scrapers as alternatives. This free
  stealth system is the intended and working solution.

### `src/lib/hostel-filter.ts`
**What it does:** Smart Student Filter that scores deals 0-100 based on
product category, price affordability, and discount level.

**SAFE changes in this file:**
- Adding new keywords to existing category arrays
- Adjusting STUDENT_SCORE_THRESHOLD (default: 40)

**UNSAFE changes:**
- Removing categories or penalty groups
- Changing the scoring formula structure
- Removing the flash deal override logic

### `src/lib/telegram.ts`
**What it does:** Formats and sends deal messages to Telegram channels.

**Why it must not be changed:**
- The message formatting, image handling, and affiliate link placement
  are carefully tested to work with Telegram's API.

---

## 📁 FILE STRUCTURE

```
src/
├── lib/
│   ├── stealth-scraper.ts    🔒 PROTECTED — Amazon price fetcher
│   ├── hostel-filter.ts      🔒 PROTECTED — Student deal scoring
│   ├── telegram.ts           🔒 PROTECTED — Telegram message sender
│   ├── affiliate.ts          ✅ SAFE — Affiliate link generator
│   ├── prisma.ts             ✅ SAFE — Database client
│   └── scrapers/
│       └── rss.ts            ⚠️ CAREFUL — Telegram channel scraper
│                              (imports from stealth-scraper.ts)
├── app/
│   └── api/
│       ├── cron/
│       │   └── route.ts      ⚠️ CAREFUL — Main deal scraper cron
│       │                      Posts ONLY to @fantasticofffer
│       ├── cron-hostel/
│       │   └── route.ts      ⚠️ CAREFUL — Hostel channel filter cron
│       │                      Posts ONLY to @hosteldeals
│       ├── cron-wishlist/
│       │   └── route.ts      ⚠️ CAREFUL — Wishlist price tracker cron
│       │                      Posts ONLY to @hosteldeals
│       ├── deals/             ✅ SAFE — Dashboard API endpoints
│       ├── watchlist/         ✅ SAFE — Watchlist API endpoints
│       └── wishlist/          ✅ SAFE — Wishlist API endpoints
├── components/
│   └── views/                 ✅ SAFE — UI components
└── types/
    └── index.ts               ✅ SAFE — TypeScript types
```

---

## 🔄 HOW THE 3-BOT SYSTEM WORKS

### Bot 1: Main Channel (`/api/cron` → `@fantasticofffer`)
- Runs every **5 minutes**
- Scrapes competitor Telegram channels for new deals
- Resolves shortlinks to find Amazon/Flipkart product IDs
- Creates affiliate links and saves deals to database
- Publishes to `@fantasticofffer` ONLY
- Does NOT touch `@hosteldeals`

### Bot 2: Hostel Filter (`/api/cron-hostel` → `@hosteldeals`)
- Runs every **8 minutes**
- Reads deals ALREADY saved to database by Bot 1
- Runs each deal through the Smart Student Filter (hostel-filter.ts)
- Only posts deals scoring 40+ to `@hosteldeals`
- Flash deals (70%+ off under ₹999) are ALWAYS posted
- Irrelevant items (AC, baby, furniture) are auto-rejected

### Bot 3: Wishlist Tracker (`/api/cron-wishlist` → `@hosteldeals`)
- Runs every **10 minutes**
- Checks Amazon prices for wishlist products using stealth-scraper.ts
- Posts price drops to `@hosteldeals` ONLY
- Processes 3 items in parallel for speed

### Why they are SEPARATE:
- Changes to Bot 1 CANNOT break Bot 2 or Bot 3
- Changes to Bot 2 CANNOT break Bot 1 or Bot 3
- Each bot can be tested independently by visiting its URL
- If one bot fails, the others keep running

---

## 🛡️ CHANNEL CONFIGURATION

| Channel | Handle | Fed by |
|---------|--------|--------|
| Main | `@fantasticofffer` | Bot 1 (main cron) |
| Hostel | `@hosteldeals` | Bot 2 (hostel filter) + Bot 3 (wishlist) |

---

## ✅ SAFE CHANGES

1. **UI/Dashboard** — Any file in `src/components/`
2. **Keyword lists** — Add keywords in hostel-filter.ts categories
3. **Discount thresholds** — Change STUDENT_SCORE_THRESHOLD in hostel-filter.ts
4. **Channel names** — Update handle strings in cron files
5. **API endpoints** — Add new dashboard routes freely
6. **Database schema** — Add new Prisma models as needed
7. **Affiliate links** — Edit src/lib/affiliate.ts

## ❌ DANGEROUS CHANGES

1. ❌ Modifying `stealth-scraper.ts` in ANY way
2. ❌ Changing axios timeout values in scraping code
3. ❌ Removing the `Promise.any()` parallel race
4. ❌ Adding `randomDelay()` inside the fetch pipeline
5. ❌ Replacing the stealth system with PA-API or paid scrapers
6. ❌ Making any cron post to BOTH channels (they are separated!)
7. ❌ Adding hostel posting logic back into `/api/cron/route.ts`
