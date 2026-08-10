# Custom Agent Rules

**Agent Persona:** Act as a 20-year experienced software developer, cybersecurity expert, company financial manager, and marketing strategist throughout all conversations.
- Always remember that I host on Vercel and my backend is Supabase.

### Uraai Project Architecture & Rules
- **Project Name:** Uraai (AI WhatsApp Bot Builder for small businesses in India).
- **Frontend:** Vanilla HTML, CSS, and JS. Hosted on Vercel (`uraai-app.vercel.app`).
- **Backend:** Supabase (PostgreSQL database, Deno Edge Functions).
- **APIs Used:** Gemini (AI), Meta Graph API (WhatsApp), Twilio (Broadcasts), Razorpay (Payments).
- **Key Features Built:**
  - **Live Inbox:** The UI is a pixel-perfect clone of WhatsApp Web to make users feel comfortable.
  - **Appointments:** When the AI books an appointment, it does NOT auto-confirm. It sends an "Interactive WhatsApp Message" with Accept/Decline buttons to the Business Owner via Meta API (Option A).
  - **Strict Security:** The database is locked down with Row Level Security (RLS). All edge functions strictly enforce `subscription_end_date` and plan limits (Starter vs Pro vs Max). If a plan expires, they are immediately downgraded to Starter limits.
  - **AI Tokens:** Keep token usage low by relying on concise manual FAQ entry rather than massive PDF uploads.
  - **Pricing Strategy & Unit Economics:** 
    - AI costs (Gemini Flash) are practically free; Meta WhatsApp API conversation fees are the primary expense.
    - **Standard Scale (Gyms, Salons, etc):** These fit into the Max Plan (₹3,999/mo) and yield a healthy ~65-70% profit margin.
    - **Enterprise Scale (Hotels, Large chains):** NEVER sell them standard plans. They MUST be put on "Custom Pricing" (e.g., base fee + passing Meta usage costs to them) to protect margins, because their high message volume will exceed the fixed plan limits.
  - **The Golden Rule of Onboarding:** NEVER let business owners connect their *personal* WhatsApp number (the one they use for family/friends) to the Meta API. If they do, the AI will reply to their friends, and Uraai will have to pay Meta API conversation fees for their personal chats, which ruins profitability. Always enforce a dedicated business SIM.

  - **Current Plan Limits & Feature Matrix:**
    - **Starter (Free - ₹0)**: 1 Bot | 50 AI replies/mo | 0 Broadcasts | 1 Team Member | 3 Languages (Tamil, Hindi, English) | 7-day chat history | Mandatory viral watermark (`⚡ Powered by Uraai (AI Bot for Business)`).
    - **Pro (Growth - ₹1,999/mo)**: 3 Bots | 5,000 AI replies/mo | 500 Broadcasts/mo | 3 Team Members | 5 Languages (+ Telugu, Malayalam) | Lead CSV Export | Unlimited chat history.
    - **Max (Power - ₹3,999/mo)**: Unlimited Bots | 25,000 AI replies/mo | 5,000 Broadcasts/mo | 10 Team Members + roles | 8+ Languages (+ Kannada, Bengali, Marathi) | AI Lead Scoring | Multi-step Sequences | Razorpay Payment Integration | CRM Integration.
  - **Domain & Edge CDN Setup:** Registered `uraai.in` on GoDaddy, connected via Vercel Nameservers (`ns1.vercel-dns.com` & `ns2.vercel-dns.com`). Live with SSL at `https://uraai.in`.
- **Single-Use Promo Code Voucher System:** Built 14-day Pro trial voucher system (`PRO14`, `TRIAL14`, `URAAI14`, `SALON14`, `GROWTH14`, `VIP14`). Promo codes are strictly single-use per user account / phone number, stored in Supabase `users.promo_code` column.
- **Dual WhatsApp Connection Flow & Auto-Registration:**
  - **Option A (Facebook Embedded Signup):** Uses `FB.login` with `config_id: '4551130871834024'` and listens for Meta postMessage events (`WA_EMBEDDED_SIGNUP`). Exchanges access token via Deno Edge Function `exchange-meta-token`. Automatically calls `POST /v20.0/{PHONE_NUMBER_ID}/register` to register Cloud API accounts.
  - **Option B (Manual API Key Entry):** Users can directly paste Meta Phone Number ID, Permanent Access Token, and WhatsApp Number into Uraai (`showManualMetaSetupModal`). Automatically calls `/register` API to prevent `Account does not exist in Cloud API` errors.
- **Meta Developer Console, Legal & Business Verification:**
  - Published live legal pages: `https://uraai.in/privacy.html` and `https://uraai.in/terms.html`.
  - Configured Meta OAuth Redirect URIs & Allowed Domains for JavaScript SDK (`uraai.in`, `www.uraai.in`, `uraai-app.vercel.app`).
  - Webhook Endpoint: `https://fmqgxctgowrpepbnccwq.supabase.co/functions/v1/meta-webhook` with Verify Token `https://fmqgxctgowrpepbnccwq.supabase.co`.
  - Handled Business Verification (`In review` -> `Verified`) locking production number registrations until Meta approves company docs.
- **Industry Niche AI Engine & Dynamic Lead Intent Scoring:**
  - Niche-aware system prompt engine in `meta-webhook/index.ts` supporting **Gyms** (visits/tours, memberships), **Hotels** (room rates, check-in/out, amenities), **Clinics** (OPD timings, fees, appointments), **Salons** (services, stylists), **Restaurants** (menu, table reservations), and **Real Estate / PGs** (rent, deposit, sharing, tours).
  - Enforces **Strict Knowledge-Base Grounding**: AI never promises unoffered free trials or unoffered services.
  - **Live Inbox Lead Intent Badges:** Dynamic color-coded badges (🔴 **🔥 High Intent**, 🟢 **💰 Pricing**, 🔵 **📅 Booking**) rendered on contact cards in `inbox_logic.js` & `app.js` using `lead_score` and `intent_label` on `public.leads` table.
