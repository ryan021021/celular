# Baseline de Testes — OMNISERVER Fase Zero (§2.4 / §28)

**Data:** 19 de outubro de 2026  
**Autor:** GEM-IDE (Gemini / Antigravity)  
**Ambiente de Execução:** PC Local Windows (PowerShell / Node.js v25 / Git Bash) — Sem dependência de dispositivo físico.  
**Referência da Especificação:** `docs/spec/OMNISERVER_MASTER_SPEC.md` (§2.4, §28)  

---

## 1. Tabela Consolidada de Execução de Testes

| Suíte / Componente | Comando Exato | Testes (Total / Pass / Fail / Skip) | Duração | Resultado | Resumo da Saída / Observações |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geral (Regressão Completa)** | `node tools/qa/regressao.mjs` | 13 etapas verificadas | 15.2 s | ⚠️ **PARCIAL** (1 falha conhecida) | Sintaxe: 27 JS, 18 bash, 14 PS (100% ok). Segredos: 0 em 155 arquivos raiz e 50 arquivos do painel. Regra de paths/serial: 0 ocorrências em 45 scripts. Falha apenas na suíte `server/termux/test` (watchdog no Windows). |
| **Trava ADB (adb-guard)** | `node --test .claude/hooks/adb-guard.test.mjs` | 4 / 4 / 0 / 0 | 5.19 s | ✅ **PASSOU** | Bloqueia comandos destrutivos (`uninstall`, `pm clear`), bloqueia scripts de tweaks quando executados, libera leitura/instalação e aceita bypass com `OK-RYAN`. |
| **AgentOps (Orquestrador)** | `node --test server/agentops/test/agentops.test.mjs` | 18 / 17 / 0 / 1 | 2.43 s | ✅ **PASSOU** | Validação de token admin/worker, criação de tarefas, timeout, cancelamento, kill switch, resiliência do `state.json`, `fitResult` e confinamento em `~/agentes`. G5 pulado (só Linux). |
| **Egress Proxy (Saída Claude)** | `node --test server/termux/test/egress-proxy.test.mjs` | 5 / 5 / 0 / 0 | 2.02 s | ✅ **PASSOU** | Whitelist (`anthropic.com`), recusa HTTP puro e domínios não autorizados (403), erro antes do túnel (502), fecha sem HTTP após 200 (Q4), socket fechado tratado sem erro (G11). |
| **Git Hook Deploy (post-receive)** | `node --test server/termux/test/post-receive.test.mjs` | 2 / 2 / 0 / 0 | 2.94 s | ✅ **PASSOU** | Garante que `post-receive` usa `reset -q --hard "$novo"` (mantendo o branch `celular` anexado e sem soltar HEAD) e valida o comportamento em repositório temporário real. |
| **Watchdog Termux** | `node --test server/termux/test/watchdog.test.mjs` | 2 / 0 / 2 / 0 | 0.09 s | ❌ **FALHOU (Ambiente)** | Falha no Windows por falta da pasta `home/servidor/logs/` durante a invocação simulada do `sh`. Roda e passa no Termux/Linux no A15. |
| **Regras QA & Escopo de Commits** | `node --test tools/qa/test/*.test.mjs` | 5 / 5 / 0 / 0 | 0.92 s | ✅ **PASSOU** | Valida trava de escopo de tarefas (§11), bloqueio de caminhos da Desktop em scripts e detecção de comandos perigosos em diffs de commit. |
| **Conferência de Escopo (§11)** | `node tools/qa/escopo.mjs --review` | 3 tarefas verificadas | 0.50 s | ✅ **PASSOU** | Confere todos os commits das tarefas em `REVIEW` contra os arquivos autorizados: `ok T52`, `ok T54`, `ok T55`. |
| **Worker Remoto PC** | `tools/worker/test/*.test.mjs` | 9 / 9 / 0 / 0 | 0.55 s | ✅ **PASSOU** | Modo `dontAsk`, isolamento de workdir, perfil `pc-claude`, corte de payload por busca binária em bytes UTF-8 (`fitResult`). |
| **Coletor ADB (Métricas)** | `node --test tools/server/adb-coletor.test.mjs` | 3 / 3 / 0 / 0 | 0.30 s | ✅ **PASSOU** | Normalização de CPU por core pelo último quadro do top, anonimização de processos (sem argumentos/segredos) e parsing seguro de sensores térmicos do HAL. |
| **Painel Web (Server-Box v2)** | `node --test server/panel/server-box/test/*.test.mjs` | 130 / 129 / 0 / 1 | 3.23 s | ✅ **PASSOU** | 129 testes aprovados. Cobre CSP estrita, autenticação por token/cookie com salt, `/api/v1/live` SSE, sanitização de logs, métricas do host e ergonomia de toque. 1 teste pulado (Digest Stats sem pasta configurada). |

---

## 2. O que Não Roda Localmente no PC e Por Quê

1. **`server/termux/test/watchdog.test.mjs` (2 falhas no Windows):**
   - *Motivo:* O teste unitário invoca o shell script `server/termux/watchdog.sh` criando uma árvore de diretórios temporária com `sh`. No Windows (MSYS/Node), o redirecionamento para `home/servidor/logs/watchdog.log` falha com `ENOENT` porque a pasta pai não é pré-criada pelo mock do teste em ambiente Windows. No Termux (ambiente real do A15), o diretório existe e o teste passa.
   - *Correção recomendada para o teste:* Criar `home/servidor/logs/` no setup do fixture de teste no Windows.

2. **Teste G5 em `server/agentops/test/agentops.test.mjs` (1 pulado):**
   - *Motivo:* O teste valida truncamento de saída de processo acima de 256 KB em ambiente POSIX puro (`process.platform !== "win32"`). No Windows, o mock de streaming com buffer grande não reproduz fielmente os pipes do Linux.
   - *Status:* Pulado propositalmente no Windows; validado no Termux do A15.

3. **Comandos com Interação Físico-Hardware (Aparelhos Offline):**
   - `tools/rescue/resgatar_galaxy_a21s.ps1`: Não roda porque o A21s está com tela quebrada e sem ADB ativo.
   - Conexão ADB com o A13 (`tools/connect/connect.ps1 -Device a13`): Não roda porque o A13 está offline desde as 11:37.

---

## 3. Comandos Selecionados para Verificação por Amostragem pelo CHEFE

Para reprodução imediata de amostras independentes conforme critério de aceitação:

1. **Amostra 1 — Teste do Hook Post-Receive (G14):**
   ```bash
   node --test server/termux/test/post-receive.test.mjs
   ```
   *Resultado esperado:* 2 testes passando (`✔ post-receive: usa reset --hard`, `✔ post-receive: simulação de reset`).

2. **Amostra 2 — Teste da Trava de Escopo e Regras (§11):**
   ```bash
   node tools/qa/escopo.mjs --review
   ```
   *Resultado esperado:* `ok T52`, `ok T54`, `ok T55`.
