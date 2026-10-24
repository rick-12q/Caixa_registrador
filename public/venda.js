let products = [];
const cart = new Map();

const productGrid = document.getElementById('productGrid');
const cartEl = document.getElementById('cart');
const cartTotal = document.getElementById('cartTotal');
const finishBtn = document.getElementById('finishBtn');
const clearBtn = document.getElementById('clearBtn');
const search = document.getElementById('search');

async function loadProducts() {
  try {
    products = await api('/api/products');
    renderProducts();
    renderCart();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function renderProducts() {
  const term = search.value.trim().toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(term));

  if (filtered.length === 0) {
    productGrid.innerHTML = '<p>Nenhum produto encontrado.</p>';
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const inCart = cart.get(product.id) || 0;
    const remaining = product.stock - inCart;
    const disabled = remaining <= 0;
    return `
      <button class="product-button ${disabled ? 'out' : ''}" data-id="${product.id}" ${disabled ? 'disabled' : ''}>
        <span class="product-name">${escapeHtml(product.name)}</span>
        <span class="product-meta">
          <span>${money(product.price)}</span>
          <span>Estoque: ${remaining}</span>
        </span>
      </button>
    `;
  }).join('');

  productGrid.querySelectorAll('.product-button').forEach(button => {
    button.addEventListener('click', () => addItem(Number(button.dataset.id)));
  });
}

function addItem(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const current = cart.get(productId) || 0;
  if (current >= product.stock) {
    showNotice(`Não há mais estoque de ${product.name}.`, 'error');
    return;
  }
  cart.set(productId, current + 1);
  renderCart();
  renderProducts();
}

function changeQuantity(productId, delta) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const current = cart.get(productId) || 0;
  const next = current + delta;

  if (next <= 0) cart.delete(productId);
  else if (next <= product.stock) cart.set(productId, next);
  else showNotice(`Estoque máximo de ${product.name}: ${product.stock}.`, 'error');

  renderCart();
  renderProducts();
}

function renderCart() {
  if (cart.size === 0) {
    cartEl.innerHTML = '<div class="cart-empty">Nenhum produto adicionado.</div>';
    cartTotal.textContent = money(0);
    finishBtn.disabled = true;
    return;
  }

  let total = 0;
  cartEl.innerHTML = [...cart.entries()].map(([productId, quantity]) => {
    const product = products.find(p => p.id === productId);
    if (!product) return '';
    const subtotal = product.price * quantity;
    total += subtotal;
    return `
      <div class="cart-item">
        <div class="cart-item-top">
          <span>${escapeHtml(product.name)}</span>
          <span>${money(subtotal)}</span>
        </div>
        <div class="cart-controls">
          <small>${money(product.price)} cada</small>
          <div class="qty-controls">
            <button data-action="minus" data-id="${product.id}">−</button>
            <span class="qty-number">${quantity}</span>
            <button data-action="plus" data-id="${product.id}" ${quantity >= product.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cartTotal.textContent = money(total);
  finishBtn.disabled = false;

  cartEl.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      changeQuantity(Number(button.dataset.id), button.dataset.action === 'plus' ? 1 : -1);
    });
  });
}

finishBtn.addEventListener('click', async () => {
  if (cart.size === 0) return;
  finishBtn.disabled = true;
  finishBtn.textContent = 'FINALIZANDO...';

  try {
    const result = await api('/api/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity }))
      })
    });

    cart.clear();
    showNotice(`Venda #${result.sale.id} finalizada. Total: ${money(result.sale.total)}.`);
    await loadProducts();
  } catch (error) {
    showNotice(error.message, 'error');
    await loadProducts();
  } finally {
    finishBtn.textContent = 'FINALIZAR VENDA';
    renderCart();
  }
});

clearBtn.addEventListener('click', () => {
  cart.clear();
  renderCart();
  renderProducts();
});

search.addEventListener('input', renderProducts);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadProducts();
