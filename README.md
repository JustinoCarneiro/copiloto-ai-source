# Copiloto AI

[![CI / Smoke Tests](https://github.com/JustinoCarneiro/copiloto-ai-source/actions/workflows/ci.yml/badge.svg)](https://github.com/JustinoCarneiro/copiloto-ai-source/actions/workflows/ci.yml)

SaaS de finanças pessoais com assistente de IA que registra lançamentos por texto/voz e responde
perguntas analíticas sobre o dinheiro do usuário.

Repositório: [github.com/JustinoCarneiro/copiloto-ai-source](https://github.com/JustinoCarneiro/copiloto-ai-source) (privado)

Projeto desenvolvido seguindo a [metodologia Onda-Dev](https://github.com/JustinoCarneiro/onda-starter).

- **Fonte da verdade do produto:** [`CLAUDE.md`](./CLAUDE.md) — stack, épicos, princípios
- **Histórias de usuário e critérios de aceite:** [`docs/spec.md`](./docs/spec.md)
- **Blueprint técnico:** [`ROADMAP.md`](./ROADMAP.md) — banco, módulos, contratos de API
- **Identidade visual:** [`design/tokens.css`](./design/tokens.css) + [`design/DESIGN.md`](./design/DESIGN.md)
- **Memória técnica:** [`memoria-tecnica/`](./memoria-tecnica/_index.md)
- **Kanban:** board [Copiloto AI no Trello](https://trello.com/b/HetJg8pq/copiloto-ai)

## Setup local

```sh
npm install
npm run dev
```

## Scripts

```sh
npm run dev      # ambiente de desenvolvimento
npm run build     # build de produção
npm run lint      # lint
npm run test      # testes (Vitest)
```
