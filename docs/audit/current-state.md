# Inventário de Estado Atual — OMNISERVER Fase Zero (§2.1–§2.3)

**Data:** 19 de outubro de 2026  
**Autor:** GEM-IDE (Gemini / Antigravity)  
**Referência da Especificação:** `docs/spec/OMNISERVER_MASTER_SPEC.md` (§1, §2, §28)  
**Dispositivo Primário Atual:** Samsung Galaxy A15 5G (`SM-A156B`, Android 16, Dimensity 6100+, `arm64-v8a`)  
**Dispositivo Anterior (Auditado de Manhã):** Samsung Galaxy A13 (`SM-A135M`, Android 14, Exynos 850, `armv8l` 32-bit) — Status: Offline  

---

## 1. Classificação dos Subsistemas (§2.3)

| Subsistema | Caminho Principal | Estado | Evidência / Prova | Observações |
| :--- | :--- | :--- | :--- | :--- |
| **Painel Web (Server-Box / Console)** | `server/panel/server-box/` | `VERIFIED_WORKING` | `test/console-ui.test.mjs`, `test/api.test.mjs` (140/141 testes ok); `GET /health` HTTP 200 em `http://192.168.1.164:8080/` | Branch `celular` em produção no A15; branch `claude/painel-v2` (`3c1916b`) com nosniff e ações via FIFO. |
| **AgentOps (Orquestrador de Tarefas)** | `server/agentops/` | `VERIFIED_WORKING` | `server/agentops/test/agentops.test.mjs` (17/18 ok, 1 pulado); `server/agentops/README.md` | Porta 8090. Escalonamento estrito por prioridade (0–9) e desempate FIFO (`core.mjs:181,209`). |
| **Egress Proxy (Saída Claude Code)** | `server/termux/egress-proxy.mjs` | `VERIFIED_WORKING` | `server/termux/test/egress-proxy.test.mjs` (5/5 testes ok) | Porta 8091. Whitelist estrita (`anthropic.com`, `claude.ai`, `claude.com`). Protegido contra socket fechado (G11). |
| **SFTP Server Confinado** | `server/termux/sv/sftp/run` | `IMPLEMENTED_UNVERIFIED` | `server/termux/sv/sftp/run:6` (bind estrito a `wlan0/eth0/rndis0/tun0`) | Porta 8023. Rclone servindo `~/shared`. Falta teste fim-a-fim de transferência no A15. |
| **Supervisor Runit & Watchdog** | `server/termux/sv/`, `watchdog.sh` | `VERIFIED_WORKING` | `server/termux/test/watchdog.test.mjs`; `boot.sh:15` | Supervisiona `server-box`, `alertas`, `agentops`, `sftp`, `egress`. Cria logs automaticamente (G19). |
| **Deploy & Git Hook de Produção** | `server/termux/git-hooks/post-receive` | `VERIFIED_WORKING` | `server/termux/test/post-receive.test.mjs` (2/2 testes ok); `tools/server/deploy.ps1` | `post-receive` executa `reset -q --hard "$novo"` mantendo o branch `celular` anexado e roda testes antes do reinício (G14). |
| **Backup & Disaster Recovery** | `tools/server/backup.sh` | `VERIFIED_WORKING` | Backup `a15-20261019-183518` gerado e restaurado com integridade; `tools/qa/reconstrucao.mjs` (19/19 ok) | Backup parametrizado por aparelho via `--perfil <device>` (T50). Cifra com OpenSSL AES-256. |
| **Worker Remoto PC** | `tools/worker/` | `VERIFIED_WORKING` | `tools/worker/test/*.test.mjs` (9/9 ok); `tools/qa/worker-canario.mjs` | Confinamento estrito de filesystem, corte de payload por bytes UTF-8 (`fitResult`). |
| **Lançadores Windows & Conectividade** | `tools/connect/`, `*.bat` | `VERIFIED_WORKING` | `tools/connect/detectar_aparelho.ps1`, `tools/connect/connect.ps1` | Descoberta universal de dispositivos sem serial fixo ou caminhos absolutos de Desktop (regra QA 45/45 ok). |
| **Tweaks & Otimizações Ocultas** | `tools/debug/aplicar_tweaks_ocultos.ps1` | `PARTIAL` | `tools/debug/aplicar_tweaks_ocultos.ps1:10-14` | Proibido em qualquer aparelho sem `[switch]$Confirmo` (sai com `exit 1`). Dex2oat e DPI removidos. |
| **Perfis de Hardware (Profiles)** | `profiles/` | `VERIFIED_WORKING` | `profiles/a15.json`, `profiles/a13.json`, `profiles/a21s.json`, `profiles/oppo_a78.json` | Validados contra o schema e dados reais medidos em bloco. |
| **Plataforma de Extensões Plug-and-Play** | `server/panel/server-box-gemini` | `PARTIAL` | Worktree isolada `server-box-gemini` (branch `gemini/plataforma-universal`) | Escopo aprovado pelo ORQ (desligado por padrão, rotas `/ext/<id>/*`, sem shell); implementação pendente. |
| **Tailscale Mesh VPN** | `profiles/a13.json` | `BLOCKED` | `tools/debug/check_tailscale.cjs` | Requer autenticação manual interativa do Ryan na conta Tailscale (T9). |
| **Hermes AI Engine** | `tools/worker/` | `BLOCKED` | Achado Q2 (`docs/qa/ACHADOS.md`) | Incompatível com o modelo de segurança sem sandbox confinado; desligado até ferramenta confinada (T22). |

