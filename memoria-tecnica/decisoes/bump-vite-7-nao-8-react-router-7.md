---
tipo: decisao
data: 2026-08-13
status: Ativa
---

# Bump de Vite foi até a 7.x, não até a 8.x sugerida pelo `npm audit fix --force`

## Contexto

As 4 vulnerabilidades de dependência (Vite/esbuild moderate, React Router moderate/high) estavam
adiadas desde 2026-08-04 por falta de cobertura de teste suficiente pra validar a migração sem
regressão. Com 148 testes no lugar (Vitest + Deno), decidimos atacar o débito. `npm audit fix
--force` sugeria `vite@8.2.1` como fix — mas isso arrastaria junto uma major nova do `vitest`
(o `vitest@3.2.7` instalado só suporta `vite ^5 || ^6 || ^7`; suporte a `vite@8` só chegou no
`vitest@4.x`), dobrando o raio de risco do bump sem necessidade.

## Decisão

Checamos manualmente (`npm view vite@<versão> dependencies.esbuild`) a partir de qual versão do
Vite o esbuild vulnerável (`<=0.24.2`) já vinha substituído pelo fixado (`>=0.25.0`): a resposta é
Vite 6.3.6. Ou seja, o CVE do esbuild já está resolvido em qualquer Vite 6.3+/7.x — não é preciso
ir até a 8 pra fechar a vulnerabilidade. Instalamos `vite@^7.3.6` (mais recente da 7.x) +
`@vitejs/plugin-react-swc@^4.3.3` (já suporta `vite ^7`), mantendo `vitest@3.2.7` como está —
zero necessidade de tocar no runner de teste. `react-router-dom` foi direto pra `^7.18.2` (a
vulnerabilidade cobria toda a faixa 6.0.0–7.17.0; a versão mínima corrigida já é a 7.18.2).

Verificação pós-bump: `tsc --noEmit` limpo, 148 testes (26 Vitest + 122 Deno) passando, `npm run
build` ok, `npm run lint` sem erro novo, dev server sobe e responde HTTP 200. `npm audit` → 0
vulnerabilidades.

## Consequências

- Se no futuro algo exigir `vite@8` de verdade (um plugin, uma feature específica), o bump de
  `vitest` pra 4.x precisa entrar junto — não fizemos isso agora porque não havia necessidade, só
  risco extra sem benefício de segurança adicional.
- `@vitejs/plugin-react-swc` também subiu (3.11.0→4.3.3) como parte do mesmo bump, por
  compatibilidade de peer dependency com Vite 7.

## Ligado a
- [[lgpd-exportacao-e-exclusao-de-conta]]
