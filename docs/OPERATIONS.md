# Operação

Serviços no A13 (todos no runit, voltam sozinhos em ~1 s se caírem e sobem no boot em ~73 s):

| Serviço | Porta | Log |
|---|---|---|
| `sshd` | 8022 | `$PREFIX/var/log/sv/sshd` |
| `crond` | — | `$PREFIX/var/log/sv/crond` |
| `server-box` (painel) | 8080 | `~/servidor/logs/server-box/current` |
| `alertas` (ntfy) | — | `~/servidor/logs/alertas/current` |
| `agentops` | 8090 | `~/servidor/logs/agentops/current`, eventos em `~/servidor/agentops-data/events.jsonl` |
| `sftp` | 8023 | `~/servidor/logs/sftp/current` |

## Comandos
| Tarefa | Comando |
|---|---|
| Estado dos serviços (A13) | `SVDIR=$PREFIX/var/service sv status sshd crond server-box alertas agentops sftp` |
| Login do Claude Code no A13 | `ssh -t -p 8022 u0_a271@192.168.1.127 claude` → `/login` → abrir o link no PC |
| Estado do AgentOps (PC) | `curl -H "Authorization: Bearer <token admin>" http://192.168.1.127:8090/api/state` |
| Criar tarefa | `curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"profile":"leitura","prompt":"..."}' http://192.168.1.127:8090/api/tasks` |
| Kill switch | `POST /api/pause` (liga) · `POST /api/resume` (desliga) |
| Cancelar / repetir | `POST /api/tasks/<id>/cancel` · `POST /api/tasks/<id>/retry` |
| Worker do PC (teste) | `node tools/worker/worker.mjs --dry-run` |
| Worker do PC (de verdade) | `node tools/worker/worker.mjs` (gasta uso das contas Claude/Hermes do PC) |
| Backup cifrado + prova de restauração | `bash tools/server/backup.sh` (Git Bash) |
| Deploy do painel | `git push a13 celular` em `server/panel/server-box` (testes + rollback automático) |

O token admin fica em `~/servidor/agentops.token` no A13: leia por SSH quando precisar, não guarde em arquivo do projeto.
Recuperação de desastre: `reports/2026-10-18/disaster-recovery.md` (agora inclui agentops e sftp no backup).