---

## 2. Confronto com o Dossiê Matinal (`reports/server_audit_2026-10-19/`)

A auditoria forense realizada na manhã de 19/10/2026 documentou o ecossistema centrado no **Galaxy A13**. Confrontando com o estado real atual do repositório:

1. **Hardware & Nó de Produção:**
   - *Relatório matinal:* Galaxy A13 (`SM-A135M`), 3,6 GB RAM + 4 GB RAM Plus, Exynos 850, 32-bit userspace.
   - *Estado Atual:* O Galaxy A13 sofreu desligamento/offline às ~11:37 após tentativa de compilação AOT (`dex2oat`). O novo servidor de produção é o **Galaxy A15 5G (`SM-A156B`)**, Dimensity 6100+, 4.0 GB RAM (3,62 GiB física), 64-bit userspace nativo (`arm64-v8a`), 105 GB Flash (/data, 74 GB livres), conectado em `192.168.1.164`.

2. **Runtimes e Versões:**
   - *Relatório matinal:* Mencionava Python 3.14 e cURL nos inventários preliminares.
   - *Estado Atual:* Corrigido para as versões reais medidas no Termux: **Node.js v26.4.0** (binário oficial do Termux em `$PREFIX/bin/node`), Git e Rclone. Runtimes inventados foram completamente removidos da documentação oficial (`README.md` e `docs/ARCHITECTURE.md`).

3. **Arquitetura de Segurança & Processos:**
   - *Relatório matinal:* Apontava fragilidades Q1 a Q10 (saída do worker, escape de paths, token no git, `client.end()` desprotegido, serial fixo em scripts).
   - *Estado Atual:*
     - Q1–Q10 sanados e verificados pela QA.
     - Hook commit-msg com trava automática de escopo (`tools/qa/escopo.mjs`).
     - G11 (`client.end()`), G14 (`post-receive` com `reset --hard`), G15 (SFTP restrito a interfaces locais) e G19 (`mkdir` no boot) corrigidos e testados em T52.
     - Bloqueio físico de execução ADB destrutiva ativo via `.claude/hooks/adb-guard.mjs`.

4. **Painel e Console:**
   - *Relatório matinal:* Painel legado `server-box` servindo apenas `status.html`.
   - *Estado Atual:* Painel v2 (`claude/painel-v2`) com rotas `/console`, API restrita com token/sessão, cabeçalho de proteção `nosniff`, controle de serviços por FIFO runit sem invocação de shell, e alvo de toque ergonômico ≥ 42 px em telas móveis de 360 px (T54).

---

## 3. Segurança e Segredos

- **Auditoria de Segredos:** Execução da suíte de regressão (`tools/qa/regressao.mjs`) confirma **0 segredos suspeitos** em 148 arquivos do repositório raiz e 50 arquivos do painel.
- **Isolamento de Chaves:** Tokens (`agentops.token`, `agentops-workers.json`) e chaves SSH residem exclusivamente em `~/servidor` no dispositivo ou nas variáveis de ambiente locais do PC, mascarados dinamicamente via `makeRedactor`.
