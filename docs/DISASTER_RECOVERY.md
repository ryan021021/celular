# Recuperação de desastre

**RPO** (perda tolerável): a configuração do último backup cifrado; hoje o backup é manual, então o RPO é "desde o último `backup.sh`". **RTO** (tempo para voltar): ~30–45 min com outro Android + PC (inclui baixar o Claude Code de novo).

## O que o backup cobre
Comando no PC (Git Bash, raiz do projeto): `bash tools/server/backup.sh`. Destino `backups/a13-AAAAMMDD-HHMMSS.tar.gz.enc` + `.sha256`, 7 mais recentes. Cifra AES-256-CBC, PBKDF2 200 mil iterações; chave **só** em `%USERPROFILE%\.servidor-a13\backup.key` (guarde uma cópia fora do PC). Cada execução decifra numa pasta temporária, confere os arquivos essenciais, clona o painel do bundle e grava `~/servidor/backup-ultimo.json` no A13.

| Entra no backup | Fica de fora (e por quê) |
|---|---|
| `~/servidor` sem logs: scripts, painel (bundle git), AgentOps (código, `profiles.json`, fila `agentops-data/state.json`), tokens (`painel.token`, `agentops.token`, `agentops-workers.json`), `alertas.json`, chaves do SFTP | `~/shared` (arquivos do usuário, podem ser grandes — copie à parte) |
| `.termux/boot`, `.ssh/authorized_keys`, host keys do SSH | `~/opt/claude-code` (265 MB, baixável de novo do npm) |
| Serviços runit `server-box`, `alertas`, `agentops`, `sftp` | `~/.claude` (login da assinatura — refaça o `/login`) |
| crontab, lista de pacotes, config do sshd | Logs |

## Cenários
| O que aconteceu | O que fazer |
|---|---|
| Um serviço caiu | Nada: runit religa em ~1 s; o vigia manda CRÍTICO se ficar parado ou em loop |
| Deploy ruim do painel | Nada: o hook roda os testes e volta sozinho. Manual: `git reset --hard <commit bom>` no repo do A13 + `sv restart server-box` |
| AgentOps com `state.json` corrompido | O AgentOps guarda o arquivo como `state.json.corrompido-<data>` e começa com a fila vazia; restaurar a fila do backup se precisar |
| A13 sem Wi-Fi | Cabo USB: `adb forward tcp:8022 tcp:8022` e `ssh -p 8022 u0_a271@127.0.0.1` |
| IP do A13 mudou | SSH e painel seguem (escutam em 0.0.0.0); o SFTP precisa de `sv restart sftp` (preso ao IP do Wi-Fi). Atualize `profiles/a13.json` e o `worker.json` do PC |
| Termux apagado ou aparelho trocado | Reconstrução abaixo |

## Reconstruir do zero
1. **Aparelho:** instalar Termux, Termux:Boot e Termux:API da mesma fonte (APKs em `assets/apk/`, builds do GitHub, mesma assinatura), abrir o Termux:Boot uma vez, isentar os três da economia de bateria.
2. **Acesso:** no Termux, `pkg install openssh && sshd`; autorizar a chave do PC (`.collab/fichas/T8_novo_aparelho.md`, passo 5).
3. **Restaurar:** no PC, `bash tools/server/backup.sh --restaurar backups/<mais recente>.enc /c/temp/restauro` (no Git Bash use caminho MSYS `/c/...`: o `tar` do MSYS lê `C:` como host remoto); copiar `servidor/`, `.termux/` e as host keys (`etc/ssh/ssh_host_*`) de volta (a impressão digital do SSH continua a mesma).
4. **Instalar:** `tools/server/deploy.ps1 -Device <perfil>` (pacotes, serviços runit `server-box`, `alertas`, `agentops`, `sftp`, `egress`, hook, cron) e conferir com `-Step Health`.
5. **Claude Code:** `npm pack @anthropic-ai/claude-code-linux-arm64-musl@<versão>`, carregador `ld-musl-aarch64.so.1` do pacote `musl` do Alpine (aarch64), wrapper `$PREFIX/bin/claude` — passo a passo em `docs/AGENT_RUNTIME_MATRIX.md`. Depois `claude` → `/login`.
6. **Android (ADB):** reaplicar `settings_enable_monitor_phantom_procs=false`, `protect_battery=1`, `stay_on_while_plugged_in=0`, `screen_off_timeout=30000`, `adb_wifi_enabled=0`; manter `double_tap_to_wake`/`lift_to_wake` ligados (o aparelho não tem botão para a tela).
7. **Conferir:** painel 401 sem token, `/health` 200, AgentOps 401 sem token, SFTP só com a chave de arquivos, IPv6 público fechado.

## Reinício do A15 (criptografia do Android)
- Depois de reiniciar, o celular fica em `RUNNING_LOCKED` (`ro.crypto.state` = `encrypted`): o Termux:Boot, o sshd e o painel **só sobem depois do 1º desbloqueio** com o PIN. Não é falha do servidor, é o armazenamento criptografado do Android.
- Depois do desbloqueio, confira: `/health` 200 e uptime do runit menor que o do celular (o serviço subiu sozinho pelo `boot.sh`).
- Sem desbloqueio, nada responde em 8022 nem 8080: o acesso remoto só volta quando alguém digita o PIN no aparelho.
