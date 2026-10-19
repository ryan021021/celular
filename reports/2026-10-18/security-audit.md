# Auditoria de segurança — 2026-10-18/19

| Área | Estado | Evidência | Ação |
|---|---|---|---|
| SSH | Bom | `sshd -T`: PasswordAuthentication no, KbdInteractive no, PubkeyAuthentication yes, PermitRootLogin prohibit-password, MaxAuthTries 3, LoginGraceTime 30, ClientAlive 60×3, PermitEmptyPasswords no, X11Forwarding no | `AllowTcpForwarding yes` mantido (útil para túnel do painel); revisar se não usado |
| Host keys | Conferidas | 3/3 iguais pelo cabo USB | Remover `StrictHostKeyChecking=no` do `connect.ps1` (Gemini) |
| Chaves autorizadas | 1 (PC) | `authorized_keys` 600, `~/.ssh` 700 | — |
| Painel 8080 | **Corrigido** | Antes: aberto na rede. Agora: token, cookie HttpOnly/SameSite=Strict (HMAC do token), Bearer para scripts, limite de tentativas, CSP no login | Acesso remoto só via Tailscale |
| `/health` | Público, mínimo | Retorna só `{"ok":true,"service":"server-box"}` | — |
| `/api/monitor` | Sem segredos | Campos: dispositivo (modelo), memória, disco, bateria, crons (sem comandos), serviços | — |
| Portas | 8022 e 8080 | Scan do PC: 22, 3000, 5037, 5555, 8081, 8443 fechadas | Não abrir nada no roteador |
| ADB | USB autorizado | Depuração sem fio estava ligada → desligada | Revogar autorizações antigas em Opções do desenvolvedor quando possível |
| Segredos | Fora do git | `alertas.json` 600, `painel.token` 600 (40 chars), chave de backup só no PC (ACL só do usuário) | Cópia da chave de backup fora do PC |
| Pacotes Termux | Atualizados | `apt list --upgradable` = 0 | — |
| Dependências npm | Nenhuma | server-box é Node puro | — |
| Telemetria Android | Reduzida | Ver debloat em `docs/LOG.md` | Debloat congelado |
