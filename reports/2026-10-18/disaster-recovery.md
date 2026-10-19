# Recuperação de desastre

**RPO** (perda tolerável): até 1 dia de configuração, quando o backup diário estiver agendado (hoje é manual). **RTO** (tempo para voltar): ~30 min com outro Android + PC.

## Backup
- Comando (Git Bash, na raiz do projeto): `bash tools/server/backup.sh`
- Destino: `backups/a13-AAAAMMDD-HHMMSS.tar.gz.enc` + `.sha256`; mantém os 7 mais recentes.
- Cifra: AES-256-CBC, PBKDF2 com 200 mil iterações. Chave: `C:\Users\Ryanr\.servidor-a13\backup.key` (só no PC). **Sem a chave o backup não abre** — guarde uma cópia fora do PC.
- Conteúdo: `~/servidor` (sem logs), `alertas.json`, `painel.token`, `.termux/boot`, `authorized_keys`, host keys do SSH, serviços runit `server-box` e `alertas`, crontab, lista de pacotes, histórico git do painel (bundle).
- Cada execução já prova a restauração (decifra numa pasta temporária, confere arquivos essenciais e clona o painel).

## Cenários
| O que aconteceu | O que fazer |
|---|---|
| Painel caiu | Nada: runit religa em ~1 s; se travar, watchdog em até 5 min; se não voltar, chega CRÍTICO no ntfy. |
| Deploy ruim | Nada: o hook volta sozinho. Manual: `ssh … 'cd ~/servidor/panel/server-box && git reset --hard <commit bom> && SVDIR=$PREFIX/var/service sv restart server-box'` |
| A13 sem Wi-Fi | Cabo USB: `adb forward tcp:8022 tcp:8022` e `ssh -p 8022 u0_a271@127.0.0.1`. |
| Termux apagado ou A13 trocado | Reconstrução abaixo. |
| A13 não liga | Trocar de aparelho (perfil novo em `profiles/`) e reconstruir. |

## Reconstruir do zero (sem depender do A13 antigo)
1. No aparelho: instalar Termux, Termux:Boot e Termux:API da mesma fonte (APKs em `assets/apk/`, builds do GitHub), abrir o Termux:Boot uma vez, isentar os três da economia de bateria.
2. No Termux: `pkg install openssh && sshd`; autorizar a chave do PC (`.collab/fichas/T8_novo_aparelho.md`, passo 5).
3. No PC: `bash tools/server/backup.sh --restaurar backups/<mais recente>.enc C:/temp/restauro`.
4. Copiar de volta: `scp -P 8022 -r C:/temp/restauro/servidor C:/temp/restauro/.termux <usuario>@<ip>:` e as host keys para `$PREFIX/etc/ssh/` (mantém a mesma impressão digital no PC).
5. `tools/server/deploy.ps1 -Device <perfil>` (instala pacotes, serviços runit, hook, cron) e conferir com `-Step Health`.
6. Reaplicar os ajustes Android via ADB (lista em `docs/LOG.md` e na especificação): phantom procs, proteção de bateria, tela, depuração sem fio desligada.
