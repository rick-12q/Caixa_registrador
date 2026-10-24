require('dotenv').config();

const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function parseStock(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, database: true, time: result.rows[0].now });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, database: false, error: 'Falha ao conectar ao banco de dados.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, price::float8 AS price, stock, created_at, updated_at
      FROM products
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível carregar os produtos.' });
  }
});

app.post('/api/products', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const price = parseMoney(req.body.price);
  const stock = parseStock(req.body.stock);

  if (!name || price === null || stock === null) {
    return res.status(400).json({ error: 'Informe nome, preço válido e quantidade inteira maior ou igual a zero.' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO products (name, price, stock)
      VALUES ($1, $2, $3)
      RETURNING id, name, price::float8 AS price, stock, created_at, updated_at
    `, [name, price, stock]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com esse nome.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Não foi possível cadastrar o produto.' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const price = parseMoney(req.body.price);
  const stock = parseStock(req.body.stock);

  if (!Number.isInteger(id) || id <= 0 || !name || price === null || stock === null) {
    return res.status(400).json({ error: 'Dados do produto inválidos.' });
  }

  try {
    const result = await pool.query(`
      UPDATE products
      SET name = $1, price = $2, stock = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, price::float8 AS price, stock, created_at, updated_at
    `, [name, price, stock, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe outro produto com esse nome.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Não foi possível atualizar o produto.' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  try {
    const sold = await pool.query('SELECT 1 FROM sale_items WHERE product_id = $1 LIMIT 1', [id]);
    if (sold.rowCount > 0) {
      return res.status(409).json({ error: 'Esse produto já possui vendas registradas. Edite o estoque para 0 em vez de apagar.' });
    }

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível excluir o produto.' });
  }
});

app.post('/api/sales', async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

  const grouped = new Map();
  for (const item of rawItems) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Existem itens inválidos na venda.' });
    }
    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }

  const items = [...grouped.entries()].map(([productId, quantity]) => ({ productId, quantity }));

  if (items.length === 0) {
    return res.status(400).json({ error: 'Adicione pelo menos um produto à venda.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let total = 0;
    let totalItems = 0;
    const saleItems = [];

    for (const item of items) {
      const productResult = await client.query(`
        SELECT id, name, price::float8 AS price, stock
        FROM products
        WHERE id = $1
        FOR UPDATE
      `, [item.productId]);

      if (productResult.rowCount === 0) {
        throw new Error(`Produto ${item.productId} não encontrado.`);
      }

      const product = productResult.rows[0];
      if (product.stock < item.quantity) {
        const error = new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
        error.statusCode = 409;
        throw error;
      }

      const subtotal = Math.round((product.price * item.quantity + Number.EPSILON) * 100) / 100;
      total += subtotal;
      totalItems += item.quantity;
      saleItems.push({ ...product, quantity: item.quantity, subtotal });
    }

    total = Math.round((total + Number.EPSILON) * 100) / 100;

    const saleResult = await client.query(`
      INSERT INTO sales (total, total_items)
      VALUES ($1, $2)
      RETURNING id, total::float8 AS total, total_items, created_at
    `, [total, totalItems]);

    const sale = saleResult.rows[0];

    for (const item of saleItems) {
      await client.query(`
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [sale.id, item.id, item.name, item.quantity, item.price, item.subtotal]);

      await client.query(`
        UPDATE products
        SET stock = stock - $1, updated_at = NOW()
        WHERE id = $2
      `, [item.quantity, item.id]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      sale,
      items: saleItems.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.subtotal,
      })),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Não foi possível finalizar a venda.' });
  } finally {
    client.release();
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const [totals, stock, products, recentSales] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total), 0)::float8 AS revenue,
          COALESCE(SUM(total_items), 0)::int AS units_sold,
          COUNT(*)::int AS sales_count
        FROM sales
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(stock), 0)::int AS units_in_stock,
          COALESCE(SUM(stock * price), 0)::float8 AS stock_value,
          COUNT(*)::int AS product_count
        FROM products
      `),
      pool.query(`
        SELECT
          p.id,
          p.name,
          p.price::float8 AS price,
          p.stock,
          COALESCE(SUM(si.quantity), 0)::int AS units_sold,
          COALESCE(SUM(si.subtotal), 0)::float8 AS revenue
        FROM products p
        LEFT JOIN sale_items si ON si.product_id = p.id
        GROUP BY p.id
        ORDER BY p.name ASC
      `),
      pool.query(`
        SELECT id, total::float8 AS total, total_items, created_at
        FROM sales
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    res.json({
      ...totals.rows[0],
      ...stock.rows[0],
      products: products.rows,
      recentSales: recentSales.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível carregar o resumo.' });
  }
});

app.get('/api/sales/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  try {
    const sale = await pool.query(`
      SELECT id, total::float8 AS total, total_items, created_at
      FROM sales WHERE id = $1
    `, [id]);

    if (sale.rowCount === 0) {
      return res.status(404).json({ error: 'Venda não encontrada.' });
    }

    const items = await pool.query(`
      SELECT product_name AS name, quantity, unit_price::float8 AS unit_price, subtotal::float8 AS subtotal
      FROM sale_items
      WHERE sale_id = $1
      ORDER BY id ASC
    `, [id]);

    res.json({ ...sale.rows[0], items: items.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível carregar a venda.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
