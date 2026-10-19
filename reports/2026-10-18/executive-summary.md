# Resumo executivo — Programa "A13 Home VPS" (lote 1)

Data: 2026-10-18/19 · Executor: Claude · Aparelho: Galaxy A13 SM-A135M (`a13`) · Lock: `.collab/locks/a13-servidor.lock`

O servidor saiu de "painel aberto na rede, deploy sem rede de segurança e sem backup" para **painel com token, deploy que volta sozinho em caso de falha e backup cifrado com restauração conferida**. Nenhum pacote Android foi desativado neste lote (debloat congelado, conforme a Fase 9).

## Feito e verificado
| Item | Evidência |
|---|---|
| Host keys do SSH conferidas por canal confiável (cabo USB, `adb forward`): ED25519, RSA e ECDSA iguais ao `known_hosts` | `network-security-raw.txt` |
| SSH efetivo (`sshd -T`): só chave, senha e teclado-interativo desligados, root `prohibit-password`, MaxAuthTries 3, LoginGraceTime 30, ClientAlive 60×3 | `network-security-raw.txt` |
| Portas vistas da rede: só 8022 (SSH) e 8080 (painel) abertas; 5555 fechada | `network-security-raw.txt` |
| Depuração sem fio do Android desligada (`adb_wifi_enabled` 1 → 0); ADB por USB segue ok | `changes.csv`, `adb get-state` = device |
| Painel e API com token: `/api/monitor` 401 sem credencial, `/` redireciona ao login, login errado 401, limite de 10 tentativas/10 min (429); Bearer e cookie HttpOnly liberam; `/health` público e mínimo | teste da rede em `test-results.md`; 8 testes novos |
| Vigia de alertas usa o token e não gerou falso alarme | `alertas.state.json` = normal após o deploy |
| Deploy seguro: hook roda os testes antes de reiniciar e volta sozinho se testes ou `/health` falharem | push quebrado de propósito → ROLLBACK em 7 s, painel no ar o tempo todo (`~/servidor/logs/deploy.log`) |
| Backup cifrado (AES-256, PBKDF2 200k) no PC, SHA-256, retenção de 7, prova de restauração: 129 arquivos + clone do painel no mesmo commit da produção | saída de `tools/server/backup.sh` |
| Testes do painel no A13 | 44/44 |

## Feito, mas não verificado
- Comportamento sem internet do vigia de alertas (código guarda o estado e tenta de novo; não simulado neste lote).

## Recomendado, ainda não feito
1. **Reboot de validação** depois do debloat do Google e destas mudanças (precisa do Ryan).
2. **Tailscale** para acesso fora de casa (precisa de conta e de aprovar a VPN na tela do aparelho; Play Store está desligada, então via APK oficial).
3. Agendar o `backup.sh` diariamente no Windows (Agendador de Tarefas) — pede aprovação por ser configuração persistente.
4. Corrigir `StrictHostKeyChecking=no` no `tools/connect/connect.ps1` (zona do Gemini; handoff aberto desde a revisão do T1). Agora é seguro: o `known_hosts` foi conferido pelo cabo.
5. Reservar o IP 192.168.1.127 no roteador (DHCP).
6. Guardar uma cópia da chave de backup (`~/.servidor-a13/backup.key`) fora do PC (pendrive ou gerenciador de senhas).

## Bloqueado e porquê
- Uptime, carga e temperatura da CPU via `/proc/uptime`, `/proc/loadavg`: bloqueados pelo SELinux do Android para apps (o painel usa as alternativas que o Android permite).
- Leitura das portas em escuta por dentro do aparelho (`/proc/net/tcp`): sem permissão; substituída por scan a partir do PC.

## Cinco maiores riscos que restam
1. Painel e SSH só funcionam na rede de casa; sem Tailscale não há acesso remoto seguro.
2. Toque fantasma na tela quebrada pode clicar em coisas.
3. Sem internet não sai alerta (o ntfy depende dela).
4. Revisão cruzada atrasada: alertas e autenticação entraram em produção antes da revisão do Gemini.
5. Conflitos de lock entre os agentes já aconteceram 3 vezes.
