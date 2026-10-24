const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não foi definida. Crie um arquivo .env localmente ou configure a variável no Render.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no PostgreSQL:', err);
});

module.exports = pool;
