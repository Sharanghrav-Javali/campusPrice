# CampusPrice

> **AI-Powered Shopping Research & Recommendation Workstation for Indian College Students**

CampusPrice turns natural-language requirements into deep market research. Instead of forcing users to guess exact model names or sift through dozens of sponsored retailer ads, users simply describe what they need in plain English. CampusPrice extracts the underlying constraints, queries live market listings across major Indian retailers, filters noise, normalizes configurations, evaluates requirement fit, and presents honest, source-attributed recommendations.

---

## The Problem
E-commerce search engines in India are built around exact product keywords and sponsored ads:
- **Keyword Traps**: If you don't know the difference between an *i5-1334U* and an *i5-12450H*, search bars won't help you.
- **Spec Overload**: Retailers bury critical student constraints (RAM expandability, battery life, weight) under marketing jargon.
- **Sponsored Bias**: The top 5 search results on traditional marketplaces are frequently paid promotions rather than the best fit for your budget and coursework.

## The Solution
CampusPrice reimagines shopping research as a structured workflow:
1. **Natural-Language Requirement Input**: You explain your situation (e.g. *"I am a CSE student looking for a laptop under ₹70,000 for Docker, Python, VS Code with 16GB RAM and good battery"*).
2. **Transparent Understanding**: The platform extracts your constraints into an editable *"What We Understood"* panel (Category, Budget, Must-Haves, Preferences, Use Cases).
3. **Multi-Query Web Search**: Queries live Indian market data across Amazon, Flipkart, Croma, Reliance Digital, and official merchant stores.
4. **Configuration Normalization**: Filters out listicle articles, blog reviews, and duplicate listings while preserving distinct hardware variants (e.g. 8GB vs 16GB RAM models).
5. **Requirement-to-Product Matching**: Ranks candidates based on actual requirement fit (*"Excellent match"*, *"Strong match"*, *"Partial match"*, *"Above-budget alternative"*), with transparent explanations of strengths, drawbacks, and price deltas.
6. **Side-by-Side Category Comparison**: Dynamic, category-aware comparison table highlighting only attributes relevant to the chosen category.

---

## Architecture

```text
User Natural-Language Description (Paragraph + Optional Overrides)
                          │
                          ▼
            [ Requirement Extraction Layer ]
          (Groq Llama / GPT OSS 120B / Qwen)
                          │
                          ▼
             [ "What We Understood" Panel ] ──(User can edit criteria)
                          │
                          ▼
           [ Multi-Query Search Engine ]
            (Serper API - Google India)
                          │
                          ▼
       [ Product Normalizer & Deduplicator ]
  (Strips noise, parses specs, consolidates sellers)
                          │
                          ▼
         [ Requirement Matching Engine ]
    (Classifies fit, flags tradeoffs, anti-hallucination)
                          │
                          ▼
             [ Research Workstation UI ]
     (Product Cards, Specs Grid, Comparison Drawer, History)
```

### Modular Pipeline (`lib/`):
- `lib/categories.js`: Category schemas and specification definitions (Laptops, Phones, Headphones, Shoes, Monitors, Keyboards, Mice, Tablets, Smartwatches, Appliances).
- `lib/requirementExtractor.js`: AI constraint extractor distinguishing hard *Must-Haves* from soft *Preferences*.
- `lib/searchEngine.js`: Multi-query planner and Serper execution across Indian retailers.
- `lib/productNormalizer.js`: Deduplication engine grouping identical models while keeping hardware configurations distinct.
- `lib/requirementMatcher.js`: Evaluates candidate products against user requirements, strictly grounding claims in retrieved evidence.
- `lib/urlValidator.js`: URL syntax validation, domain reputation, product-detail vs search/category page quality scoring, and safe parameter normalization.
- `lib/debugProvenance.js`: Development-only provenance tracking tracing user queries to exact search result IDs and verified final URLs.
- `lib/logger.js`: Structured latency and error logging with automated secret redaction.

---