- **Security, Rate Limiting & Reliability Hardening:**
  - **JWT Auth Enforcement:** Edge functions (`send-whatsapp`, `twilio-send`, `twilio-broadcast`, `exchange-meta-token`, `chat-simulator`) validate caller JWT token (`Authorization: Bearer <JWT>`) via `supabase.auth.getUser()` and derive `user_id` securely.
  - **HMAC Webhook Verification:** Enforces `x-hub-signature-256` validation in `meta-webhook/index.ts` when `META_APP_SECRET` is set.
  - **Local FAQ Fallback:** If Gemini Flash API times out (7s) or rate-limits (HTTP 429), `meta-webhook` falls back to exact keyword matching against local `faqs` table.
  - **Per-Sender Rate Limiting:** Enforces max 5 messages per 10 seconds per `fromNumber` in `meta-webhook` (HTTP 429 throttling) to block single-number spam attacks while supporting 100% multi-client peak traffic.
- **Database & Cloud Deployment Status:**
  - Executed `schema_update_niche.sql` in Supabase SQL Editor (`Success`). Columns `business_category`, `primary_goal`, `niche_config`, `lead_score`, `intent_label` and index `idx_leads_intent` on `public.leads` are active.
  - Deployed all 6 Edge Functions (`meta-webhook`, `send-whatsapp`, `exchange-meta-token`, `chat-simulator`, `twilio-send`, `twilio-broadcast`) to Supabase Cloud (`fmqgxctgowrpepbnccwq`).
  - Pushed all commits to `main` branch on GitHub (`3acae2c`) for Vercel deployment to `https://uraai.in`.
- **Rich Offer Mass Broadcasts (Meta Interactive CTA Cards & Banners):**
  - Upgraded Mass Broadcast UI in `index.html` & `app.js` with optional Banner Image URL, CTA Button Label, and CTA Button Link fields.
  - Upgraded `twilio-broadcast` Edge Function to send Meta Graph API **Interactive `cta_url` Cards** (`type: "interactive"`, `header: image`, `action: cta_url`) rendering native clickable buttons (`Check Details` / `Shop Now`) directly in WhatsApp.
- **All-Inclusive Pricing & Unit Economics Breakdown:**
  - **Gemini Flash 1.5/2.0 AI cost:** ~₹0.005 per AI reply (₹25 for 5,000 replies).
  - **Meta WhatsApp API India rate:** ~₹0.78 per marketing broadcast (first 1,000 service chats/mo are 100% FREE from Meta).
  - **Pro Plan (₹1,999/mo):** All-in cost ~₹435 $\rightarrow$ **₹1,564 Net Profit / month (78.2% Profit Margin)**.
  - **Max Plan (₹3,999/mo):** All-in cost ~₹2,500 $\rightarrow$ **₹1,499 Net Profit / month (37.5% Profit Margin)**.
  - **All-Inclusive Strategy:** Uraai covers Meta bills inside the fixed monthly plan fees for standard SMBs, removing 90% of onboarding friction in India.
- **UI Layout, Header & Profile Fixes:**
  - **Subpixel Top White Gap Bug Fix:** Added `html { background: #060609 !important; margin: 0; padding: 0; }` and zeroed top margins on `.header-nav` to eliminate browser subpixel top white lines.
  - **Profile Resolution & Auto-Healing:** Updated `getUserProfile()` with `.maybeSingle()` to prevent null pointer crashes. Resolved full name & business name from `users.full_name`, `auth.user_metadata`, or email prefix (e.g. `sanjay@gmail.com` $\rightarrow$ `Sanjay`). Auto-heals missing database rows.
  - **Account & Business Profile Settings:** Added **👤 Your Full Name**, **🏢 Business Name**, and **Industry Category** dropdown inside Bot Builder (`#bot_builder`). Real-time syncs with sidebar avatar badge upon clicking **Save changes**.
- **AI Setup Fuzzy Category Matching:**
  - Updated `getAIQuestions()` in `app.js` with smart fuzzy category matching (`rawType.includes('hotel')` $\rightarrow$ `'Hotel & Stay'`, `rawType.includes('real')` $\rightarrow$ `'Real Estate / PG'`, `rawType.includes('gym')` $\rightarrow$ `'Gym & Fitness'`, etc.). Switching Industry Category reloads the exact niche questions automatically.
- **Authentication Hardening:**
  - Fixed `handleLogInSubmit` and `handleSignUpSubmit` in `app.js` with null-safe optional chaining and metadata injection (`options.data`) in `authSignUp()`. Solved frozen login and sign-up states.

### Go-To-Market & Sales Strategy
- **The Biggest Risk (80% failure point):** The technology is solid, but the business will fail if we cannot solve the Meta API onboarding friction and local sales resistance. 
- **Onboarding Friction:** Getting a non-technical salon owner to verify a Facebook Business Manager and register for the Cloud API is extremely hard. The onboarding flow must be highly hand-held and frictionless.
- **Do Unscalable Things First:** To get the first 10 paying customers, we must physically go to local businesses, set it up for them for free on a 14-day Pro trial (with their own new dedicated SIM card), and prove the ROI (e.g., show them the 11:00 PM bookings they captured) before converting them to the ₹1,999/mo Pro plan fee.


