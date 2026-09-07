# PriceCoach

A job-pricing tool for solo trades (pressure washing, junk removal, lawn care,
cleaning, painting, handyman) that computes the price you need to charge to hit
a real profit margin, then uses your own win/loss history to tell you if
you're underpriced or overpriced.

Live app: `index.html` (single self-contained page, no build step, no backend).

## Why this, why now

**The problem is real and well-documented.** Solo and small-crew trade
businesses routinely underprice jobs because they confuse markup with margin,
forget overhead (insurance, vehicle costs, admin time, tool depreciation —
15–30% of job cost), and have no feedback loop telling them their price is
wrong until they're broke. A healthy win rate for a well-priced contractor is
25–35%; most either never measure this or don't know the number matters.

**The existing market is real but the tools are wrong for this customer.**
Jobber and Housecall Pro (the category leaders) start at $29–59/mo and get
expensive fast past one truck — solo operators are paying for scheduling,
dispatch, and CRM features they don't need just to get a quote calculator.
Static "job cost calculators" exist (Joist, CompanyCam blog tools, Mixo) but
they're one-shot calculators with no memory — they don't learn from what
actually happened after the quote went out.

**The wedge:** a free, instant, no-signup calculator (the acquisition hook —
distributable directly into trade communities and via SEO) that gets better
the more you use it, because it tracks your own won/lost outcomes and coaches
you toward the profitable win-rate band instead of just spitting out one
number. That adaptive feedback loop is the differentiator neither the cheap
calculators nor the bloated CRMs offer.

## Business model

- **Free tier:** full calculator, PDF export (with small footer credit),
  up to 15 saved jobs, win/loss insight engine.
- **Pro — $19 one-time unlock:** unlimited saved jobs, no footer on PDFs, CSV
  export, multiple business profiles. One-time price removes the biggest
  friction for a first purchase from a skeptical solo contractor; convert to
  a $6–9/mo subscription later once there's a cloud-sync feature worth paying
  monthly for.
- No ads, no data resale, no login required — all data lives in the user's
  browser (`localStorage`). This is a deliberate trust/privacy pitch to a
  customer who has been burned by expensive SaaS before.

## What's actually implemented (no placeholders)

- Real cost/margin math: separates markup from margin (`price = cost / (1 -
  margin)`), and explicitly shows the dollar amount a contractor would leave
  on the table if they used markup math instead — this is the single most
  common real pricing mistake in the trades, sourced from contractor pricing
  guides during research for this project.
- Trade-specific presets (overhead %, target margin, typical labor rate) for
  10 trades, editable per job.
- A persistent job log (name, trade, price, cost, status) stored in
  `localStorage`, with Won/Lost/Pending status tracking.
- A real insight engine: computes rolling win rate over the last 20 decided
  quotes, compares it to the 25–35% healthy band, and gives a directional,
  trade-broken-down recommendation — not a canned message, it's computed from
  the user's actual saved data.
- Branded PDF quote export via jsPDF (business name/phone/email, line items,
  notes, total) — fully functional client-side, no server required.
- CSV export and full JSON backup/restore of all local data.
- A Pro unlock flow wired to a Stripe Payment Link, plus a fallback manual
  unlock-code path so the founder can sell Pro by hand (e.g. Venmo/Cash App in
  a Facebook group) before Stripe automation is fully wired up.

## What you (the founder) still need to do — these require your own accounts/actions

I can't create financial accounts or post to communities on your behalf. To
actually take money:

1. **Create a Stripe account** (or use an existing one) and create a Payment
   Link for a one-time $19 charge. Set its **after payment** redirect URL to
   `https://<your-domain>/?pro=1` — the app already auto-detects that query
   parameter and unlocks Pro automatically on return. Paste the Payment Link
   URL into `STRIPE_PAYMENT_LINK` near the top of the `<script>` block in
   `index.html`.
2. **Host it.** This repo already deploys as a static site (it previously
   published via GitHub Pages) — enable GitHub Pages on this repo
   (Settings → Pages → deploy from `main` / root) or drop `index.html` into
   Netlify/Vercel/Cloudflare Pages for a free custom domain. Buy a short,
   memorable domain (e.g. `pricecoach.app` or similar — check availability)
   for credibility; a `github.io` URL will hurt conversion.
3. **Distribution — no ad spend needed to start:**
   - Post the free tool (not a pitch) directly into r/Construction,
     r/Landscaping, r/HomeImprovement, r/smallbusiness, and local
     Facebook groups for pressure washing / junk removal / lawn care
     ("Made a free pricing calculator after seeing how many people underbid
     jobs here — no signup, just tells you your real number").
   - Reply genuinely to threads where someone asks "how much should I
     charge for X job" — link the tool as the direct answer.
   - Write 3–5 short SEO posts/pages targeting "how much to charge for
     [pressure washing / junk removal / lawn care] job" — high commercial
     intent, low competition long-tail terms.
   - Once you have a few dozen users, DM the ones who saved 5+ jobs and ask
     if they'd pay for Pro — first paying customers usually come from
     direct outreach, not the button sitting on the page.
4. **Collect feedback and iterate on pricing presets.** The default
   overhead/margin numbers per trade are reasonable starting points based on
   published contractor pricing guidance, not measured data — refine them as
   real users push back.
5. Optional, once there's revenue to justify it: replace the client-side
   unlock-code scheme with a real backend (a small serverless function +
   Stripe webhook) so Pro unlock can't be spoofed by editing localStorage,
   and add real cloud sync as a $/mo upsell.

## File map

- `index.html` — the product (calculator, job log, insight engine, PDF/CSV
  export, Pro unlock). Open it directly in a browser to use it, no build step.
- `archive/beat-drop-storefront.html` — prior unrelated project, kept for
  history, not part of this business.
- `CinematicCameraBuilder.lua` — unrelated Roblox script, untouched.
