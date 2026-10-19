# Modelo de segurança

Princípio: nada administrativo fica exposto fora da rede de casa, todo acesso exige chave ou token, e nenhuma rota HTTP executa comando.

| Superfície | Porta | Quem acessa | Proteção |
|---|---|---|---|
| SSH (admin) | 8022 | PC (chave `id_ed25519`) | Só chave; senha desligada; host key conferida pelo cabo USB |
| Painel server-box | 8080 | Navegador / scripts | Token (`~/servidor/painel.token`); cookie HttpOnly SameSite=Strict; limite de tentativas; `/health` público e mínimo |
| AgentOps | 8090 | Admin e workers | Token admin (`agentops.token`) e token de worker (`agentops-workers.json`) separados; worker só busca/devolve tarefa dos seus perfis |
| SFTP (arquivos) | 8023 | Chave própria `a13_arquivos` | rclone confinado em `~/shared`; não segue atalhos; chave de admin recusada |
| ADB | USB | PC autorizado | Depuração sem fio desligada |

## Segredos
| Segredo | Onde | Permissão | Em backup |
|---|---|---|---|
| Token do painel | A13 `~/servidor/painel.token` | 600 | cifrado |
| Tópico ntfy | A13 `~/servidor/alertas.json` | 600 | cifrado |
| Tokens do AgentOps | A13 `~/servidor/agentops.token`, `agentops-workers.json` | 600 | cifrado |
| Token do worker (cópia) | PC `%USERPROFILE%\.servidor-a13\worker.json` | ACL só do usuário | não |
| Chave do backup | PC `%USERPROFILE%\.servidor-a13\backup.key` | ACL só do usuário | **guardar cópia fora do PC** |
| Credenciais do Claude Code | A13 `~/.claude/` (após login) | do Claude Code | não |

Nenhum segredo está no git; logs e saídas de tarefas passam por mascaramento (tokens conhecidos, `sk-ant-…`, `Bearer …`, chaves privadas).

## Agentes
- Tarefa = perfil + texto; não existe campo de comando (pedido com campo extra é recusado com 400).
- Ferramentas por perfil via `--allowedTools` + `--permission-mode dontAsk` (nega tudo que não foi pré-aprovado; o padrão novo do Claude Code, `auto`, aprovaria sozinho). Nunca `--dangerously-skip-permissions` / `--yolo`.
- Saída para a internet do Claude Code no A13 só pelo proxy `egress` (127.0.0.1:8091), que aceita apenas anthropic.com, claude.ai e claude.com. Testado: example.com negado; proxy inacessível pela rede.
- Teste real das regras (19/10): leitura de `~/servidor/agentops-workers.json` negada; nenhum token na saída.
- Regras de negação do Claude Code em cada pasta de perfil: `.env`, `~/.ssh`, credenciais, tokens do servidor, `*.pem`, `*.key`, `curl`, `wget`, `ssh`, `scp`, `rm -rf`, `git push`.
- **Limite honesto:** isso é isolamento lógico (regras do Claude Code), não sandbox de kernel. Sem root não há namespaces/chroot no A13: um agente com Bash liberado teria acesso a tudo do usuário do Termux. Por isso nenhum perfil local libera Bash.
- Kill switch: `POST /api/pause` impede novas execuções (persistido em disco).
