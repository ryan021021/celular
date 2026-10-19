# 📱 Bare-Metal Phone Server Suite (Android → Linux 24/7)

Ambiente autônomo para transformar smartphones com tela danificada em servidores Linux de alto desempenho, eliminando custos mensais com VPS na nuvem.

---

## 🚀 Início Rápido (Raiz do Projeto)

Para interagir com o servidor sem complicações, use os lançadores diretos:
- **`CONECTAR_SSH.bat`**: Conecta instantaneamente ao terminal Linux via Wi-Fi ou USB com chave criptográfica ED25519 (sem pedir senha).
- **`ESPELHAR_TELA.bat`**: Abre o espelhamento de tela e controle por mouse e teclado via Scrcpy (60 FPS, sem crash de áudio).
- **`PAINEL_CENTRAL.bat`**: Menu interativo com métricas de CPU/RAM, reconexão Wi-Fi ADB e diagnóstico.

---

## 📋 Inventário de Aparelhos

| Aparelho | Modelo | Processador | RAM / Armazenamento | Status | Conexão |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Galaxy A13** | `SM-A135M` | Exynos 850 (8 Cores) | 7.6 GB RAM / 100 GB SSD | **ONLINE (Servidor Ativo)** | `192.168.1.127:8022` |
| **Galaxy A21s** | `SM-A217M` | Exynos 850 (8 Cores) | 3.0 GB RAM / 32 GB | **Resgate Pendente** | Requer ativação ADB |
| **Oppo A78** | `CPH2565` | Snapdragon 680 (8 Cores) | 8.0 GB RAM / 128 GB UFS 2.2 | **Reserva de Hardware** | USB 2.0 (sem Alt Mode) |

---

## 📂 Arquitetura do Repositório

```text
celular/
├── CONECTAR_SSH.bat             # Atalho mestre: Terminal SSH
├── ESPELHAR_TELA.bat            # Atalho mestre: Espelho Scrcpy
├── PAINEL_CENTRAL.bat           # Atalho mestre: Painel interativo
├── README.md                    # Esta documentação
│
├── profiles/                    # Configurações declarativas por hardware
│   ├── a13.json                 # Specs, rede e flags do Galaxy A13 (servidor ativo)
│   ├── a21s.json                # Specs e notas de resgate do Galaxy A21s
│   ├── oppo_a78.json            # Specs e análise técnica do Oppo A78
│   └── _template.json           # Modelo para novos aparelhos
│
├── tools/                       # Ferramentas operacionais modulares
│   ├── connect/                 # Conexão unificada (connect.ps1) e arquivos legados
│   ├── debug/                   # Scripts de inspeção de hardware e portas seriais/MTP
│   ├── optimize/                # Otimizadores de taxa de atualização (90Hz) e processos
│   └── rescue/                  # Ferramentas de injeção de padrões e resgate sem tela
│
├── assets/                      # Binários e capturas de tela organizadas
│   ├── apk/                     # APKs de instalação (Termux Universal, etc.)
│   └── screenshots/             # Histórico visual organizado por sessão
│       ├── sessao-a13/          # Logs visuais de configuração do A13
│       └── sessao-a21s/         # Mapas táteis e diagramas do A21s
│
├── docs/                        # Protocolos e histórico
│   ├── COLABORACAO.md           # Protocolo de trabalho em dupla (Claude + Gemini)
│   └── LOG.md                   # Log de auditoria e alterações
│
└── .collab/                     # Sincronização e governança multi-agente
    ├── TASKS.md                 # Quadro de tarefas ativas
    ├── handoff/                 # Comunicação formal entre agentes
    └── locks/                   # Bloqueios temporários de concorrência
```

---

## 🛠️ Runtimes Instalados no Galaxy A13
- **Node.js**: `v26.4.0`
- **NPM**: `11.21.1`
- **Python**: `3.14.6`
- **Git**: `2.56.0`
- **cURL**: `8.23.0`
- **OpenSSH**: `10.6p1` na porta `8022`
- **Background Persistence**: Monitor de processos fantasma desativado (`settings_enable_monitor_phantom_procs=false`), isenção de economia de bateria (`dumpsys deviceidle whitelist +com.termux`) e `termux-wake-lock` permanente.
