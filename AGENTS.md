# Copiloto AI — Contrato canônico de trabalho

## Objetivo

Copiloto AI — app de acompanhamento financeiro pessoal (PWA). Metodologia
OndaDev — versão em `ONDA_VERSION`.

## Mapa do repositório

| Caminho | Finalidade |
| --- | --- |
| `CLAUDE.md` | Espec Viva: contexto, épicos, convenções, notas de implementação. |
| `docs/spec.md` | Histórias de usuário completas e critérios de aceite BDD. |
| `ROADMAP.md` | Blueprint técnico. |
| `src/` | Frontend Vite + React + TypeScript (PWA). |
| `supabase/` | Schema, migrations e edge functions (Deno). |
| `design/` | `tokens.css` + `DESIGN.md`. |
| `memoria-tecnica/` | Bugs cabeludos e decisões fora da spec; consulte antes de investigar. |
| `deploy/` | Configuração de deploy (`.env.example` sanitizado). |

## Autoridade da informação

| Assunto | Fonte canônica | Papel das demais fontes |
| --- | --- | --- |
| Escopo, histórias e aceite | `CLAUDE.md` + `docs/spec.md` | Quadro externo (se houver) só reflete o status. |
| Ordem técnica e progresso | `ROADMAP.md` | — |
| Decisão de arquitetura | `memoria-tecnica/decisoes/` | — |
| Código e histórico versionado | Git | GitHub registra PRs, revisão e CI. |

Não há quadro externo obrigatório para este projeto no momento (Trello
descontinuado). Se um board (Jira) for criado, é uma projeção do status,
acertada à mão, nunca disparada automaticamente por edição de doc.

## Comandos verificados

```bash
npm ci
npm run lint
npm run test          # Vitest (frontend)
npm run build         # tsc + vite build
deno test --no-check=remote .   # edge functions (Supabase)
```

## Fronteiras e convenções

- **Diretiva Primária:** não altere a sintaxe ou o comportamento de código
  existente sem um teste que justifique a quebra (ciclo TDD).
- Frontend Vite + React + TS; edge functions em Deno no Supabase.
- Auth e dados no Supabase — políticas RLS são parte do contrato de segurança.
- Documentação em português claro; nomes técnicos no idioma da tecnologia.
- Consulte `memoria-tecnica/bugs/` antes de investigar bug não trivial.

## Segurança e classes de risco

Dado financeiro pessoal do usuário. Nunca versione, exiba em log ou cole em
prompt: chaves do Supabase (`service_role`), `anon key` de produção, tokens,
senhas ou dados de usuário. `.env` e `deploy/.env` não são versionados;
`deploy/.env.example` só com placeholders.

| Nível | Exemplos | Regra |
| --- | --- | --- |
| R0 | Leitura, docs, testes locais | Executar e validar normalmente. |
| R1 | Código, dependência, migration Supabase, RLS, CI, configuração compartilhada | Declarar impacto, testar e pedir revisão de diff. |
| R2 | Produção, credenciais Supabase, dados de usuário, deploy, exclusão | Exigir autorização explícita e alvo confirmado. |

## Definition of Done

1. atende a uma história de `docs/spec.md` ou escopo escrito com critérios verificáveis;
2. executa os testes que existem (`lint`, Vitest, `build`, `deno test`) e reporta o resultado;
3. atualiza `CLAUDE.md`, `docs/spec.md`, `ROADMAP.md` ou `memoria-tecnica/`
   quando o contrato mudou;
4. não introduz segredo, credencial ou dado de usuário no repositório;
5. passa por revisão proporcional ao risco e deixa um diff compreensível;
6. registra handoff com mudanças, validações, decisões, riscos e pendências.

Não afirme que testes, CI ou deploy passaram sem evidência.

## Revisão e handoff entre agentes

Claude e Codex seguem este arquivo como núcleo comum. Um autor por PR; o outro
revisa o diff quando o risco (R1/R2) exige, com o mínimo suficiente (contrato,
diff, logs de teste). Quando a cota de um agente acaba, o outro assume por
handoff — protocolo na metodologia OndaDev 3.0 (`ONDA_VERSION`).

Síntese de handoff:

```text
Escopo: …
Mudanças: …
Validações executadas e resultado: …
Decisões/ADRs: …
Riscos, bloqueios e próximos passos: …
```
