# Inventário de serviços do A15 (T57)

**Data da medição:** 19 de outubro de 2026, ~19:55 (horário de Brasília)
**Autor:** BACK (Claude)
**Aparelho:** Galaxy A15 5G (`SM-A156B`, serial RZCX326RHSV, Wi-Fi 192.168.1.164, Android 16)
**Como foi medido:** somente leitura, por SSH na porta 8022 (chave). Nada foi iniciado, parado nem alterado. Comandos usados: `sv status` em cada serviço do runit, `crontab -l`, `ps -A`, `node -v`, leitura dos scripts `run` e do `watchdog.sh`. Nenhum token foi lido nem escrito neste documento.

> Não copiado da doc: cada linha abaixo veio do aparelho. Onde não foi possível medir, está escrito.

## 1. Serviços do runit

Comando de prova de todos: `sv status $PREFIX/var/service/<nome>` (saída resumida; tempo = segundos desde o último start do processo, com o celular ligado há ~11 min).

| Serviço | Estado | Prova (saída de `sv status`, resumida) | Porta declarada no script | Função |
|---|---|---|---|---|
| `sshd` | run | `run: sshd: (pid 13505) 702s` | 8022 | acesso remoto por chave |
| `server-box` | run | `run: server-box: (pid 13601) 701s` | 8080 | painel (console) |
| `alertas` | run | `run: alertas: (pid 13498) 702s` | — | vigia de alertas (ntfy) |
| `agentops` | run | `run: agentops: (pid 13494) 702s` | 8090 (token) | fila de tarefas dos agentes |
| `sftp` | run | `run: sftp: (pid 13496) 702s` | 8023 | SFTP confinado em `~/shared` |
| `egress` | run | `run: egress: (pid 13508) 702s` | 8091 (só 127.0.0.1) | proxy de saída do Claude Code |
| `crond` | run | `run: crond: (pid 13511) 702s` | — | cron (rotinas e watchdog) |
| `ssh-agent` | **down** | `down: ssh-agent: 702s` | — | presente no runit, parado; nada depende dele |

Resultado: **7 serviços no ar e 1 parado**. O `ssh-agent` está parado de propósito; o script dele é só o modelo do pacote termux-services. Não iniciar sem motivo.

## 2. Cron

Prova: `crontab -l`.

| Linha | Função |
|---|---|
| `*/5 * * * * sh $HOME/servidor/watchdog.sh` | reergue o sshd e os serviços do runit que caíram (ver §3) |
| `0 4 * * 0 pkg clean -y >> $HOME/servidor/logs/clean.log 2>&1` | limpa o cache de pacotes todo domingo às 04h |

Não há rotina de backup no cron: o backup (`tools/server/backup.sh`) roda do PC, não do aparelho.

## 3. Watchdog (`~/servidor/watchdog.sh`)

Prova: leitura do script no aparelho.

- Se o `sshd` não está no processo, sobe de novo (`sv up sshd` ou `sshd`).
- Chama `start-services.sh`, que sobe os serviços do runit que estiverem em `down`.
- Não checa o crond: o próprio cron roda o watchdog, então se o watchdog roda, o crond está vivo.
- Log: `~/servidor/logs/watchdog.log`.

## 4. Portas

As portas são as declaradas nos scripts `run`. **Não foi possível confirmar por socket:** `cat /proc/net/tcp` e `/proc/net/tcp6` vieram vazios para o usuário do SSH, e `ss -ltn` / `netstat -ltn` não listaram nenhuma porta. Para confirmar, medir com `curl` em cada porta a partir do PC na mesma rede (fica para a próxima rodada).

| Porta | Serviço | Exposição declarada |
|---|---|---|
| 8022 | sshd | LAN (chave, sem senha) |
| 8080 | server-box | IPv4 da LAN e Tailscale; `/health` e `/ready` públicos, o resto com token |
| 8090 | agentops | token obrigatório |
| 8023 | sftp | IPv4 do Wi-Fi, só chave de `sftp_authorized_keys` |
| 8091 | egress | só 127.0.0.1 |

## 5. Ferramentas instaladas

Prova: `node -v`, `git --version`, `ps -A`.

- Node **v26.4.0**
- git **2.56.0**
- rclone (processo do sftp)
- Termux:Boot e Termux:API (ver `docs/DISASTER_RECOVERY.md`)

## 6. Limites desta medição

- Portas não confirmadas por socket (ver §4).
- Uso de CPU, memória e disco não entram aqui: quem mede isso é o painel (`/api/v1/overview`).
- Este é um retrato de 19/10 às ~19:55. Serviços sobem e caem com o tempo; a referência é o `sv status` do dia.
- Ao reiniciar o aparelho, nada volta antes do primeiro desbloqueio (ver `docs/DISASTER_RECOVERY.md`, seção "Reinício do A15").
