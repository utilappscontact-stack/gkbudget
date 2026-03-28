# Affiliate Setup Instructions

## Step 1 — Get your Amazon Associates tag
1. Go to https://associates.amazon.in
2. Sign up / log in
3. Your tag will look like: yourname-21
4. Find it under: Account → Account Settings → Tracking ID

## Step 2 — Replace the placeholder tag
Run this in your terminal from the site folder:
```
bash REPLACE_AFFILIATE_TAG.sh YOUR-ACTUAL-TAG-21
```

## Step 3 — Product images
Amazon CDN images may not hotlink reliably. If product images don't show,
the emoji fallbacks will display instead (this is fine for now).

For better results: download the product images from Amazon product pages
and host them in an /images/ folder on your site.

## Step 4 — Track affiliate clicks in GA4
In GA4 > Events, look for outbound_link clicks to amazon.in.
You can also create a GA4 event for clicks on .aff-btn elements.

## Where affiliate sections appear:
- /articles/modular-kitchen-price-india-2025/ — Kitchen hardware (4 products)
- /articles/false-ceiling-cost-india/ — Cove lighting (4 products)  
- /construction/ — Site safety kit (4 products)
- /interior/ — Pre-start order kit (3 products)
- /quote-check/ — Verification tools (2 products)
- All 7 × 2026 city guides — Site safety kit (4 products each)

## Phase 2 additions planned:
- Franke / Futura kitchen sink product card
- Paint rollers + primer after interior estimate
- LED aluminium channel profile for false ceiling
- Home loan comparison books (Amazon Books)
