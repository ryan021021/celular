# Mudanças — missão "A13 Server Rebuild" (19/10/2026, sessão claude principal)

Mudanças das outras sessões (console/painel v1, alertas por serviço runit) estão nos commits do `server-box` e no `docs/LOG.md`.

## No A13
| Mudança | Arquivos / comando | Desfazer |
|---|---|---|
| Claude Code 2.1.303 (binário oficial, sem modificação) + carregador musl 1.2.6-r2 do Alpine | `~/opt/claude-code/2.1.303/`, link `current`, wrapper `$PREFIX/bin/claude` | `rm -rf ~/opt/claude-code $PREFIX/bin/claude` |
| Pacotes Termux | `pkg install patchelf ripgrep rclone` | `pkg uninstall …` |
| AgentOps (serviço runit, :8090) | `~/servidor/agentops/`, `~/servidor/agentops-data/`, tokens `agentops.token` e `agentops-workers.json`, `$SVDIR/agentops` | `sv-disable agentops; rm -rf $SVDIR/agentops` |
| SFTP confinado (serviço runit, :8023, preso ao IPv4 do Wi-Fi) | `~/shared`, `~/servidor/sftp/`, `sftp_authorized_keys`, `$SVDIR/sftp` | `sv-disable sftp; rm -rf $SVDIR/sftp` |
| Proxy de saída do Claude Code (127.0.0.1:8091) | `~/servidor/termux/egress-proxy.mjs`, `$SVDIR/egress`; wrapper e adaptador com `HTTPS_PROXY` | `sv-disable egress` (o Claude Code no A13 para de conectar) |
| sshd só IPv4 | `sshd_config.d/10-servidor.conf`: `AddressFamily inet`, `ListenAddress 0.0.0.0:8022` (backup `~/servidor/sshd-10-servidor.conf.bak`) | restaurar o `.bak` + `sv restart sshd` |
| Painel só IPv4 | `server.js` host `0.0.0.0` (`b710d61`) | já incorporado ao console v1 |
| Login do Claude Code (assinatura Pro) | feito pelo Ryan, `~/.claude/` | `claude` → `/logout` |

## No PC
| Mudança | Onde |
|---|---|
| Worker do AgentOps | `tools/worker/worker.mjs`; config `%USERPROFILE%\.servidor-a13\worker.json` (ACL só do usuário) |
| Chave do SFTP | `%USERPROFILE%\.ssh\a13_arquivos` + host key fixada no `known_hosts` (conferida pelo cabo USB) |
| Backup | `tools/server/backup.sh`: inclui agentops e sftp; grava `~/servidor/backup-ultimo.json` no A13 |

## No projeto
- Código: `server/agentops/` (core, adapters, server, profiles, testes), `server/termux/egress-proxy.mjs`, `server/termux/sv/{agentops,sftp,egress}`, `server/termux/setup.sh` (instala os 5 serviços), `server/termux/sshd-servidor.conf`.
- Docs: `docs/AGENT_RUNTIME_MATRIX.md`, `docs/SECURITY_MODEL.md`, `docs/NETWORK_DNS_FILES.md`, `docs/OPERATIONS.md`, `docs/DISASTER_RECOVERY.md`; `docs/ARCHITECTURE.md` é da sessão A13 OS.
