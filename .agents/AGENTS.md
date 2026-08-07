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
  - **Domain Setup:** Registered `uraai.in` on GoDaddy, connected via Vercel Nameservers (`ns1.vercel-dns.com` & `ns2.vercel-dns.com`) to bypass GoDaddy DigiO/WHOIS glitches and serve via global edge CDN.
- **Promo Code Voucher System:** Built a 14-day Pro trial voucher system (`PRO14`, `TRIAL14`, `URAAI14`, `SALON14`, `GROWTH14`). Entering a valid promo code in the Billing screen immediately activates the Pro plan for 14 days without requiring credit card or Razorpay payment upfront.
- **Razorpay Testing Strategy:** Testing phase uses Razorpay Test Mode keys (`rzp_test_...`). Live keys (`rzp_live_...`) are configured via Supabase environment variables when launching to paying clients.
- **3-Bot Architecture:** Pro plan (3 Bots) allows 1 WhatsApp Bot + 1 Instagram DM Bot + 1 Email Bot simultaneously. Max plan allows unlimited bots/multi-branch locations.

### Go-To-Market & Sales Strategy
- **The Biggest Risk (80% failure point):** The technology is solid, but the business will fail if we cannot solve the Meta API onboarding friction and local sales resistance. 
- **Onboarding Friction:** Getting a non-technical salon owner to verify a Facebook Business Manager and register for the Cloud API is extremely hard. The onboarding flow must be highly hand-held and frictionless.
- **Do Unscalable Things First:** To get the first 10 paying customers, we must physically go to local businesses, set it up for them for free on a 14-day Pro trial (with their own new dedicated SIM card), and prove the ROI (e.g., show them the 11:00 PM bookings they captured) before converting them to the ₹1,999/mo Pro plan fee.


