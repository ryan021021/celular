# Matriz de testes mestra: requisitos P0 e P1 (T64)

**Autor:** QA (Claude) · **Data:** 19/10/2026 · **Fonte:** `docs/spec/OMNISERVER_MASTER_SPEC.md` §24 (P0 e P1) e §25.
**Escopo:** só leitura. Cada linha diz o que existe hoje. COBERTO = há teste automatizado que roda; PARCIAL = há teste, mas não cobre o requisito inteiro, ou só roda à mão; LACUNA = não há teste.
Os testes citados são os das pastas de produção (`server/panel/server-box`, `server/agentops`, `server/termux`, `tools/`). As cópias em `server-box-v2`, `server-box-gemini`, `server-box-front` e `assets/` não entram.

| Req | Prioridade | Requisito (§24) | Arquivo de teste que existe | Estado | Observação |
|---|---|---|---|---|---|
| R1 | P0 | Baseline, backup/restore verificado | `tools/qa/reconstrucao.mjs` (19/19 no backup do A13); `tools/server/adb-coletor.test.mjs` (não cobre backup) | PARCIAL | Restauração só é testada à mão, e só com o backup do A13. `backup.sh` e `backup-agendado.sh` não têm teste automático. |
| R2 | P0 | Serviço e arranque atuais preservados | `server/termux/test/watchdog.test.mjs` (2/2), `post-receive.test.mjs` (2/2), `egress-proxy.test.mjs` (5/5) | PARCIAL | `boot.sh` e a ordem de subida do runit não têm teste. |
| R3 | P0 | Auth, sessão e API sem bypass conhecido | `server/panel/server-box/test/auth.test.mjs`, `session.test.mjs`; caixa-preta `tools/qa/seguranca-painel.mjs` (41 provas) | COBERTO | Caixa-preta rodada hoje no branch `claude/painel-v2`: 41/41. |
| R4 | P0 | Diagnóstico de estado atual | `docs/audit/current-state.md` (com erros, revisado); `tools/qa/regressao.mjs` | PARCIAL | O diagnóstico em si (§20.3) não é um comando testado. Depende de R12 (CLI diagnóstico). |
| R5 | P0 | Remover alegações mockadas perigosas | `docs/qa/AFIRMACOES.md` (conferência manual, uma vez) | LACUNA | Nenhum teste varre o código e a documentação por alegações sem evidência. |
| R6 | P0 | Testes mínimos de smoke | `tools/qa/regressao.mjs` (sintaxe 45/45, suítes, painel, segredos, regras) | COBERTO | Verde hoje. O smoke de instância viva (ex.: `/health` do A15) é manual. |
| R7 | P1 | Config validation | nenhum | LACUNA | `profiles/*.json` não têm schema nem validador. `server/discovery` só gera o schema de saída. |
| R8 | P1 | Capability registry inicial | `server/discovery/test/detect.test.mjs` | PARCIAL | Testa a geração de capacidades (`omniserver.discovery/1`), mas não há registro com testes próprios. |
| R9 | P1 | Health/readiness consistente | `server/panel/server-box/test/server.test.mjs` (`/health`, `/ready`); `seguranca-painel` (público) | PARCIAL | O AgentOps (`/health`, porta 8090) não tem teste específico. |
| R10 | P1 | Logging e redaction | `seguranca-painel` (token, Bearer e sk-ant mascarados no log); `server/agentops/core.mjs:158` usa `redact` | PARCIAL | Redaction do AgentOps não tem teste dedicado. |
| R11 | P1 | DB migrations | nenhum | LACUNA | Não há código de migração. `agentops` guarda `state.json` sem versão. |
| R12 | P1 | CLI diagnostic | `server/panel/server-box/test/cli.test.mjs` | LACUNA | O teste cobre o CLI do painel, não o diagnóstico de §20.3. |
| R13 | P1 | Test harness e test matrix | `tools/qa/regressao.mjs` (harness); este documento (matriz) | COBERTO | Harness verde. A matriz passa a ser mantida aqui. |

## Resumo

- **P0 (6):** 2 COBERTO (R3, R6), 3 PARCIAL (R1, R2, R4), 1 LACUNA (R5).
- **P1 (7):** 1 COBERTO (R13), 3 PARCIAL (R8, R9, R10), 3 LACUNA (R7, R11, R12).

## Lacunas P0 (viram tarefas)

1. **R1:** teste automático de `backup.sh` e de restauração, com o backup do A15 (hoje a restauração só é testada à mão, e só com o backup do A13).
2. **R2:** teste de `boot.sh` e da ordem de subida do runit.
3. **R4:** o diagnóstico de estado atual como comando testado (depende de R12).
4. **R5:** varredura automática de alegações sem evidência em `docs/` e na UI.
