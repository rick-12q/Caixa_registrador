const revenue = document.getElementById('revenue');
const unitsSold = document.getElementById('unitsSold');
const unitsStock = document.getElementById('unitsStock');
const salesCount = document.getElementById('salesCount');
const stockValue = document.getElementById('stockValue');
const productSummary = document.getElementById('productSummary');
const recentSales = document.getElementById('recentSales');
const modal = document.getElementById('saleModal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');

async function loadSummary() {
  try {
    const data = await api('/api/summary');
    revenue.textContent = money(data.revenue);
    unitsSold.textContent = data.units_sold;
    unitsStock.textContent = data.units_in_stock;
    salesCount.textContent = data.sales_count;
    stockValue.textContent = money(data.stock_value);

    productSummary.innerHTML = data.products.length ? data.products.map(product => {
      const badgeClass = product.stock === 0 ? 'badge-out' : product.stock <= 5 ? 'badge-low' : 'badge-ok';
      return `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td><span class="badge ${badgeClass}">${product.stock}</span></td>
          <td>${product.units_sold}</td>
          <td>${money(product.revenue)}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="4">Nenhum produto cadastrado.</td></tr>';

    recentSales.innerHTML = data.recentSales.length ? data.recentSales.map(sale => `
      <tr style="cursor:pointer" data-sale="${sale.id}" title="Clique para ver os itens">
        <td>#${sale.id}</td>
        <td>${dateTime(sale.created_at)}</td>
        <td>${sale.total_items}</td>
        <td>${money(sale.total)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">Nenhuma venda registrada.</td></tr>';

    recentSales.querySelectorAll('[data-sale]').forEach(row => {
      row.addEventListener('click', () => showSale(Number(row.dataset.sale)));
    });
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function showSale(id) {
  try {
    const sale = await api(`/api/sales/${id}`);
    modalTitle.textContent = `Venda #${sale.id}`;
    modalContent.innerHTML = `
      <p>${dateTime(sale.created_at)}</p>
      ${sale.items.map(item => `
        <div class="sale-detail-line">
          <span>${escapeHtml(item.name)} × ${item.quantity}</span>
          <strong>${money(item.subtotal)}</strong>
        </div>
      `).join('')}
      <hr style="border:0;border-top:1px solid #dfe5ec;margin:14px 0">
      <div class="sale-detail-line"><strong>Total</strong><strong>${money(sale.total)}</strong></div>
    `;
    modal.classList.add('show');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

document.getElementById('closeModal').addEventListener('click', () => modal.classList.remove('show'));
modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('show'); });

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadSummary();
