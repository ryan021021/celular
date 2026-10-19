# Master Plan — Home Server OS (Galaxy A13)

Orquestrador: sessão Claude "Organizar estrutura com Gemini Antigravity" (ORQ). Atualizado em 2026-10-19 01:45.
Registro de tarefas: `.collab/TASKS.md` · Decisões: `docs/engineering/DECISIONS.md` · Diário: `docs/LOG.md` · Regras de convivência: `docs/COLABORACAO.md`.

## 1. Equipe real (verificada, não presumida)
| Sigla | Agente | Como participa | Executa comandos | Edita arquivos | Papel |
|---|---|---|---|---|---|
| ORQ | Claude Code (sessão "Organizar…") | esta sessão | sim (PC, SSH, ADB) | sim | Orquestrador, AgentOps, infra/Android, backup, deploy |
| BACK | Claude Code (sessão "A13 server OS enterprise reengineering") | mensagens entre sessões | sim | sim | Backend/API do console, alertas |
| FRONT | Claude Code (sessão "Home VPS control center reengineering") | mensagens entre sessões | sim | sim | Frontend do console |
| QA | Claude Code (sessão "A13 home server architecture reengineering") | mensagens entre sessões | sim | só `docs/qa/`, `tools/qa/` | QA, release, revisão independente |
| GEM-IDE | Gemini no Antigravity IDE | **só pela interface**: lê `.collab/` e `GEMINI.md`; o Ryan repassa pedidos | sim (ADB/SSH pelo IDE) | sim (zona dele) | `profiles/`, `README.md`, `tools/connect`, Tailscale (T9) |
| GEM-CLI | Gemini CLI 0.61.0 no PC (`gemini`, login pessoal) | ORQ aciona por comando | não (usado em modo leitura) | não | Revisor independente de arquitetura e segurança |
| A13-CC | Claude Code 2.1.303 no A13 (assinatura Pro) | AgentOps, perfis `leitura`/`edicao` | só ferramentas do perfil | só `~/agentes/<perfil>` | Executor de tarefas leves |
| PC-CC | Claude Code no PC via `tools/worker` | AgentOps, perfil `pc-claude` | não (só leitura da pasta) | não | Executor remoto (depois do teste da QA) |
| HERMES | Hermes Agent no PC | — | — | — | **Desligado** no worker até haver toolset só de leitura (Q2) |
| RYAN | humano | conversa | — | — | Logins, decisões de rede/roteador, tarefas físicas |

Agentes não conversam entre si por mágica: sessões Claude usam mensagens; o Gemini do IDE só vê arquivos e o que o Ryan colar.

## 2. Arquitetura (o que existe, por responsabilidade)
| Responsabilidade | Implementação real | Dono |
|---|---|---|
| control-plane / dashboard / api | `server-box` + console v1 (`/console`, `/api/v1/*`), porta 8080, token + sessão | BACK, FRONT |
| service-manager | runit (termux-services) + `boot.sh` (Termux:Boot) + `watchdog.sh` (cron 5 min) | ORQ |
| agent-orchestrator / task-queue | AgentOps (`server/agentops`, :8090): fila persistente, perfis, kill switch, workers | ORQ |
| monitoring / alertas | `alerts.mjs` (ntfy): painel, runit, RAM, disco, bateria, temperatura, backup, worker | BACK |
| storage | SFTP confinado (`rclone`, :8023, `~/shared`) | ORQ |
| network | tudo só IPv4; proxy de saída `egress` (127.0.0.1:8091, só Anthropic) | ORQ |
| security | SSH só chave, tokens fora do git, CSRF/ações com cabeçalho, segredos mascarados | todos; revisão QA/GEM-CLI |
| backup | `tools/server/backup.sh` (AES-256, prova de restauração, registro no A13) | ORQ |
| deployment | `git push a13 celular` (hook: testes + rollback), `tools/server/deploy.ps1` | ORQ, BACK |
| tests | server-box (~100 testes), AgentOps (15), worker (5), QA de aceitação | todos; QA consolida |

Escolha deliberada: **um** painel/API em Node, **um** AgentOps e serviços pequenos no runit. Nada de microserviços: o aparelho tem 3,6 GB de RAM.

## 3. Auditoria (achados por severidade)
| # | Achado | Severidade | Evidência | Tarefa |
|---|---|---|---|---|
| A1 | Worker do PC executava Bash e lia fora da pasta (modo auto) | Crítica | canário da QA: `permission_denials=[]` | T15 (corrigido, em teste) |
| A2 | Projeto (raiz) sem controle de versão; 4 agentes editando | Alta | `git rev-parse` falha na raiz | T5 |
| A3 | Hermes sem toolset só de leitura | Alta | `hermes approvals test`: `allow` para ler chaves e `curl` | T22 (desligado) |
| A4 | Locks ignorados (debloat, Tailscale, checkout do painel) | Alta (processo) | `docs/LOG.md`, handoffs | regra reforçada; T19 audita |
| A5 | `connect.ps1` modo Status com `StrictHostKeyChecking=no` | Média | linha 110 | T1 |
| A6 | Backup só manual | Média | nenhum agendamento | T18 |
| A7 | Acesso remoto inexistente (sem Tailscale) | Média | T9 parado no login | T9 (Ryan) |
| A8 | `README.md` com afirmação falsa sobre `max_phantom_processes` | Baixa | README:72 | T17 |
| A9 | `imsservice` crasha 9× por boot | Baixa | logcat | T21 |
| A10 | IPv6 público não testado de fora | Baixa | sem teste em 4G | T13 (Ryan) |

## 4. Fases
A (descoberta) feita · B (fundação) feita · C (dashboard) console v1 em produção · D (AgentOps) em produção, worker em teste · E (rede/hosting) SFTP feito, DNS bloqueado sem root, Tailscale aguardando · F (robustez) backup/reboot/carga testados; falta agendar backup e o teste de reconstrução do zero.

## 5. Fila da madrugada (ORQ, autônomo, com autorização do Ryan de 19/10)
1. T5 — controle de versão do projeto (git local, sem remoto, `.gitignore` sem segredos/binários).
2. T18 — backup semanal agendado no Windows + verificação.
3. T19 — revisão independente pelo Gemini CLI (só leitura) → `docs/qa/gemini-review-2026-10-19.md`; achados viram tarefas.
4. Integrar resultados da QA (T15 canário, T20 suíte) e revisões de BACK/FRONT.
5. Monitorar o A13 a cada ciclo (serviços, alertas, temperatura) e registrar no LOG.
6. T24/T26 — avaliar atualização segura do Claude Code no A13 e hospedagem de páginas estáticas.

Limites que valem mesmo com autorização ampla: nada de logins/contas, gastos, abrir portas no roteador, expor serviços à internet, apagar dados do Ryan, debloat em massa, desligar proteções térmicas ou mexer no próprio modo de permissão.

## 6. Critério de DONE
Implementação existe + testes relevantes executados (dizendo onde: PC, A13, simulado) + revisão de outro agente + docs atualizadas + sem regressão conhecida + evidência citada no registro.
