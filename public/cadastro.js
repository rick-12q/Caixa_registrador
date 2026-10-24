let products = [];

const form = document.getElementById('productForm');
const idInput = document.getElementById('productId');
const nameInput = document.getElementById('name');
const priceInput = document.getElementById('price');
const stockInput = document.getElementById('stock');
const table = document.getElementById('productTable');
const formTitle = document.getElementById('formTitle');
const cancelEdit = document.getElementById('cancelEdit');

async function loadProducts() {
  try {
    products = await api('/api/products');
    renderTable();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function renderTable() {
  if (products.length === 0) {
    table.innerHTML = '<tr><td colspan="4">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  table.innerHTML = products.map(product => `
    <tr>
      <td>${escapeHtml(product.name)}</td>
      <td>${money(product.price)}</td>
      <td>${product.stock}</td>
      <td class="actions">
        <button class="btn-secondary" data-edit="${product.id}">Editar</button>
        <button class="btn-danger" data-delete="${product.id}">Excluir</button>
      </td>
    </tr>
  `).join('');

  table.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => startEdit(Number(button.dataset.edit)));
  });
  table.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => removeProduct(Number(button.dataset.delete)));
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = Number(idInput.value || 0);
  const payload = {
    name: nameInput.value.trim(),
    price: Number(priceInput.value),
    stock: Number(stockInput.value),
  };

  try {
    if (id) {
      await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showNotice('Produto atualizado com sucesso.');
    } else {
      await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      showNotice('Produto cadastrado com sucesso.');
    }
    resetForm();
    await loadProducts();
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

function startEdit(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  idInput.value = product.id;
  nameInput.value = product.name;
  priceInput.value = Number(product.price).toFixed(2);
  stockInput.value = product.stock;
  formTitle.textContent = 'Editar produto';
  cancelEdit.style.display = 'inline-block';
  nameInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  if (!confirm(`Excluir "${product.name}"?`)) return;

  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    showNotice('Produto excluído.');
    resetForm();
    await loadProducts();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Novo produto';
  cancelEdit.style.display = 'none';
}

cancelEdit.addEventListener('click', resetForm);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadProducts();
