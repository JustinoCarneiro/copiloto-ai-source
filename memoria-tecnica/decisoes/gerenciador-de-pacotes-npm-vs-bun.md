---
tipo: decisao
data: 2026-08-04
status: Ativa
---

# Gerenciador de pacotes: npm como padrão de dev/CI, bun.lock mantido sem uso confirmado

## Contexto

O projeto tem três lockfiles coexistindo desde a exportação original do Lovable:
`package-lock.json`, `bun.lock` e `bun.lockb` — todos com o mesmo timestamp de criação. Isso
normalmente indica ambiguidade de ferramenta, não intenção. Ao rodar `npm ci` pela primeira vez
neste retrofit, ele falhou por drift entre `package.json` e `package-lock.json` (dependências
faltando no lock) — só `npm install` funcionou. `npm run lint`/`test`/`build` no `package.json`
são scripts padrão, compatíveis com npm, bun ou pnpm — não indicam a ferramenta pretendida.

## Decisão

- **npm é o padrão para desenvolvimento local e CI** (`.github/workflows/ci.yml` usa `npm ci`).
  `package-lock.json` foi regenerado (via `npm install` + `npm audit fix`) e é a fonte de verdade
  usada por essas duas superfícies.
- **`bun.lock`/`bun.lockb` foram mantidos, não removidos.** Não há confirmação de que o pipeline
  de build do "Lovable Cloud" (destino de deploy citado no `CLAUDE.md`) não dependa deles
  internamente — remover um lockfile que a plataforma de deploy espera poderia quebrar o deploy em
  produção sem qualquer sinal local de erro. O risco de manter um arquivo não utilizado é bem menor
  que o risco de apagar algo que o deploy hospedado possa exigir.

## Consequências

- **Antes de remover `bun.lock`/`bun.lockb`**, confirmar com a documentação/suporte do Lovable
  Cloud (ou testando um deploy) se o build hospedado usa bun. Só remover com essa confirmação.
- Enquanto os três lockfiles coexistirem, **qualquer mudança de dependência deve ser refletida
  manualmentenos dois formatos** (`npm install <pkg>` e, se for confirmado que o deploy usa bun,
  também `bun install`) — ou os lockfiles voltam a divergir silenciosamente.
- Se o Lovable Cloud confirmar uso de npm (não bun), a limpeza correta é remover `bun.lock` e
  `bun.lockb` num commit dedicado, não misturado com outra mudança.

## Ligado a
- [[eslint-scope-supabase-functions]]
