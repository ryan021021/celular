# Modelo de segurança

Princípio: nada administrativo fica exposto fora da rede de casa, todo acesso exige chave ou token, e nenhuma rota HTTP executa comando.

| Superfície | Porta | Quem acessa | Proteção |
|---|---|---|---|
| SSH (admin) | 8022 | PC (chave `id_ed25519`) | Só chave; senha desligada; host key conferida pelo cabo USB |
| Painel server-box | 8080 | Navegador / scripts | Token (`~/servidor/painel.token`); cookie HttpOnly SameSite=Strict; limite de tentativas; `/health` público e mínimo |
| AgentOps | 8090 | Admin e workers | Token admin (`agentops.token`) e token de worker (`agentops-workers.json`) separados; worker só busca/devolve tarefa dos seus perfis |
| SFTP (arquivos) | 8023 | Chave própria `a13_arquivos` | rclone confinado em `~/shared`; não segue atalhos; chave de admin recusada |
| ADB | USB | PC autorizado | Depuração sem fio desligada |
| Coletor ADB → A13 (T27) | 8022 | PC, chave própria `a13_adb_coletor` (aprovada pelo Ryan em 19/10) | Linha no `authorized_keys`: `command="node ~/servidor/panel/server-box/adb-recebe.mjs",restrict,from="192.168.1.116"`. A chave só entrega o snapshot: o comando pedido pelo cliente é ignorado, sem pty, sem encaminhamento (testado em 19/10 01:55). O receptor valida o esquema, limita a linha a 16 KB e a 1 por segundo, grava `~/servidor/adb/latest.json` (600, atômico) e nunca executa nada. **Se o IP do PC mudar (DHCP), o coletor para de entregar** e o painel mostra "sem dados do ADB"; para voltar, atualizar o `from=`. Revogar: apagar a 2ª linha do `authorized_keys` (backup em `authorized_keys.bak-20261019-adb`) |

## Segredos
| Segredo | Onde | Permissão | Em backup |
|---|---|---|---|
| Token do painel | A13 `~/servidor/painel.token` | 600 | cifrado |
| Tópico ntfy | A13 `~/servidor/alertas.json` | 600 | cifrado |
| Tokens do AgentOps | A13 `~/servidor/agentops.token`, `agentops-workers.json` | 600 | cifrado |
| Token do worker (cópia) | PC `%USERPROFILE%\.servidor-a13\worker.json` | ACL só do usuário | não |
| Chave do backup | PC `%USERPROFILE%\.servidor-a13\backup.key` | ACL só do usuário | **guardar cópia fora do PC** |
| Credenciais do Claude Code | A13 `~/.claude/` (após login) | do Claude Code | não |
| Chave do coletor ADB (sem senha, para rodar sozinho) | PC `%USERPROFILE%\.ssh\a13_adb_coletor` | ACL: o usuário, SYSTEM e Administradores | não (recriável; só serve para entregar o snapshot) |

Nenhum segredo está no git; logs e saídas de tarefas passam por mascaramento (tokens conhecidos, `sk-ant-…`, `Bearer …`, chaves privadas).

## Agentes
- Tarefa = perfil + texto; não existe campo de comando (pedido com campo extra é recusado com 400).
- Ferramentas por perfil via `--allowedTools` + `--permission-mode dontAsk` (nega tudo que não foi pré-aprovado; o padrão novo do Claude Code, `auto`, aprovaria sozinho). Nunca `--dangerously-skip-permissions` / `--yolo`.
- Saída para a internet do Claude Code no A13 só pelo proxy `egress` (127.0.0.1:8091), que aceita apenas anthropic.com, claude.ai e claude.com. Testado: example.com negado; proxy inacessível pela rede.
- Teste real das regras (19/10): leitura de `~/servidor/agentops-workers.json` negada; nenhum token na saída.
- Regras de negação do Claude Code em cada pasta de perfil: `.env`, `~/.ssh`, credenciais, tokens do servidor, `*.pem`, `*.key`, `curl`, `wget`, `ssh`, `scp`, `rm -rf`, `git push`.
- **Limite honesto:** isso é isolamento lógico (regras do Claude Code), não sandbox de kernel. Sem root não há namespaces/chroot no A13: um agente com Bash liberado teria acesso a tudo do usuário do Termux. Por isso nenhum perfil local libera Bash.
- Kill switch: `POST /api/pause` impede novas execuções (persistido em disco).

## Permissões do Termux (19/10)
- O Termux tinha DUMP, READ_LOGS, WRITE_SECURE_SETTINGS e PACKAGE_USAGE_STATS concedidas por alguém, sem registro (provavelmente no setup inicial pelo ADB).
- Como os agentes locais rodam no mesmo usuário do Termux, ficou **só a DUMP** (usada pelo painel para `dumpsys thermalservice/deviceidle/power/wifi`). As outras três foram revogadas em 19/10 06:50 (`pm revoke`); serviços e painel conferidos depois.
- Ajustes do Android que voltam ao padrão são reaplicados pelo PC (`tools/server/reaplicar-ajustes.ps1`, ADB), porque o Termux não consegue usar o comando `settings`.
