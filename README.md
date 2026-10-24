# Controle de Vendas Simples

Sistema web simples para cadastro de produtos, controle de estoque, resumo de vendas e venda rápida.

## Tecnologias

- Frontend: HTML, CSS e JavaScript puro
- Backend: Node.js + Express
- Banco: PostgreSQL
- Banco em nuvem recomendado: Neon
- Hospedagem recomendada: Render

## Funcionalidades

- Cadastro de produto com nome, preço e quantidade
- Edição de produto
- Exclusão de produto ainda não vendido
- Tela de venda rápida por clique
- Alteração de quantidade no carrinho
- Verificação de estoque
- Baixa automática de estoque ao finalizar
- Registro de venda e itens vendidos
- Resumo do total arrecadado
- Total de unidades vendidas
- Total disponível em estoque
- Valor atual do estoque
- Últimas vendas com detalhes

## Variáveis de ambiente

Crie `.env` na raiz durante desenvolvimento local:

```env
DATABASE_URL=SUA_CONNECTION_STRING_DO_NEON
PORT=3000
```

## Banco

Execute o arquivo `schema.sql` no SQL Editor do Neon uma única vez.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`.
