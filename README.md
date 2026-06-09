# ChefPuppers.store — Cloudflare Pages Dynamic Stripe Checkout

This package is the Cloudflare Pages + Stripe Checkout version of the ChefPuppers storefront.

It replaces static Stripe Payment Links with a Cloudflare Pages Function so checkout can calculate the order before sending the customer to Stripe.

## What this version does

- Static storefront in `public/`
- Cloudflare Pages Function backend in `functions/api/`
- Stripe-hosted Checkout redirect
- Server-side cart validation
- Automatic same-bag bundle deal: **Buy 3 of the same bag, get 1 free**
- Automatic shipping by total bag count:
  - 1–2 bags: $6.95
  - 3–5 bags: $9.95
  - 6–9 bags: $10.95
  - 10+ bags: $19.95
  - No free-shipping threshold
- U.S. shipping address collection
- Monday shipment messaging

## Project structure

```text
chefpuppers-cloudflare-dynamic-checkout/
  README.md
  wrangler.toml
  site-package-manifest.json
  public/
    index.html
    success.html
    cancel.html
    styles.css
    app.js
    _headers
    _redirects
    robots.txt
    sitemap.xml
    assets/
      logo.png
      logo-moving.mp4
      product-small.png
      product-medium.png
      product-large.png
  functions/
    api/
      create-checkout-session.js
      health.js
```

## Cloudflare Pages settings

Use GitHub integration because this project includes Cloudflare Pages Functions.

```text
Framework preset: None
Build command: leave blank
Build output directory: public
Root directory: leave blank, unless this folder is inside another wrapper folder
Production branch: main
```

Cloudflare Pages Functions live in the root `functions/` folder. The checkout endpoint becomes:

```text
/api/create-checkout-session
```

## Required Cloudflare environment variable

After the first Cloudflare deployment, add this environment variable:

```text
STRIPE_SECRET_KEY=sk_test_or_sk_live_your_key_here
```

Cloudflare path:

```text
Workers & Pages → your ChefPuppers project → Settings → Environment variables
```

Then redeploy.

## Optional Stripe Tax setting

To let Stripe calculate tax, add this environment variable:

```text
STRIPE_AUTOMATIC_TAX=true
```

Stripe Tax must also be enabled in your Stripe Dashboard.


## Pricing synced from CSV

The site and Cloudflare checkout Function use the prices from `coupons.csv` (`Amount Off` column), because each buy-3-get-1-free coupon amount equals the price of one matching bag.

| Product | 10 Treats | 20 Treats | 50 Treats |
|---|---:|---:|---:|
| Small Dog Treats | $10.00 | $18.00 | $40.00 |
| Medium Dog Treats | $12.00 | $20.00 | $44.00 |
| Large Dog Treats | $16.00 | $25.00 | $55.00 |

The original Stripe Payment Links export is included as `payment_links.csv`. It contains link names and URLs but not price amounts.

## Checkout logic

The browser cart sends this payload to the Cloudflare Function:

```json
{
  "items": [
    { "productId": "small", "bagSize": 10, "quantity": 4 }
  ]
}
```

The Cloudflare Function validates the cart, calculates the same-bag bundle discount, calculates quantity-based shipping, creates a Stripe Checkout Session, and returns the secure Stripe Checkout URL.

The customer cannot change quantities inside Stripe Checkout. They edit the cart on the ChefPuppers site first, so the pricing and shipping stay accurate.

## Important security note

Do not put Stripe secret keys in public website files. Only store `STRIPE_SECRET_KEY` in Cloudflare environment variables.

If a Stripe secret key was pasted into chat, docs, GitHub, or a public file, roll/revoke it in Stripe before launch.
