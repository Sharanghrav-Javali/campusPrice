# CampusPrice

An AI shopping assistant for college students. Type any product, get a live
price comparison and an honest buy/wait verdict — powered by real web search
+ an LLM, both on free tiers. Total cost to run: ₹0.

---

## How it works

1. You type a product name (and optional budget).
2. The server searches the live web for that product (via Serper.dev).
3. The search results are handed to a free LLM (Groq, running Llama 3.3),
   which reads them and returns a structured verdict: best price, a
   comparison table, pros/cons, and a buying tip.
4. Nothing is scraped or stored on a server database — your recent searches
   are saved only in your own browser (localStorage).

---

## 1. Get your two free API keys (no credit card needed)

**Groq (the AI model)**
1. Go to https://console.groq.com
2. Sign up (free)
3. Go to "API Keys" → Create API Key → copy it

**Serper (the web search)**
1. Go to https://serper.dev
2. Sign up (free) — you get free search credits on signup
3. Copy your API key from the dashboard

---

## 2. Run it on your own laptop first

```bash
# 1. Install Node.js 18+ if you don't have it: https://nodejs.org

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.example .env.local

# 4. Open .env.local and paste in your two keys:
#    GROQ_API_KEY=...
#    SERPER_API_KEY=...

# 5. Run it
npm run dev
```

Open http://localhost:3000 — try searching a product.

---

## 3. Put it online for free (so real people can use it)

1. Create a free GitHub account if you don't have one, and push this folder
   as a new repository.
2. Go to https://vercel.com → sign up free with your GitHub account.
3. Click "Add New Project" → import your CampusPrice repo.
4. Before deploying, open "Environment Variables" and add:
   - `GROQ_API_KEY` = your key
   - `SERPER_API_KEY` = your key
5. Click Deploy. In about a minute you'll get a live link like:
   `https://campusprice-yourname.vercel.app`

That link is your real, working website. Share it in your college WhatsApp
or Telegram groups and start collecting feedback.

---

## Free tier limits to know

- **Groq**: generous free daily request limits, no card required. Fine for
  a college-scale project.
- **Serper**: free signup credits, then paid after you exhaust them. For a
  resume project with a few hundred searches, the free credits are enough —
  just keep an eye on usage in your Serper dashboard.
- **Vercel**: free hosting tier is enough for this project's traffic.

If you ever hit a free-tier limit, the fix is either to wait for it to
reset, request more free credits as a student (Serper and others sometimes
offer this), or swap in another free search API — the code only touches
Serper in one function (`searchWeb` in `app/api/analyze/route.js`), so it's
easy to swap.

---

## Ideas to extend it (good for a "v2" resume bullet)

- Add a Telegram bot front-end using the same `/api/analyze` endpoint.
- Add price-drop alerts (needs a small database + a scheduled job — Supabase
  free tier + Vercel Cron both have free tiers).
- Narrow it to one category (e.g. "laptops for engineering students") and
  bake in category-specific buying advice.
- Add real usage numbers once your college starts using it — that's the
  single best line to add to your resume.

---

## Tech stack

- Next.js 14 (App Router) — frontend + backend API route in one project
- Groq API (Llama 3.3 70B) — free LLM inference
- Serper.dev — free-tier Google search API
- Vercel — free hosting
- No database required for v1 (history is stored in the browser)
