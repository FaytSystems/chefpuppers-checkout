const products = [
  {
    id: "small",
    title: "Small Dog Treats",
    subtitle: "Best for pups up to 20 lbs",
    description:
      "Smaller bite-sized bone treats for little pups. Fresh, homemade, organic-minded, and made to order.",
    image: "/assets/product-small.png",
    bags: {
      10: 10.00,
      20: 18.00,
      50: 40.00
    }
  },
  {
    id: "medium",
    title: "Medium Dog Treats",
    subtitle: "Best for pups 21–50 lbs",
    description:
      "Balanced everyday bone treats for medium dogs. Warm bakery style, simple ingredients, and Monday shipping.",
    image: "/assets/product-medium.png",
    bags: {
      10: 12.00,
      20: 20.00,
      50: 44.00
    }
  },
  {
    id: "large",
    title: "Large Dog Treats",
    subtitle: "Best for pups over 50 lbs",
    description:
      "Bigger bone-shaped treats for large pups who love a hearty reward. Handmade fresh for each order.",
    image: "/assets/product-large.png",
    bags: {
      10: 16.00,
      20: 25.00,
      50: 55.00
    }
  }
];

const selectedBags = {
  small: 10,
  medium: 10,
  large: 10
};

const STORAGE_KEY = "chefpuppers-cart-v4-dynamic-checkout";
const CHECKOUT_ENDPOINT = "/api/create-checkout-session";
let cart = loadCart();

const productGrid = document.getElementById("product-grid");
const cartCount = document.getElementById("cart-count");
const cartItems = document.getElementById("cart-items");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartDiscount = document.getElementById("cart-discount");
const cartShipping = document.getElementById("cart-shipping");
const cartTotal = document.getElementById("cart-total");
const bundleNote = document.getElementById("bundle-note");
const checkoutMessage = document.getElementById("checkout-message");
const checkoutButton = document.getElementById("checkout-btn");
const mobileNavToggle = document.getElementById("mobile-nav-toggle");
const mainNav = document.getElementById("main-nav");
const newsletterForm = document.getElementById("newsletter-form");
const cartToggle = document.getElementById("cart-toggle");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const cartClose = document.getElementById("cart-close");

