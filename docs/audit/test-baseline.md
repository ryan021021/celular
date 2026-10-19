# Baseline de Testes — OMNISERVER Fase Zero (§2.4 / §28)

**Data:** 19 de outubro de 2026  
**Autor:** GEM-IDE (Gemini / Antigravity)  
**Ambiente de Execução:** PC Local Windows (PowerShell / Node.js v25 / Git Bash) — Sem dependência de dispositivo físico.  
**Referência da Especificação:** `docs/spec/OMNISERVER_MASTER_SPEC.md` (§2.4, §28)  

---

## 1. Tabela Consolidada de Execução de Testes

| Suíte / Componente | Comando Exato | Testes (Total / Pass / Fail / Skip) | Duração | Resultado | Resumo da Saída / Observações |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geral (Regressão Completa)** | `node tools/qa/regressao.mjs` | 13 etapas verificadas | 15.2 s | ✅ **PASSOU / MEDIDO** | Sintaxe: 29 JS (`node --check`), 18 bash (`bash -n`), 14 PS (`PowerShell parser`) (100% ok). Segredos: 0 em 161 arquivos raiz e 50 arquivos do painel. Regra de paths/serial: 0 ocorrências em 46 scripts. |
| **Trava ADB (adb-guard)** | `node --test .claude/hooks/adb-guard.test.mjs` | 4 / 4 / 0 / 0 | 2.10 s | ✅ **PASSOU** | Bloqueia comandos destrutivos (`uninstall`, `pm clear`), bloqueia scripts de tweaks quando executados, libera leitura/instalação e aceita bypass com `OK-RYAN`. |
| **AgentOps (Orquestrador)** | `node --test server/agentops/test/agentops.test.mjs` | 18 / 17 / 0 / 1 | 1.33 s | ✅ **PASSOU** | Validação de token admin/worker, criação de tarefas, timeout, cancelamento, kill switch, resiliência do `state.json`, `fitResult` e confinamento em `~/agentes`. G5 pulado (só Linux). |
| **Egress Proxy (Saída Claude)** | `node --test server/termux/test/egress-proxy.test.mjs` | 5 / 5 / 0 / 0 | 1.70 s | ✅ **PASSOU** | Whitelist (`anthropic.com`), recusa HTTP puro e domínios não autorizados (403), erro antes do túnel (502), fecha sem HTTP após 200 (Q4), socket fechado tratado sem erro (G11). |
| **Git Hook Deploy (post-receive)** | `node --test server/termux/test/post-receive.test.mjs` | 2 / 2 / 0 / 0 | 1.41 s | ✅ **PASSOU** | Garante que `post-receive` usa `reset -q --hard "$novo"` (mantendo o branch `celular` anexado e sem soltar HEAD) e valida o comportamento em repositório temporário real. |
| **Watchdog Termux** | `node --test server/termux/test/watchdog.test.mjs` | 2 / 2 / 0 / 0 | 0.15 s | ✅ **PASSOU** | Valida que o watchdog religa apenas serviços fora de `run:` e respeita o arquivo `down` (parado de propósito), ignorando serviços não instalados. |
| **Detecção de Ambiente (Detect)** | `node --test server/discovery/test/detect.test.mjs` | 21 / 21 / 0 / 0 | 0.27 s | ✅ **PASSOU** | Valida snapshot de hardware/OS do A15, classificação de mudanças (informativo, aviso, quebra com saída 4) e tratamento de SSH sem resposta. |
| **Regras QA & Escopo de Commits** | `node --test tools/qa/test/*.test.mjs` | 5 / 5 / 0 / 0 | 0.12 s | ✅ **PASSOU** | Valida trava de escopo de tarefas (§11), bloqueio de caminhos da Desktop em scripts e detecção de comandos perigosos em diffs de commit. |
| **Worker Remoto PC** | `node --test tools/worker/test/*.test.mjs` | 9 / 9 / 0 / 0 | 0.37 s | ✅ **PASSOU** | Modo `dontAsk`, isolamento de workdir, perfil `pc-claude`, corte de payload por busca binária em bytes UTF-8 (`fitResult`). |
| **Coletor ADB (Métricas)** | `node --test tools/server/adb-coletor.test.mjs` | 3 / 3 / 0 / 0 | 0.13 s | ✅ **PASSOU** | Normalização de CPU por core pelo último quadro do top, anonimização de processos (sem argumentos/segredos) e parsing seguro de sensores térmicos do HAL. |
| **Painel Web (Server-Box)** | `node --test server/panel/server-box/test/*.test.mjs` | 130 / 129 / 0 / 1 | 2.72 s | ✅ **PASSOU** | 129 testes aprovados (a cópia server-box-v2 tem suíte própria; as duas juntas: 269, 267 ok, 2 pulados). Cobre CSP estrita, autenticação por token/cookie com salt, `/api/v1/live` SSE, sanitização de logs e ergonomia de toque. 1 teste pulado (Digest Stats sem pasta configurada). |

---

## 2. O que Não Roda Localmente no PC e Por Quê

1. **Teste G5 em `server/agentops/test/agentops.test.mjs` (1 pulado):**
   - *Motivo:* O teste valida truncamento de saída de processo acima de 256 KB em ambiente POSIX puro (`process.platform !== "win32"`). No Windows, o mock de streaming com buffer grande não reproduz fielmente os pipes do Linux.
   - *Status:* Pulado propositalmente no Windows; validado no Termux do A15.

2. **Comandos com Interação Físico-Hardware (Aparelhos Offline):**
   - `tools/rescue/resgatar_galaxy_a21s.ps1`: Não roda porque o A21s está com tela quebrada e sem ADB ativo.
   - Conexão ADB com o A13 (`tools/connect/connect.ps1 -Device a13`): Não roda porque o A13 está offline desde as 11:37.

---

## 3. Comandos Selecionados para Verificação por Amostragem pelo CHEFE

Para reprodução imediata de amostras independentes conforme critério de aceitação:

1. **Amostra 1 — Trava de ADB Guard contra Comandos Destrutivos:**
   ```bash
   node --test .claude/hooks/adb-guard.test.mjs
   ```
   *Resultado medido:* 4 testes passando (`✔ deixa passar leitura e instalação`, `✔ bloqueia destrutivos`, `✔ Q10: bloqueia scripts que mudam o aparelho`, `✔ OK do Ryan libera`).

2. **Amostra 2 — Detecção de Regressão de Ambiente (§3.5 / T61):**
   ```bash
   node --test server/discovery/test/detect.test.mjs
   ```
   *Resultado medido:* 21 testes passando (100% verdes).
