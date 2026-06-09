CHEFPUPPERS CLOUDFLARE ROOT-READY PACKAGE

This ZIP is packaged with NO extra wrapper folder.

After extracting to:
  D:\ChefPuppers\chefpuppers-cloudflare-root-ready

that folder should directly contain:
  README.md
  wrangler.toml
  public\
  functions\
  pricing_from_coupons.csv
  coupons.csv
  payment_links.csv

Cloudflare Pages settings:
  Framework preset: None
  Build command: leave blank
  Build output directory: public
  Production branch: main
  Root directory: leave blank

Required Cloudflare environment variable:
  STRIPE_SECRET_KEY=sk_test_or_sk_live_your_fresh_key

Optional environment variable:
  STRIPE_AUTOMATIC_TAX=true

Test after deployment:
  https://your-project.pages.dev/
  https://your-project.pages.dev/api/health

If the homepage 404s, Cloudflare is not seeing public/index.html.
If /api/health 404s, the functions folder did not deploy.
