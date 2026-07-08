# DealFlow AI 🚀

An autonomous, serverless SaaS platform that hunts for high-discount affiliate deals across the internet and prepares them for 1-click distribution to your Telegram and WhatsApp communities.

## 🏗️ Architecture

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Lucide React
- **Backend:** Next.js Serverless API Routes
- **Database:** PostgreSQL (Hosted on Supabase) + Prisma ORM
- **Automation:** Vercel Cron Jobs (runs every hour)
- **Monetization:** Amazon Associates Program (Native link generation)

## 💸 Monetization Strategy (Zero-Cost Setup)

This system is designed to generate passive income with zero running costs.
1. **The Scraper:** The `src/app/api/cron/route.ts` file automatically pulls public RSS feeds (like Reddit Deal communities) every hour to find what humans are already identifying as hot deals.
2. **The Link Injector:** It instantly extracts the Amazon ASIN and automatically attaches your Amazon Affiliate Tag (`AMAZON_AFFILIATE_TAG`).
3. **Quality Control:** It saves the deal to your cloud database.
4. **1-Click Publishing:** You open your dashboard, click "Approve", and the engine instantly pushes a beautiful, conversion-optimized message with inline buttons to your Telegram channel.

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:[password]@db.your-supabase-url.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.your-supabase-url.supabase.co:5432/postgres"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
AMAZON_AFFILIATE_TAG="your_amazon_tag-21"
```

### 3. Sync Database
Push the Prisma schema to your Supabase project:
```bash
npx prisma db push
```

### 4. Run the Dashboard
```bash
npm run dev
```
Open `http://localhost:3000` to view the admin dashboard.

## ☁️ Vercel Deployment

1. Push this code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and import the repository.
3. In the Vercel deployment settings, paste all the variables from your `.env` file.
4. Deploy!

*Note: The `vercel.json` file is already configured. Vercel will automatically trigger your scraping engine every hour, 24/7, for free.*

## 📱 Supported Platforms
- [x] Telegram (Full Markdown + Inline Keyboard Buttons)
- [ ] WhatsApp (Integration code available in `src/lib/whatsapp.ts`, requires dedicated secondary SIM to prevent personal account bans).
