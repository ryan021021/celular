# Registro de tarefas

Plano: `docs/engineering/MASTER_PLAN.md`. Estados: BACKLOG · READY · IN_PROGRESS · BLOCKED · REVIEW · TESTING · DONE.
Agentes: ORQ (Claude "Organizar", orquestrador) · BACK (Claude "A13 server OS") · FRONT (Claude "Home VPS") · QA (Claude "A13 home server architecture") · GEM-IDE (Gemini no Antigravity, só via arquivos/Ryan) · GEM-CLI (Gemini CLI, acionado pelo ORQ) · RYAN.
Regras: um dono por tarefa; só edite os arquivos autorizados; nada no A13 sem `.collab/locks/a13-servidor.lock`; mude o estado da SUA tarefa e acrescente evidência; tarefas com ficha seguem `.collab/fichas/`.

| ID | Objetivo | Agente | Depende | Arquivos autorizados | Estado | Testes exigidos | Evidência | Pendências |
|---|---|---|---|---|---|---|---|---|
| T1 | `connect.ps1` único lendo perfis | GEM-IDE | — | `tools/connect/**` | DONE | SSH/Mirror/Status contra o A13 | 0 ocorrências de `StrictHostKeyChecking=no` | — |
| T2 | Detectar ADB em `tools/common.ps1` | claude (sessão não registrada) | — | `tools/common.ps1` | DONE | rodar `Find-Adb` com e sem PATH | testado via powershell: detectou SDK em AppData e serial RQ8TC00EJNB | revisor: GEM-IDE |
| T3 | `tools/optimize` genérico | claude (sessão não registrada) | — | `tools/optimize/**` | DONE | dry-run com pacote parâmetro | testado contra A13: recusou com erro de proteção online_server sem -Forcar | revisor: GEM-IDE |
| T4 | Testar conexão com o A13 | GEM-IDE | — | — | DONE | — | LOG 18/10 | — |
| T5 | Controle de versão do projeto (git local) | ORQ | — | `.gitignore`, `.git/` (raiz) | REVIEW | `git status` limpo; nenhum segredo/binário rastreado | `72b1c06`: 99 arquivos, maior 24 KB, varredura de segredos = 0; assets/backups/painel/dumps fora | revisor: QA. **Todos: depois de mudar arquivos, `git add` + commit com seu nome de agente** |
| T6 | Servidor 24/7 no A13 | GEM-IDE + ORQ | — | `server/**` | DONE | reboot | LOG 18/10 | — |
| T7 | Volta sozinho após reboot/queda | ORQ | T6 | — | DONE | reboot real | 01:28: 7 serviços em 98 s | — |
| T8 | A21s / Oppo A78 como servidores | GEM-IDE | físico | `profiles/**` | BLOCKED | ficha T8 | — | A21s sem ADB; Oppo sem tela |
| T9 | Tailscale no A13 | GEM-IDE | login do Ryan | `profiles/a13.json`, docs | BLOCKED | painel/SSH pelo 100.x | APK instalado, tela de login aberta | **Ryan: login na conta Tailscale** |
| T10 | Console v1: API `/api/v1` + alertas por runit | BACK | — | `server/panel/server-box` (branch próprio) | DONE | hook | `4754864`, 72/72 | — |
| T11 | Console v1: páginas | FRONT | T10 | `public/console.*` | DONE | hook | `29d9ae6`, 87/87 | — |
| T12 | Serviços só em IPv4 | ORQ | — | `server/termux/**`, `server.js` | DONE | scan IPv6 global | 8022/8023/8080/8090/8091 fechadas | — |
| T13 | Testar IPv6 de fora (4G) | RYAN | — | — | BLOCKED | abrir `/health` pelo IPv6 no 4G | — | ação humana |
| T14 | Alertas de backup atrasado e worker offline | BACK | — | `alerts.mjs`, testes | DONE | hook + ntfy falso | `c64a7f4`, 93/93 | — |
| T15 | Worker do PC seguro (Q1/Q2) | ORQ | — | `tools/worker/**` | TESTING | canário real da QA (Bash e leitura fora da pasta negados; pc-hermes desligado) | 5/5 testes de argumentos; `--once` ok | aguardando `tools/qa/worker-canario.mjs` |
| T16 | Sessão do painel (30 dias, revoke-all) + `/live` | BACK | T10 | `panel-auth.mjs`, `console-api.mjs`, `live.mjs`, `server.js`, testes | REVIEW | 101 testes; revoke com stream aberto | `7da0e43` (auth aprovado pelo ORQ), `f4dfde3` | revisão do `/live` pela FRONT; deploy com lock; Ryan entra de novo 1 vez |
| T17 | `README.md` sem afirmação falsa (`max_phantom`) | GEM-IDE | — | `README.md` | DONE | conferir com `settings get` | `settings_enable_monitor_phantom_procs` é `false` (confirmado via ADB); `README.md` corrigido | — |
| T18 | Backup semanal agendado | ORQ | — | `tools/server/**`, Agendador do Windows | REVIEW | rodar a tarefa agendada uma vez; registro no A13 atualizado | tarefa "Servidor A13 - backup semanal" (domingo 10:00, roda ao ligar se perdeu); disparo de teste: 206 arquivos, restauração ok, `backup-ultimo.json` atualizado | revisor: QA |
| T19 | Revisão independente de arquitetura e segurança (só leitura) | GEM-IDE | — | `docs/engineering/reviews/gemini-review-*.md` | READY | achados citam arquivo:linha com trecho | Gemini CLI tentado: `IneligibleTierError` (Google encerrou o CLI no plano individual) | instruções em `.collab/handoff/2026-10-19_claude-para-gemini_revisao-independente.md`; **Ryan: pedir ao Gemini no Antigravity para ler esse handoff** |
| T20 | Suíte de regressão + reconstrução do zero + checagem de afirmações | QA | — | `docs/qa/**`, `tools/qa/**` | READY | rodar no PC e no A13; restaurar backup em diretório temporário | — | — |
| T21 | `imsservice` crasha no boot | GEM-IDE | — | debloat (ADB) | BACKLOG | logcat após boot | 9 crashes/boot | decidir reativar epdg/sve ou manter |
| T22 | Hermes seguro como worker | ORQ | ferramenta | `tools/worker/**` | BLOCKED | canário | `hermes approvals test` permite ler chaves | sem toolset só de leitura confinado |
| T24 | Atualização segura do Claude Code no A13 | ORQ | — | `server/termux/**`, docs | BACKLOG | versão nova roda + rollback | — | hoje manual |
| T25 | SFTP também pelo Tailscale | ORQ | T9 | `server/termux/sv/sftp` | BLOCKED | sftp pelo 100.x | — | depende do T9 |
| T26 | Hospedagem de páginas estáticas no A13 | ORQ | — | a definir | BACKLOG | página servida só na LAN/Tailscale | — | avaliar antes de criar serviço |