function loadCart() {
  try {
    const parsedCart = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function getProductById(productId) {
  return products.find((product) => product.id === productId);
}

function renderProducts() {
  productGrid.innerHTML = products
    .map((product) => {
      const selectedBag = selectedBags[product.id];
      const price = product.bags[selectedBag];

      return `
        <article class="product-card">
          <div class="product-image-wrap">
            <img class="product-image" src="${product.image}" alt="${product.title}" loading="lazy" />
          </div>

          <div class="product-content">
            <div class="product-meta">
              <div>
                <h3 class="product-title">${product.title}</h3>
                <p class="product-subtitle">${product.subtitle}</p>
              </div>
              <span class="ship-pill">Ships Monday</span>
            </div>

            <p class="product-desc">${product.description}</p>

            <p class="option-label">Choose bag size</p>
            <div class="bag-options">
              ${Object.keys(product.bags)
                .map((bagSize) => {
                  const activeClass = Number(bagSize) === selectedBag ? "active" : "";
                  return `
                    <button
                      class="bag-button ${activeClass}"
                      data-bag-select="true"
                      data-product-id="${product.id}"
                      data-bag-size="${bagSize}"
                      type="button"
                    >
                      <strong>${bagSize}</strong>
                      <span>Treats</span>
                    </button>
                  `;
                })
                .join("")}
            </div>

            <div class="product-footer">
              <div class="price-block">
                <span class="price-label">Selected bag</span>
                <span class="price-value">${formatMoney(price)}</span>
              </div>

              <button
                class="add-cart-btn"
                type="button"
                data-add-to-cart="true"
                data-product-id="${product.id}"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function addToCart(productId) {
  const bagSize = selectedBags[productId];
  const existingItem = cart.find(
    (item) => item.productId === productId && item.bagSize === bagSize
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      productId,
      bagSize,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function changeQuantity(productId, bagSize, delta) {
  const item = cart.find(
    (entry) => entry.productId === productId && entry.bagSize === bagSize
  );

  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart = cart.filter(
      (entry) => !(entry.productId === productId && entry.bagSize === bagSize)
    );
  }

  saveCart();
  renderCart();
}

function removeItem(productId, bagSize) {
  cart = cart.filter(
    (entry) => !(entry.productId === productId && entry.bagSize === bagSize)
  );

  saveCart();
  renderCart();
}

function calculateSubtotal() {
  return cart.reduce((sum, item) => {
    const product = getProductById(item.productId);
    if (!product) return sum;

    const unitPrice = product.bags[item.bagSize];
    return sum + unitPrice * item.quantity;
  }, 0);
}

function calculateSameBagBundleDiscount() {
  return cart.reduce((sum, item) => {
    const product = getProductById(item.productId);
    if (!product) return sum;

    const unitPrice = product.bags[item.bagSize];
    const freeBagCount = Math.floor(item.quantity / 4);
    return sum + freeBagCount * unitPrice;
  }, 0);
}

function getTotalBagCount() {
  return cart.reduce((count, item) => count + item.quantity, 0);
}

function calculateShippingEstimate() {
  if (cart.length === 0) return 0;

  const totalBags = getTotalBagCount();

  if (totalBags <= 2) return 6.95;
  if (totalBags <= 5) return 9.95;
  if (totalBags <= 9) return 10.95;
  return 19.95;
}

function getBundleMessage(discountValue) {
  const eligibleLines = cart
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const product = getProductById(item.productId);
      if (!product) return null;

      const freeCount = Math.floor(item.quantity / 4);
      const needed = freeCount > 0 ? 0 : 4 - (item.quantity % 4);

      return {
        productTitle: product.title,
        bagSize: item.bagSize,
        freeCount,
        needed: needed === 4 ? 4 : needed
      };
    })
    .filter(Boolean);

  if (discountValue > 0) {
    const freeTotal = eligibleLines.reduce((sum, line) => sum + line.freeCount, 0);
    return `Automatic deal applied: ${freeTotal} same-bag treat bag${freeTotal === 1 ? "" : "s"} free.`;
  }

  if (eligibleLines.length === 0) {
    return "Buy 3 of the same bag and get the 4th free automatically. No code needed.";
  }

  eligibleLines.sort((a, b) => a.needed - b.needed);
  const closest = eligibleLines[0];

  return `Add ${closest.needed} more ${closest.productTitle} ${closest.bagSize}-treat bag${closest.needed === 1 ? "" : "s"} to unlock one free same-bag deal.`;
}

function renderCart() {
  const totalItems = getTotalBagCount();
  cartCount.textContent = String(totalItems);

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <p>Your cart is empty.</p>
        <p>Add fresh, homemade treats to get started.</p>
      </div>
    `;
  } else {
    cartItems.innerHTML = cart
      .map((item) => {
        const product = getProductById(item.productId);
        if (!product) return "";

        const unitPrice = product.bags[item.bagSize];
        const lineTotal = unitPrice * item.quantity;
        const freeBagCount = Math.floor(item.quantity / 4);

        return `
          <div class="cart-item">
            <div class="cart-item-header">
              <div>
                <p class="cart-item-title">${product.title}</p>
                <p class="cart-item-meta">${item.bagSize} treats • ${formatMoney(unitPrice)} each</p>
                ${freeBagCount > 0 ? `<p class="cart-item-deal">${freeBagCount} bag${freeBagCount === 1 ? "" : "s"} free with same-bag bundle</p>` : ""}
              </div>
              <strong>${formatMoney(lineTotal)}</strong>
            </div>

            <div class="cart-item-actions">
              <div class="qty-controls" aria-label="Quantity controls">
                <button
                  class="qty-button"
                  type="button"
                  data-qty-change="-1"
                  data-product-id="${item.productId}"
                  data-bag-size="${item.bagSize}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <strong>${item.quantity}</strong>
                <button
                  class="qty-button"
                  type="button"
                  data-qty-change="1"
                  data-product-id="${item.productId}"
                  data-bag-size="${item.bagSize}"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                class="remove-button"
                type="button"
                data-remove-item="true"
                data-product-id="${item.productId}"
                data-bag-size="${item.bagSize}"
              >
                Remove
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const subtotal = calculateSubtotal();
  const discount = calculateSameBagBundleDiscount();
  const shipping = calculateShippingEstimate();
  const total = Math.max(subtotal - discount, 0) + shipping;

  cartSubtotal.textContent = formatMoney(subtotal);
  cartDiscount.textContent = `-${formatMoney(discount)}`;
  cartShipping.textContent = formatMoney(shipping);
  cartTotal.textContent = formatMoney(total);
  bundleNote.textContent = getBundleMessage(discount);

  if (checkoutMessage) {
    checkoutMessage.textContent = "";
    checkoutMessage.classList.remove("error");
  }
}

function getCheckoutItems() {
  return cart.map((item) => ({
    productId: item.productId,
    bagSize: item.bagSize,
    quantity: item.quantity
  }));
}

async function startStripeCheckout() {
  if (cart.length === 0) {
    alert("Add treats to your cart before checking out.");
    return;
  }

  checkoutButton.disabled = true;
  checkoutButton.textContent = "Creating secure checkout...";
  checkoutMessage.textContent = "Calculating bundle savings, quantity-based shipping, and Stripe Checkout.";
  checkoutMessage.classList.remove("error");

  try {
    const response = await fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: getCheckoutItems()
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Checkout could not be started.");
    }

    window.location.href = data.url;
  } catch (error) {
    checkoutMessage.textContent = error.message || "Checkout failed. Please try again.";
    checkoutMessage.classList.add("error");
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Checkout with Stripe";
  }
}

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

productGrid.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.bagSelect === "true") {
    const productId = target.dataset.productId;
    const bagSize = Number(target.dataset.bagSize);
    selectedBags[productId] = bagSize;
    renderProducts();
    return;
  }

  if (target.dataset.addToCart === "true") {
    addToCart(target.dataset.productId);
  }
});

cartItems.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const productId = target.dataset.productId;
  const bagSize = Number(target.dataset.bagSize);

  if (target.dataset.qtyChange) {
    const delta = Number(target.dataset.qtyChange);
    changeQuantity(productId, bagSize, delta);
  }

  if (target.dataset.removeItem === "true") {
    removeItem(productId, bagSize);
  }
});

cartToggle.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
checkoutButton.addEventListener("click", startStripeCheckout);

mobileNavToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
});

mainNav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    mainNav.classList.remove("open");
    mobileNavToggle.setAttribute("aria-expanded", "false");
  }
});

newsletterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.getElementById("newsletter-email").value.trim();

  if (email) {
    alert("Thanks! Connect this form to your email list provider before launch.");
    newsletterForm.reset();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    mainNav.classList.remove("open");
    mobileNavToggle.setAttribute("aria-expanded", "false");
  }
});

renderProducts();
renderCart();
