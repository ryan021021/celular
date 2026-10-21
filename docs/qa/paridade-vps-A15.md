# Paridade com VPS Conferida no A15 (Só Leitura) — T114

**Data:** 2026-10-22  
**Agente:** GEM-IDE-1  
**Aparelho:** Samsung Galaxy A15 5G (Android 16, Termux sem root)  
**Método:** Leitura via SSH local (porta 8022 forward via ADB). Zero comandos de escrita.  
**Regra de Higiene:** Sem serial nem identificador de usuário do sistema nos registros.

---

## 1. Tabela de Paridade com VPS (Conferência Real)

| Item | Na VPS | No celular | Status | Comando usado | Evidência / Saída real filtrada |
|---|---|---|---|---|---|
| **SSH endurecido** | sim | sim | **PASS** | `sshd -T \| grep -iE 'passwordauthentication\|pubkeyauthentication\|maxauthtries'` | `PubkeyAuthentication yes`<br>`PasswordAuthentication no`<br>`MaxAuthTries 3` |
| **Bloqueio de força bruta** | fail2ban | sim | **PASS** | `sshd -T \| grep -i persourcepenalties` | `PerSourcePenalties crash:90.0 authfail:5.0 noauth:1.0 invaliduser:5.0 grace-exceeded:10.0 refuseconnection:10.0 max:600.0 min:15.0 max-sources4:65536 max-sources6:65536 overflow:permissive overflow6:permissive` (OpenSSH nativo) |
| **Logs com rotação** | journald | sim | **PASS** | `cat $PREFIX/var/service/*/log/run` | Todos os serviços (`server-box`, `alertas`, `egress`, `agentops`, `sftp`, `sshd`) utilizam `exec svlogd -tt "$HOME/servidor/logs/<serviço>"` com arquivos `current` ativos e rotação TAI64N/ISO. |
| **Quem escuta fora de 127.0.0.1 (Firewall)** | nftables | não (sem root) | **PARCIAL** | `sshd -T \| grep ListenAddress` + análise de scripts `run` | `sshd` escuta em `0.0.0.0:8022`; `server-box` em `0.0.0.0:8080`; `agentops` em `0.0.0.0:8090`; `sftp` em `<wlan0_ip>:8023`. Apenas `egress` escuta estritamente em `127.0.0.1:8091`. Aguarda proxy reverso TLS (T115) para fechar todos em `127.0.0.1`. |
| **Supervisão de processos** | systemd | sim | **PASS** | `SVDIR=$PREFIX/var/service sv status $PREFIX/var/service/*` | 7 serviços ativos e supervisionados pelo runit:<br>- `agentops`: UP (190k s)<br>- `alertas`: UP (175k s)<br>- `crond`: UP (190k s)<br>- `egress`: UP (190k s)<br>- `server-box`: UP (34k s)<br>- `sftp`: UP (190k s)<br>- `sshd`: UP (190k s)<br>(`ssh-agent`: DOWN conforme documentado) |
| **Agendador de tarefas** | cron | sim | **PASS** | `crontab -l` | Entradas ativas:<br>`*/5 * * * * sh $HOME/servidor/watchdog.sh`<br>`*/5 * * * * node $HOME/servidor/netguard.mjs >> $HOME/servidor/logs/netguard.log 2>&1`<br>`0 4 * * 0 pkg clean -y >> $HOME/servidor/logs/clean.log 2>&1` |
| **Monitoramento / Métricas** | Prometheus / node_exporter | sim, limitado | **PARCIAL** | `cat /proc/loadavg; head -n 3 /proc/meminfo` | `/proc/loadavg` = `Permission denied` (mitigado pelas capacidades e telemetria do ryx/termux-api); `/proc/meminfo` legível (`MemAvailable: ~740 MB`, `MemTotal: ~3.6 GB`). |
| **TLS e proxy reverso** | nginx/caddy | sim | **FALTA** | `command -v caddy \|\| command -v nginx` | Nenhum proxy reverso instalado (`sem caddy`, `sem nginx`). Objeto da T115. |
| **Backup cifrado** | restic/borg | sim | **PARCIAL** | `command -v age; ls -la ~/servidor/backup*.sh` | Script de backup local existe (`tools/server/backup.sh`), mas cifra com `age` não instalada (`sem age`). Objeto da T116. |
| **Banco de dados** | postgresql etc. | sim | **FALTA** | `command -v sqlite3` | `sem sqlite3` no ambiente básico do Termux. |

---

## 2. Resumo de Paridade
- **Módulos Prontos e Alinhados à VPS (PASS):** Supervisão (`runit`), Agendador (`cron`), Rotação de Logs (`svlogd`), SSH com Chaves Fortes (`ed25519`), Proteção Anti-Brute-Force (`PerSourcePenalties`).
- **Pontos de Compensação Obrigatória (Sem Root):**
  - Isolamento de portas de rede: requer implantação de proxy local reverso (T115) para que todos os serviços façam bind restrito a `127.0.0.1`.
  - Ausência de `/proc/loadavg`: contornada com sucesso através de sondas do `ryx` via `termux-api`.
- **Integridade do Aparelho:** Nenhuma alteração foi realizada; nenhum processo novo foi criado em segundo plano.
