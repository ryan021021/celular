# 📱 Bare-Metal Phone Server Suite (Android → Linux 24/7)

Ambiente autônomo para transformar smartphones com tela danificada em servidores Linux locais e estáveis, eliminando custos mensais com VPS na nuvem.

---

## 🚀 Início Rápido (Raiz do Projeto)

Para interagir com o servidor sem complicações, use os lançadores diretos:
- **`CONECTAR_SSH.bat`**: Conecta instantaneamente ao terminal Linux via Wi-Fi ou USB com chave criptográfica ED25519 (sem pedir senha).
- **`ESPELHAR_TELA.bat`**: Abre o espelhamento de tela e controle por mouse e teclado via Scrcpy configurado para o perfil do aparelho.
- **`PAINEL_CENTRAL.bat`**: Menu interativo com métricas de CPU/RAM, reconexão Wi-Fi ADB e diagnóstico.

---

## 📋 Inventário de Aparelhos

| Aparelho | Modelo | Processador | RAM / Armazenamento | Status | Conexão |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Galaxy A15 5G** | `SM-A156B` | Dimensity 6100+ (8 Cores) | 4.0 GB RAM (3,62 GiB física) / 105 GB Flash (/data, 74 GB livres) | **Em Migração (T48)** | USB / ADB autorizada |
| **Galaxy A13** | `SM-A135M` | Exynos 850 (8 Cores) | 3,6 GB RAM (+4 GB RAM Plus) / 109 GB Flash (/data, 102 GB livres) | **Offline** | `192.168.1.127:8022` |
| **Galaxy A21s** | `SM-A217M` | Exynos 850 (8 Cores) | 3.0 GB RAM / 32 GB Flash | **Resgate Pendente** | Requer ativação ADB |
| **Oppo A78** | `CPH2565` | Snapdragon 680 (8 Cores) | 8.0 GB RAM / 128 GB Flash | **Reserva de Hardware** | USB 2.0 (sem Alt Mode) |

---

## 📂 Arquitetura do Repositório

```text
celular/
├── CONECTAR_SSH.bat · ESPELHAR_TELA.bat · PAINEL_CENTRAL.bat · INSTALAR_SERVIDOR.bat   # atalhos de duplo clique
├── README.md                    # esta página
├── AGENTS.md                    # porta de entrada dos agentes → COLABORACAO, CLAUDE.md, GEMINI.md, GEMINI-2.md
│
├── profiles/                    # um JSON por aparelho (a13, a15, a21s, oppo_a78), schema.json e _template.json
│
├── server/                      # o que roda dentro do celular-servidor (Termux)
│   ├── termux/                  # setup, boot, sshd, watchdog, serviços runit (sv/), hook de deploy
│   ├── agentops/                # API do AgentOps (server.mjs, adapters, redact)
│   ├── discovery/               # detecção do aparelho (detect.mjs + fixtures)
│   ├── routines/                # catálogo e agendador de rotinas
│   └── panel/                   # painel web: server-box/ tem git próprio (fora deste repo); UPSTREAM.md
│
├── tools/                       # ferramentas do PC (Windows)
│   ├── connect/                 # connect.ps1, detectar_aparelho.ps1; legacy/ guarda os .bat antigos
│   ├── server/                  # deploy.ps1, backup.sh, reaplicar-ajustes.ps1, versao.mjs
│   ├── install/                 # preflight.mjs (aparelho novo)
│   ├── diag/                    # diag.mjs e capacidades.mjs
│   ├── lib/                     # achar-aparelho.mjs (compartilhado)
│   ├── qa/                      # regressao.mjs (portão), escopo.mjs (trava do commit) e checagens
│   ├── optimize/                # 90 Hz/jogo e manutenção do Antigravity (arquivar, diagnóstico)
│   ├── rescue/                  # resgate de aparelho sem tela (padrão, A21s)
│   ├── worker/                  # worker.mjs (T22, bloqueado)
│   ├── debug/                   # aplicar_tweaks_ocultos, reativar_apps_essenciais; avulsos/ (MTP, COM, Tailscale, relatórios de 18/10)
│   └── collab/aposentado/       # gemini-loop.ps1 (GEM-CLI, D18): só histórico, recusa rodar
│
├── docs/                        # COLABORACAO.md (protocolo), ARCHITECTURE, OPERATIONS, SECURITY_MODEL, LOG.md
│   ├── engineering/             # MASTER_PLAN, DECISIONS, antigravity-travando
│   ├── qa/                      # achados, afirmações, matriz de testes
│   ├── audit/                   # estado atual, riscos, inventário de serviços
│   └── spec/ · log/             # spec do OmniServer; LOG de meses anteriores
│
├── .collab/                     # coordenação entre agentes
│   ├── TASKS.md · TASKS_FEITAS.md   # quadro ativo e concluídas
│   ├── handoff/ · fichas/ · locks/  # recados (resolvidos em handoff/arquivo/), fichas, travas por sigla
│   └── gemini-loop.stop         # mantém qualquer ciclo antigo desligado
│
├── .claude/                     # agents/, skills/ (/rotina, /fechar-tarefa…), hooks/, rules/, settings.json
├── .agents/                     # regras e workflows do Antigravity (/vaga-1, /vaga-2, /entregar, /diagnostico)
├── .githooks/                   # commit-msg → tools/qa/escopo.mjs
├── .vscode/                     # a IDE não vigia assets/, backups/, node_modules
│
├── reports/                     # relatórios por data (os novos ficam fora do git, T46)
├── assets/                      # fora do git: apk/, screenshots/ (sessao-a13, sessao-a21s)
└── backups/                     # fora do git: backups cifrados (.enc + .sha256), backup-agendado.log, antigos/
```

---

## 🛠️ Runtimes e Serviços Verificados
- **Node.js**: `v26.4.0` (pacote `nodejs 26.4.0-1`; fonte: `docs/ARCHITECTURE.md:16`, `profiles/a13.json:28`)
- **OpenSSH**: `10.6p1` na porta `8022` (fonte: `docs/ARCHITECTURE.md:68`, `server/termux/setup.sh:8`)
- **rclone**: SFTP para partilha confinado a `~/shared` na porta `8023` (fonte: `docs/ARCHITECTURE.md:75`, `server/termux/setup.sh:8`)
- **Background Persistence**: Monitor de processos fantasma desativado (`settings_enable_monitor_phantom_procs=false`), isenção de economia de bateria (`dumpsys deviceidle whitelist +com.termux`) e `termux-wake-lock` permanente (fonte: `docs/ARCHITECTURE.md:72`, `tools/server/reaplicar-ajustes.ps1:18`).
