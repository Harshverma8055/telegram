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

### `src/lib/telegram.ts`
**What it does:** Formats and sends deal messages to Telegram channels.

**Why it must not be changed:**
- The message formatting, image handling, and affiliate link placement
  are carefully tested to work with Telegram's API.
- Changing the bot initialization can break ALL channel posting.

---

## 📁 FILE STRUCTURE

```
src/
├── lib/
│   ├── stealth-scraper.ts    🔒 PROTECTED — Amazon price fetcher
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
│       ├── cron-wishlist/
│       │   └── route.ts      ⚠️ CAREFUL — Wishlist price tracker cron
│       ├── deals/             ✅ SAFE — Dashboard API endpoints
│       ├── watchlist/         ✅ SAFE — Watchlist API endpoints
│       └── wishlist/          ✅ SAFE — Wishlist API endpoints
├── components/
│   └── views/                 ✅ SAFE — UI components (can modify freely)
└── types/
    └── index.ts               ✅ SAFE — TypeScript type definitions
```

### Legend:
- 🔒 **PROTECTED** = Do NOT touch these files under any circumstances
- ⚠️ **CAREFUL** = You can modify, but be very careful with the scraping
  logic. Only change business logic (like discount thresholds, channel
  names, message text), NOT the scraping/fetching mechanism.
- ✅ **SAFE** = You can modify these freely for features, UI changes, etc.

---

## 🔄 HOW THE AUTOMATION WORKS

### 1. Main Cron (`/api/cron`) — Runs every 5 minutes
- Scrapes competitor Telegram channels for new deals
- Resolves shortlinks to find Amazon/Flipkart product IDs
- Creates affiliate links and saves deals to database
- Auto-publishes good deals to `@fantasticofffer` (main channel)
- Auto-publishes college/hostel deals to `@hosteldeals` (hostel channel)

### 2. Wishlist Cron (`/api/cron-wishlist`) — Runs every 10 minutes
- Picks the 15 oldest-checked wishlist products from the database
- Fetches live Amazon prices using `stealth-scraper.ts`
- Checks if price dropped below target (or discount >= 50%)
- If target met → publishes deal to BOTH Telegram channels
- Marks the product as triggered so it's not re-posted
- Processes 3 items in parallel for speed

### 3. Stealth Scraper (`stealth-scraper.ts`) — The Core Engine
- Fires 5 crawler identities simultaneously (Googlebot, Facebook, etc.)
- Uses `Promise.any()` — first successful response wins
- 4-second timeout per identity to stay within Vercel limits
- Falls back to mobile UA if all 5 identities fail

---

## 🛡️ CHANNEL CONFIGURATION

| Channel | Handle | Purpose |
|---------|--------|---------|
| Main | `@fantasticofffer` | All deals (main audience) |
| Hostel | `@hosteldeals` | College/hostel targeted deals |

Both channels use the **same Telegram bot token**. The bot must be added
as an **admin** in both channels.

Channel handles are configured in:
- `src/app/api/cron/route.ts` (lines 14-15)
- `src/app/api/cron-wishlist/route.ts` (lines 8-9)

---

## ✅ SAFE CHANGES (Things you CAN modify)

1. **UI/Dashboard** — Any file in `src/components/` is safe to change
2. **Discount thresholds** — Change the `50` in cron-wishlist for min discount
3. **Channel names** — Update `@fantasticofffer` or `@hosteldeals` strings
4. **Keyword lists** — SUPER_PRIORITY_KEYWORDS, COLLEGE_ESSENTIALS in cron
5. **Silent hours** — Change the 11:30 PM to 7:00 AM quiet period
6. **API endpoints** — Add new dashboard/API routes freely
7. **Database schema** — Add new Prisma models as needed

## ❌ DANGEROUS CHANGES (Things that WILL break the bot)

1. ❌ Modifying `stealth-scraper.ts` in ANY way
2. ❌ Changing axios timeout values in scraping code
3. ❌ Removing or modifying the `Promise.any()` parallel race
4. ❌ Adding `randomDelay()` calls inside the fetch pipeline
5. ❌ Replacing the stealth system with PA-API or paid scrapers
6. ❌ Changing User-Agent strings in crawler identities
7. ❌ Making the cron process items one-at-a-time instead of in parallel
