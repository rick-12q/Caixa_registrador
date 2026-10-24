function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function dateTime(value) {
  return new Date(value).toLocaleString('pt-BR');
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na operação.');
  return data;
}

function showNotice(message, type = 'success') {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = message;
  el.className = `notice show ${type}`;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    el.className = 'notice';
  }, 4500);
}
