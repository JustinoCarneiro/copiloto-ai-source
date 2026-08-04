# DESIGN — Copiloto AI

> Identidade **do projeto**, não da Onda. Extraída retroativamente de `src/index.css` em
> 2026-08-04 — o produto já está em produção com este visual; **Congelamento Visual já em vigor**:
> qualquer mudança de identidade a partir daqui é mudança de escopo (ver seção 6 da metodologia).

## Conceito

"Futurista financeiro": fundo quase preto, laranja neon como cor de marca, glows e gradientes
sutis simulando profundidade — remete a painel de cockpit/HUD, reforçando o nome "Copiloto".

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#0B0B0B` | Fundo geral (único tema — não há modo claro) |
| `--card` | `#1A1A1A` | Superfície de cards |
| `--primary` | `#FF6A00` | Marca, CTAs, ícones ativos, foco |
| `--primary-glow` | `#FF8C42` | Ponta clara do gradiente de marca |
| `--success` | verde `142 71% 45%` | Status pago/ativo/entrada |
| `--warning` | âmbar `38 100% 55%` | Pendências, avisos |
| `--destructive` | vermelho `0 84% 60%` | Erros, exclusão, saída |

Categorias/cartões/metas usam uma paleta fixa adicional para diferenciar itens do mesmo tipo:
laranja `#FF6A00`, roxo `#A855F7`, azul `#3B82F6`, verde `#10B981`, vermelho `#EF4444`, ciano
`#0EA5E9`.

## Tipografia

- **Corpo:** Inter (400–700) — texto, formulários, dados.
- **Display:** Orbitron (500–900), aplicada em `h1`/`h2`/`h3`/`.font-display` — títulos, valores
  monetários em destaque, nome da marca. `letter-spacing: 0.02em`.

## Efeitos de marca

- `.gradient-primary` / `.gradient-text` — gradiente diagonal laranja→laranja-claro, usado em CTAs
  principais e no texto "Copiloto AI".
- `.glow-primary` / `.text-glow` — sombra/halo laranja, reservado para elementos de destaque (não
  usar em todo botão — perde força se virar padrão).
- `--radius: 1rem` — cantos arredondados generosos em cards, inputs e botões.

## Acessibilidade

- Contraste `--foreground` (branco) sobre `--background` (quase preto) é alto (>15:1) — ok.
- `--primary-foreground` sobre `--primary` (`#0B0B0B` sobre `#FF6A00`) atende AA para texto grande;
  **evitar texto pequeno em cor sólida `--primary`** sem verificar contraste caso a caso.
- Toques (botões, itens de lista) devem manter alvo mínimo de 44px — já é o padrão dos componentes
  shadcn usados no projeto.

## Onde vive o arquivo real

`design/tokens.css` documenta estes mesmos valores no formato Onda-Dev. A fonte de verdade
consumida pelo build é `src/index.css` — ao evoluir a identidade (mudança de escopo), atualizar os
dois em conjunto.
