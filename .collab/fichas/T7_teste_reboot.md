# T7 — Provar que o servidor volta sozinho depois de reiniciar

**Dono:** gemini · **Revisor:** claude · **Tempo:** ~5 min · **Precisa:** T6 em `done`

## Passos
| # | Comando | Deu certo se… |
|---|---|---|
| 1 | **Pedir permissão ao Ryan** para reiniciar o A13 | Ryan disse sim |
| 2 | `adb -s RQ8TC00EJNB reboot` | celular reinicia |
| 3 | Esperar 2 min e rodar `.\tools\server\deploy.ps1 -Step Health` | `{"ok":true,...}` sem ninguém tocar no celular |

## Teste do watchdog (sem reiniciar)
| # | Comando | Deu certo se… |
|---|---|---|
| 4 | `ssh -i $env:USERPROFILE\.ssh\id_ed25519 -p 8022 u0_a271@192.168.1.127 "pkill -f server-box/server.js"` | painel cai |
| 5 | Esperar até 5 min, rodar `-Step Health` | painel voltou |
| 6 | `ssh ... "tail -n 5 ~/servidor/logs/watchdog.log"` | aparece `painel (re)iniciado` |

## Se der erro
Passo 3 falha → o Termux:Boot não foi aberto, ou o Android matou o Termux. Conferir com o Ryan e anotar num handoff para o claude.

## Ao terminar
TASKS.md: T7 → `review`. LOG.md: "reboot ok / watchdog ok" ou o que falhou.
