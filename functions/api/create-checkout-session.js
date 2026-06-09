const PRODUCTS = {
  small: {
    title: "Small Dog Treats",
    subtitle: "Best for pups up to 20 lbs",
    bags: {
      10: { unitAmount: 1000, label: "10-Treat Bag" },
      20: { unitAmount: 1800, label: "20-Treat Bag" },
      50: { unitAmount: 4000, label: "50-Treat Bag" }
    }
  },
  medium: {
    title: "Medium Dog Treats",
    subtitle: "Best for pups 21–50 lbs",
    bags: {
      10: { unitAmount: 1200, label: "10-Treat Bag" },
      20: { unitAmount: 2000, label: "20-Treat Bag" },
      50: { unitAmount: 4400, label: "50-Treat Bag" }
    }
  },
  large: {
    title: "Large Dog Treats",
    subtitle: "Best for pups over 50 lbs",
    bags: {
      10: { unitAmount: 1600, label: "10-Treat Bag" },
      20: { unitAmount: 2500, label: "20-Treat Bag" },
      50: { unitAmount: 5500, label: "50-Treat Bag" }
    }
  }
};

const MAX_TOTAL_BAGS = 30;
const MAX_QUANTITY_PER_LINE = 20;

export async function onRequestPost(context) {
  try {
    const stripeSecretKey = context.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return jsonResponse(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY in Cloudflare Pages environment variables." },
        500
      );
    }

    const payload = await context.request.json().catch(() => null);
    const normalizedItems = normalizeItems(payload && payload.items);

    if (normalizedItems.length === 0) {
      return jsonResponse({ error: "Your cart is empty." }, 400);
    }

    const totalBags = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

    if (totalBags > MAX_TOTAL_BAGS) {
      return jsonResponse(
        { error: `Please keep each checkout under ${MAX_TOTAL_BAGS} bags. Contact us for larger orders.` },
        400
      );
    }

    const subtotalCents = calculateSubtotalCents(normalizedItems);
    const bundleDiscountCents = calculateSameBagBundleDiscountCents(normalizedItems);
    const afterDiscountCents = Math.max(subtotalCents - bundleDiscountCents, 0);
    const shippingAmountCents = getShippingAmountCents(totalBags);
    const origin = getRequestOrigin(context.request);

    let couponId = null;
    if (bundleDiscountCents > 0) {
      const coupon = await createStripeCoupon(stripeSecretKey, bundleDiscountCents);
      couponId = coupon.id;
    }

    const checkoutSession = await createCheckoutSession({
      stripeSecretKey,
      normalizedItems,
      subtotalCents,
      bundleDiscountCents,
      shippingAmountCents,
      couponId,
      origin,
      automaticTaxEnabled: String(context.env.STRIPE_AUTOMATIC_TAX || "false").toLowerCase() === "true"
    });

    return jsonResponse({ url: checkoutSession.url });
  } catch (error) {
    return jsonResponse({ error: error.message || "Checkout could not be started." }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS"
    }
  });
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];

  const merged = new Map();

  for (const item of items) {
    const productId = String(item.productId || "").trim().toLowerCase();
    const bagSize = Number(item.bagSize);
    const quantity = Number(item.quantity);

    if (!PRODUCTS[productId]) continue;
    if (!PRODUCTS[productId].bags[bagSize]) continue;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) continue;

    const key = `${productId}:${bagSize}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += quantity;
    } else {
      merged.set(key, { productId, bagSize, quantity });
    }
  }

  return Array.from(merged.values());
}

function getProduct(item) {
  return PRODUCTS[item.productId];
}

function getBag(item) {
  return getProduct(item).bags[item.bagSize];
}

function calculateSubtotalCents(items) {
  return items.reduce((sum, item) => sum + getBag(item).unitAmount * item.quantity, 0);
}

function calculateSameBagBundleDiscountCents(items) {
  return items.reduce((sum, item) => {
    const freeBagCount = Math.floor(item.quantity / 4);
    return sum + freeBagCount * getBag(item).unitAmount;
  }, 0);
}

function getShippingAmountCents(totalBags) {
  if (totalBags <= 2) return 695;
  if (totalBags <= 5) return 995;
  if (totalBags <= 9) return 1095;
  return 1995;
}

function getRequestOrigin(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function createStripeCoupon(stripeSecretKey, amountOffCents) {
  const params = new URLSearchParams();
  params.append("duration", "once");
  params.append("amount_off", String(amountOffCents));
  params.append("currency", "usd");
  params.append("name", "ChefPuppers Same-Bag Bundle Deal");

  return stripeRequest(stripeSecretKey, "https://api.stripe.com/v1/coupons", params);
}

async function createCheckoutSession(options) {
  const {
    stripeSecretKey,
    normalizedItems,
    subtotalCents,
    bundleDiscountCents,
    shippingAmountCents,
    couponId,
    origin,
    automaticTaxEnabled
  } = options;

  const totalBags = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const params = new URLSearchParams();

  params.append("mode", "payment");
  params.append("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/cancel.html`);
  params.append("submit_type", "pay");
  params.append("billing_address_collection", "auto");
  params.append("phone_number_collection[enabled]", "true");
  params.append("shipping_address_collection[allowed_countries][0]", "US");
  params.append("automatic_tax[enabled]", automaticTaxEnabled ? "true" : "false");
  params.append("metadata[store]", "ChefPuppers.store");
  params.append("metadata[shipping_schedule]", "Made to order; ships every Monday");
  params.append("metadata[total_bags]", String(totalBags));
  params.append("metadata[item_subtotal_cents]", String(subtotalCents));
  params.append("metadata[same_bag_bundle_discount_cents]", String(bundleDiscountCents));
  params.append("metadata[shipping_amount_cents]", String(shippingAmountCents));
  params.append("metadata[order_summary]", buildOrderSummary(normalizedItems));

  normalizedItems.forEach((item, index) => {
    const product = getProduct(item);
    const bag = getBag(item);
    const productName = `${product.title} - ${bag.label}`;
    const freeBagCount = Math.floor(item.quantity / 4);

    params.append(`line_items[${index}][quantity]`, String(item.quantity));
    params.append(`line_items[${index}][price_data][currency]`, "usd");
    params.append(`line_items[${index}][price_data][unit_amount]`, String(bag.unitAmount));
    params.append(`line_items[${index}][price_data][product_data][name]`, productName);
    params.append(
      `line_items[${index}][price_data][product_data][description]`,
      `${product.subtitle}. Fresh, homemade, made to order, and ships every Monday.${freeBagCount > 0 ? ` Includes ${freeBagCount} automatic free same-bag bundle discount.` : ""}`
    );
    params.append(`line_items[${index}][price_data][product_data][metadata][product_id]`, item.productId);
    params.append(`line_items[${index}][price_data][product_data][metadata][bag_size]`, String(item.bagSize));
    params.append(`line_items[${index}][price_data][product_data][metadata][same_bag_free_count]`, String(freeBagCount));
  });

  params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingAmountCents));
  params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
  params.append(
    "shipping_options[0][shipping_rate_data][display_name]",
    `Standard Shipping - ${totalBags} Bag${totalBags === 1 ? "" : "s"}`
  );
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "2");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "5");

  if (couponId) {
    params.append("discounts[0][coupon]", couponId);
  }

  return stripeRequest(stripeSecretKey, "https://api.stripe.com/v1/checkout/sessions", params);
}

function buildOrderSummary(items) {
  const summary = items
    .map((item) => `${item.productId}-${item.bagSize}x${item.quantity}`)
    .join(",");

  return summary.length > 480 ? `${summary.slice(0, 477)}...` : summary;
}

async function stripeRequest(stripeSecretKey, url, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : "Stripe API request failed.";
    throw new Error(message);
  }

  return data;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