## Tech Stack
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components + Client Workstation)
- **Language**: JavaScript (ES6+, React 18)
- **Styling**: Vanilla CSS (CSS Custom Properties, Mobile-First, Accessible WCAG AA Contrast)
- **AI Inference**: [Groq](https://console.groq.com) (`openai/gpt-oss-120b` / `qwen/qwen3.8-27b` with structured JSON mode)
- **Search Engine**: [Serper.dev](https://serper.dev) (Google Search India `gl: in`)
- **State & Persistence**: Enhanced `localStorage` with data structures ready for future database migration.

---

## Environment Variables

Create `.env.local` in the project root:

```env
# Required: Groq API Key (Free tier available at https://console.groq.com)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Required: Serper API Key (Free tier search credits at https://serper.dev)
SERPER_API_KEY=your_serper_api_key_here

# Optional: Override the default Groq model (Defaults to openai/gpt-oss-120b with qwen3.8-27b fallback)
GROQ_MODEL=openai/gpt-oss-120b
```

> **Security Note**: Never commit `.env.local` to version control. It is already ignored in `.gitignore`. Both `GROQ_API_KEY` and `SERPER_API_KEY` are accessed exclusively on the server side and never sent to client browsers.

---

## Local Development

```bash
# 1. Clone repository
git clone https://github.com/Sharanghrav-Javali/campusPrice.git
cd campusPrice

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# (Add your GROQ_API_KEY and SERPER_API_KEY to .env.local)

# 4. Run development server
npm run dev

# 5. Open in browser
# Visit http://localhost:3000
```

To verify production builds:
```bash
npm run build
npm start
```

---

## Security & Anti-Hallucination Safeguards

1. **Prompt Injection Protection**: Untrusted text scraped from external web search results is isolated inside strict `<untrusted_product_evidence>` XML delimiters. Webpage snippets cannot alter system instructions.
2. **Anti-Hallucination Guard**: The matching engine is instructed never to invent specifications or warranties. When an attribute is unverified in search snippets, it is explicitly labeled: `"Not available in source"`.
3. **Budget Guardrail**: If user specifies a budget ceiling, products exceeding that ceiling are categorized as *"Above-budget alternatives"* with explicit delta calculation (`+₹X above budget`), never masquerading as within-budget recommendations.
4. **URL Provenance & Accuracy**:
   - **Zero LLM URLs**: The LLM is architecturally forbidden from generating, guessing, or constructing URLs. It references candidates strictly by `candidate_id`.
   - **Immutable Source URLs**: URLs originate exclusively from verified Serper search result objects (`sourceUrl`).
   - **Product vs Search/Category Page Filter**: Heuristic quality scorer filters out category browse pages (`amazon.in/b?`, `flipkart.com/search`), blog reviews, and listicles.
   - **Atomic Offer Model**: Price, retailer, and URL are bound as an indivisible unit (`{ retailer, price, url, urlVerified }`). Price from one seller is never mixed with the URL of another.
   - **No Fake Fallback Links**: If a direct product page cannot be verified, the UI displays *"Product link unavailable"* rather than inventing fake Google or Amazon search links.
5. **Rate Limiting**: Built-in sliding-window limiter rejects excessive requests with `429 Too Many Requests` to protect free API quotas.

---

## Known Limitations & Honest Trade-offs
- **Search Latency**: Executing multi-query live searches combined with AI requirement analysis takes between 6 to 12 seconds.
- **Spec Completeness**: Product specifications depend on what retailers include in their search snippets and metadata. Obscure attributes may show as *"Not available in source"* until direct scraping or retailer affiliate APIs are connected.
- **Volatile Pricing**: Flash sales, bank credit card discounts, and delivery charges can vary. Users are reminded to confirm final prices on the retailer's checkout page.

---

## Roadmap
- [ ] Direct retailer affiliate API integration (Amazon Associates, Flipkart Affiliate API) for real-time stock verification.
- [ ] Database persistence (PostgreSQL / Supabase) for user accounts and price drop history.
- [ ] Automated scheduled price watch alerts via WhatsApp / Telegram.
- [ ] Student discount verification hub (UNiDAYS, Student Beans, Apple Education Store).
