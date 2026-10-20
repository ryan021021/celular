# Auditoria de qualidade dos testes — 2026-10-20

Sessão: CHEFE (auditoria somente leitura, pedida pelo Ryan: "melhorar workflow, agentes e testes"; esta é a parte de testes).
Base: `afb07ec` (`main`). Nada do projeto foi editado nem rodado no A15/A13. Não repete `docs/qa/ACHADOS.md` nem `docs/qa/test-matrix.md`.

## Resumo

- **Regressão VERDE**: `node tools/qa/regressao.mjs` em 182 s; 230 testes nas 12 pastas, 229 passam, 1 pulado, 0 falham, nenhum instável em 2 rodadas.
- **Verde não quer dizer protegido.** Apliquei 22 mutações (quebras deliberadas do código) numa cópia no scratchpad: **21 sobreviveram**, isto é, o teste continuou verde com o código quebrado. Só a retenção do backup (M7a) foi pega.
- 6 achados de gravidade **alta** (rede de segurança sem prova), 11 **média**, 10 **baixa**.
- O pior padrão: testes que **reproduzem o comportamento por conta própria** (o `post-receive.test.mjs` faz o `git reset` ele mesmo) ou que **conferem o texto do script** em vez de executá-lo. Dois docs de auditoria usam esse teste como evidência de "funcionando" (ver Observações).
- A regressão aceita teste **pulado** como verde (`regressao.mjs:67`), então a prova de backup pode sumir sem aviso.

## Método e limites

1. `verificador` rodou a regressão e cada pasta com arquivos explícitos (o `node --test <pasta>` falha neste Node), duas vezes nas pastas lentas.
2. Três `cacador-falhas` leram teste + código testado, em fatias: (a) `tools/server`, `tools/worker`, `tools/qa`; (b) `server/agentops`, `server/discovery`, `server/routines`, `.claude/hooks`; (c) `server/termux`, `tools/diag`, `tools/install`, `tools/lib`.
3. Eu conferi **cada** `arquivo:linha` com `grep`/`sed` no commit `afb07ec`. Os números que os subagentes deram estavam errados em vários arquivos (ex.: `post-receive.test.mjs` tem 44 linhas e foi citado `:150-178`); os que aparecem aqui são os verificados. Um achado deles foi **descartado** porque a mutação mostrou o contrário (retenção do backup, M7a).
4. Mutação: `testes-auditoria-mutar.mjs` (na pasta de notas da sessão, fora do repo) copia `server/`, `tools/`, `profiles/`, `.claude/hooks/` e `.collab/` para o scratchpad, altera um trecho, roda os testes daquele arquivo e restaura. O projeto ficou intacto (`git status`: só o handoff que já não era rastreado). A tabela abaixo permite refazer à mão.
5. Limite: mutações são amostra dos pontos citados, não uma varredura completa. Não rodei `ecc:silent-failure-hunter`: a cobertura dos três caçadores bastou.

## Suítes (rodadas com arquivos explícitos)

| Suíte | testes | pass | skip | s |
|---|---|---|---|---|
| `.claude/hooks` | 8 | 8 | 0 | 10 |
| `server/agentops/test` | 39 | 38 | 1 | 3 |
| `server/discovery/test` | 21 | 21 | 0 | 1 |
| `server/routines/test` | 11 | 11 | 0 | 0 |
| `server/termux/test` | 30 | 30 | 0 | 54 |
| `tools/diag/test` | 30 | 30 | 0 | 2 |
| `tools/install/test` | 21 | 21 | 0 | 1 |
| `tools/lib/test` | 27 | 27 | 0 | 1 |
| `tools/qa/test` | 15 | 15 | 0 | 1 |
| `tools/server` (`adb-coletor.test.mjs`) | 3 | 3 | 0 | 0 |
| `tools/server/test` | 16 | 16 | 0 | 41 |
| `tools/worker/test` | 9 | 9 | 0 | 1 |

O único `skip` é `agentops.test.mjs:231` (saída acima de 256 KB), desligado no Windows. Lento: três testes do `setup.test.mjs` levam 11–19 s e `backup.test.mjs` (chave errada) 10 s.

## Prova por mutação (cópia no scratchpad)

"Verde" = o arquivo de teste continuou passando com o código quebrado.

| # | Quebra aplicada | Arquivo | Teste | Resultado |
|---|---|---|---|---|
| M1 | timeout da rotina vira ~24 dias | `server/routines/scheduler.mjs:90` | `routines.test.mjs` | verde (11/11) |
| M2 | túnel sem `upstream.pipe(client); client.pipe(upstream)` | `server/termux/egress-proxy.mjs:45` | `egress-proxy.test.mjs` | verde (5/5) |
| M3a | some a regra de apagar dados (wipe/factory) | `.claude/hooks/adb-guard.mjs:26` | `adb-guard.test.mjs` | verde (4/4) |
| M3b | some `hide\|suspend` do `pm` | `adb-guard.mjs:22` | idem | verde |
| M3c | `rm -rf` só em `/sdcard` (some `/storage`, `/data`) | `adb-guard.mjs:30` | idem | verde |
| M4a | `DENY_RULES` sem `Bash(curl:*)` | `server/agentops/adapters.mjs:20` | `agentops.test.mjs` | verde (17+1 skip) |
| M4b | `DENY_RULES` sem `Read(~/servidor/**)` | `adapters.mjs:17` | idem | verde |
| M5 | campo `error` sem `redact` | `server/agentops/core.mjs:188` | idem | verde |
| M5b | `claim` ignora o kill switch | `core.mjs:234` | idem | verde |
| M6 | rollback do deploy não faz o `reset` | `server/termux/git-hooks/post-receive:29` | `post-receive.test.mjs` | verde (2/2) |
| M7a | retenção do backup `MANTER=0` | `tools/server/backup.sh:11` | `backup.test.mjs` | **morto** (3 falhas) |
| M7b | `tar` do backup sem `var/service/egress` | `backup.sh:57` | idem | verde (7/7) |
| M8 | sem filtro de leitura 0 e de faixa no termal | `tools/server/adb-coletor.mjs:83` | `adb-coletor.test.mjs` | verde (3/3) |
| M9 | watchdog nunca religa o sshd | `server/termux/watchdog.sh:9` | `watchdog.test.mjs` | verde (2/2) |
| M10a | `setup.sh` sem `sshd -t && sv restart sshd` | `server/termux/setup.sh:46` | `setup.test.mjs` | verde (6/6) |
| M10b | `setup.sh` sem `chmod +x` do `run` | `setup.sh:36` | idem | verde |
| M11 | aviso pendente nunca limpo após o reenvio | `server/termux/netguard.mjs:156` | `netguard.test.mjs` | verde (10/10) |
| M12 | `start-services.sh` confere URL errada no `/health` | `server/termux/start-services.sh:9` | `boot.test.mjs` | verde (5/5) |
| M13 | script de capacidades deixa "HTTP 200" no JSON | `tools/diag/capacidades.mjs:15` | `capacidades.test.mjs` | verde (9/9) |
| M14 | lock "abandonado" só após 1200 min | `.claude/hooks/estado-equipe.mjs:39` | `estado-equipe.test.mjs` | verde (4/4) |
| M15 | `conferir-perfil` sempre ok na RAM | `server/discovery/detect.mjs:168` | `detect.test.mjs` | verde (21/21) |
| M16 | worker sem `deny` de `**/.env` e `**/.env.*` | `tools/worker/worker.mjs:36` | `worker.test.mjs` | verde (9/9) |

## Achados

Gravidade: **alta** = a rede de segurança (deploy/rollback, backup, isolamento do agente, trava de ADB, regressão) pode quebrar ou já está sem prova e a regressão fica verde; **média** = ramo de falha sem teste, efeito contido ou recurso ainda não ligado; **baixa** = fragilidade ou higiene.

### ALTA

**A1 · O hook de deploy/rollback nunca é executado pelo teste.**
- Onde: `server/termux/test/post-receive.test.mjs:10-14` (regex no texto do hook) e `:16-44` (o próprio teste cria um repositório e roda `git reset --hard`; não chama o hook). Hook real: `server/termux/git-hooks/post-receive:29,42-46,49-53`.
- Passa quebrado: M6 troca o `reset` do rollback (`:29`) por `true`; 2/2 verdes. Também: apagar `volta`/`reinicia`, ou inverter o teste de saúde. Além disso `:29` não confere o `reset`: se falhar, o log ainda diz "ROLLBACK ok".
- Correção: rodar o hook com `git`, `sv`, `curl` e `node` falsos em repo temporário (deploy ok, testes falham, /health falha, `reset` do rollback falha).

**A2 · A regressão aceita teste pulado como verde; a prova de backup pode sumir sem aviso.**
- Onde: `tools/qa/regressao.mjs:67` (`ok = ... && s.testes > 0`; os pulados só entram no texto da linha 68). `SEM_FERRAMENTAS` em `tools/server/test/backup.test.mjs:17` (7 de 7 testes têm `skip`) e `sync-discovery.test.mjs:19` (3 testes).
- Passa quebrado: num PC sem `openssl`, `tar` ou `sha256sum` no Git Bash, os 10 testes viram skip, `fail 0`, etapa `ok`, regressão VERDE, e o backup/restauração (R1 da matriz) nunca rodou. Hoje roda (0 skip aqui); é por leitura, não reproduzi sem o `openssl`.
- Correção: nas suítes críticas, falhar se `pulados > 0` (ou `passou === 0` por arquivo); o skip vira falha com `--estrito`.

**A3 · `backup.sh` deixa arquivo parcial e a retenção pode apagar backups bons; o teste usa um `ssh` falso que ignora o comando remoto.**
- Onde: `tools/server/backup.sh:58` (`openssl ... -out` cria o `.tar.gz.enc` antes do fim; com `set -euo pipefail` (`:6`) um `ssh`/`tar` que falha aborta e o parcial fica, sem `.sha256`) e `:88` (a retenção conta o parcial entre os 7 mais novos). Teste: `backup.test.mjs:68-76` (o `ssh` falso só tem caminho feliz; `:74` empacota `servidor .termux .ssh etc var` sem olhar o `tar` pedido).
- Passa quebrado: M7b tira `var/service/egress` do `tar` real (`backup.sh:57`) e 7/7 continuam verdes. Para o parcial: aparelho fora da rede num domingo; no backup seguinte o parcial entra no top 7 e empurra um backup bom para fora. Nenhum teste faz o `ssh` falhar. (Por leitura; não reproduzi.)
- Correção: gravar em `$NOME.tmp` e só `mv` depois do `sha256 ok`; o `ssh` falso extrair os caminhos do `tar -czf` pedido e falhar com `exit 255` em um caso.

**A4 · O isolamento do agente (`DENY_RULES`, `claude-local`, `deny` do worker) não tem teste que o prove.**
- Onde: `server/agentops/adapters.mjs:16-21` (`DENY_RULES`: nenhum teste em `server/agentops/test/` cita `DENY_RULES` nem `prepareWorkdir`); `agentops.test.mjs:199-212` só confere as flags de `claudeArgs`; `claudeLocal.run` só tem o teste `:231`, pulado no Windows. Worker: `tools/worker/worker.mjs:36` (`**/.env`, `**/*.key`, `**/*.token`...), e `worker.test.mjs:39` é circular (`for (t of DISALLOWED)` usa a mesma constante do código); `:35` só confere 7 regras.
- Passa quebrado: M4a, M4b e M16 (apagar `Bash(curl:*)`, `Read(~/servidor/**)` ou `**/.env`) mantêm tudo verde. É a regra que protege tokens e `.env` do agente (Q1/Q3/Q7 da QA foram corrigidos, mas sem teste que impeça a volta).
- Correção: testar `prepareWorkdir`/`prepareDir` com HOME temporário e `deepEqual` das regras críticas, listadas literalmente no teste.

**A5 · A trava de ADB destrutivo tem regras que ninguém testa.**
- Onde: `.claude/hooks/adb-guard.mjs:22` (`pm ... hide|suspend`), `:26` (`wipe|factory`), `:30` (`rm -rf /storage|/data`). `adb-guard.test.mjs:15-19` lista só 12 casos bloqueados.
- Passa quebrado: M3a, M3b, M3c, 4/4 verdes. O teste executa o hook como processo e confere o código de saída (isso está certo), mas só cobre parte da tabela `perigos`.
- Correção: um caso por entrada de `perigos` (e por script de `scripts`), na lista do teste "bloqueia destrutivos".

**A6 · Kill switch e `redact` do AgentOps sem prova nos caminhos que importam.**
- Onde: `server/agentops/core.mjs:234` (`claim` com `paused` devolve `null`) e `:188` (`redact(res.error)`; também `:249`). `agentops.test.mjs:98-105` só pausa e confere a tarefa local; `:121` só confere `output`.
- Passa quebrado: M5b (worker do PC continua puxando tarefa com a pausa ligada) e M5 (segredo no campo `error` aparece em `GET /api/tasks`), ambos verdes. No scheduler, `pause()` (`scheduler.mjs:30,150`) também não tem teste.
- Correção: pausar e fazer `claim` esperando `task:null`; adapter que falha com o token no `error` e conferir em `/api/tasks/:id`.

### MÉDIA

**B1 · Túnel do `egress-proxy` nunca move byte.** `server/termux/test/egress-proxy.test.mjs:47` (`pipe`/`write` falsos) e `:69` (`assert.ok(true)`). Quebrar `egress-proxy.mjs:45` (M2), o timeout de 300 s (`:48`) ou o `close` no erro do cliente (`:58`) mantém 5/5. Correção: upstream de eco com `net.createServer` e conferir os bytes de ida e volta.

**B2 · `server/routines`: timeout e pausa sem prova.** `routines.test.mjs:242-256` só roda uma action rápida e vê que durou < 1 s; `scheduler.mjs:87-90` (M1 verde). `catalog.mjs:88` (disco em aviso), `:146` (`LOW_BATTERY`), `:179,207` (estados do backup) sem teste. Nota: `createScheduler` não é usado fora do teste (`scheduler.mjs:4`), então não afeta produção hoje; vira alta quando for ligado. Correção: action que nunca resolve com `timeoutMs: 50`; um caso por ramo do `catalog`.

**B3 · Discovery: ramos de falha e snapshot.** `detect.mjs:253-258` (`coletarSsh` aceita `ok:true` com saída vazia e gera relatório todo UNKNOWN; `detect.test.mjs:180-183` só testa `ok:false`), `:261-266` e `:325-329` (leitura transitória falha → "primeiro snapshot" e grava por cima do bom; sem teste), `:155-170` (`compararPerfil` só no caminho feliz; M15 verde, o exit 2 do `--conferir-perfil` nunca ocorre). Correção: `{ok:true, saida:''}` com `rejects` e mensagem; executor injetado falhando na leitura; arquitetura e RAM fora do perfil.

**B4 · Scripts do Termux: ramos silenciosos.**
- `watchdog.test.mjs:20` (`pgrep` sempre 0) esconde `watchdog.sh:9-12` (M9 verde); rotação de log (`:26-29`) sem teste.
- `setup.test.mjs:34-45`: o `chamadas.log` é gravado e nunca lido; o `sshd` falso devolve 0 sempre. M10a/M10b verdes; `setup.sh:46` (`sshd -t && ...`) deixa config inválida sem aviso.
- `netguard.test.mjs:105-118` não cobre o reenvio do aviso pendente (`netguard.mjs:150-158`; M11 verde; nenhum teste cita "atrasado"); `:141` engole falha do aviso local.
- `boot.test.mjs:43`: o `curl` falso ignora a URL (M12 verde); `start-services.sh:11,16` diz "reiniciado" mesmo se `sv restart` falhar.
- Correção: cada fake grava seu `argv`, o teste confere; casos com `pgrep` exit 1, `sshd -t` falho, ntfy fora e depois dentro.

**B5 · `deploy.ps1` e `versao.mjs` declaram sucesso sem conferir.** `tools/server/deploy.ps1:79` termina em `| tail -n 8`: o código de saída é do `tail`, então teste do painel falhando no celular ainda imprime `[PRONTO]`. `tools/server/versao.mjs:232-248`: o `git()` devolve só o stdout (`:95-101`), e a saída do hook remoto vem no stderr, então `res.saida` fica vazia e o `[SUCESSO]` (`:314-316`) não confere que o remoto andou. `versao.test.mjs` não olha `saida`. Correção: `set -o pipefail`/arquivo de saída no remoto; capturar o stderr e comparar `ls-remote` com `fullHash`.

**B6 · `worker.mjs`: respostas do servidor não são conferidas.** `worker.mjs:167-168` só loga `entregue (${r.status})` (um 401/500 perde o resultado), `:154` não confere o status do `claim`, `:131` engole falha do heartbeat, `:165` (`Math.max(60_000, NaN)` se `timeoutMs` vier ausente dispara o `setTimeout` na hora). `cycle`/`run` não são exportados nem testados. Correção: lançar se `status !== 200`; `Number(task.timeoutMs) || 300_000`; testar com `fetch` e `spawn` falsos.

**B7 · Portões de commit que abrem sozinhos.** `tools/qa/escopo.mjs:80-81` (`TASKS.md` ilegível vira `''`: `--review` diz "nenhuma tarefa" e sai 0), `:136` (qualquer exceção imprime "commit liberado" e sai 0); `escopo.test.mjs:23-34` testa só 2 achados de `PERIGOS` (`:13`). `.claude/hooks/estado-equipe.mjs:8` (`ler` devolve `''`) e `:39` (lock abandonado: M14 verde), `:51` catch sem teste. Correção: tabela de um caso por `PERIGOS`; teste com `TASKS.md` ausente; `fail-open` só por flag.

**B8 · Varredura de alegações (P0 R5) não vê títulos nem itens com `*`.** `tools/qa/alegacoes.mjs:57` pula linhas que começam com `#` ou `*`. Provado: `checarConteudo("docs/x.md", ...)` devolve 1 achado para a frase solta e **0** para um título `##` e para um item `* ...` com a mesma frase. `:62` aceita qualquer par de crases como evidência (uma linha com o rótulo `VERIFIED` e crases passa). Os testes (`tools/qa/test/alegacoes.test.mjs`) só usam frases soltas. Correção: pular `#`/`*` só em arquivo de código; exigir crase com comando/arquivo.

**B9 · `tools/diag/capacidades.mjs` não está ligado e seu teste não pega o vazamento que promete.** Só o teste importa o módulo (`diag.mjs:140-145` ainda lê `/capabilities` sem token, "T75"). `capacidades.test.mjs:15-25` é regex no texto do script e `sh -n`; `:19` ("não vaza token") é tautologia, pois o script nunca recebe `TOKEN_FALSO`. M13 (`sed '$d'` → `cat`, que deixa "HTTP 200" no JSON) fica verde. Correção: ao ligar (T75), rodar o script com `curl`/`cat` falsos e token sentinela e conferir stdout e argv.

**B10 · I/O externo só testado com falsos.** `tools/diag/diag.mjs:168-181` (`executarSsh`; troque `code === 0` por `true` em `:180` e nada falha; o stderr se perde) e `tools/install/preflight.mjs:149-159` (`executar`): timeout, ENOENT, saída ≠ 0 e truncamento nunca são exercitados. Correção: executável falso (`node -e`) que dorme, sai 255 ou não existe.

**B11 · Scripts "corrigidos" sem nenhum teste.** `tools/server/backup-agendado.sh` (R4/R5 do ACHADOS estão CORRIGIDO), `server/termux/claude-update.sh` (R6) e `tools/server/reaplicar-ajustes.ps1` não são citados por teste algum; `reaplicar-ajustes.ps1:31-36` sai 0 com `-SoConferir` mesmo com valores diferentes. O próprio `tools/qa/regressao.mjs` não tem teste (`:134` e `:149` têm `catch` que pula sem aviso). Correção: teste de saída por `exit` com `pwsh`/`bash` falsos; `exit 1` quando `$diferentes > 0` em `-SoConferir`.

### BAIXA

1. `adb-coletor.mjs:83-84` + `adb-coletor.test.mjs:26-29`: o 0,0 (SUBBAT) vem depois do 27,2 (BAT) no mesmo tipo, então o `Math.max` esconde a falta do filtro `v === 0`; nenhum valor fora de −30..130 (M8). Fixture com dois `BAT` e um 200,0.
2. `adb-coletor.mjs:198`: no modo de envio `_erros` é descartado; cabo solto = laço mudo.
3. `adb-guard.test.mjs:33`: só testa `# OK-RYAN:` no fim; `adb-guard.mjs:9` libera o comando inteiro se o marcador aparecer dentro de uma string anterior.
4. `agentops.test.mjs:23,139`: prazo de 100 ms contra espera de 150 ms (margem de 50 ms), instável em PC carregado; usar relógio injetado (`now`).
5. `detect.test.mjs:60,77`: `notEqual(...)` e `assert.rejects` sem validador aceitam qualquer valor/erro.
6. `tools/lib/test/ligacoes.test.mjs:14-24`: confere a palavra (`achar-aparelho`, `Resolve-AparelhoIp`), não a chamada; um `import` ou comentário basta.
7. `tools/lib/test/achar-aparelho.test.mjs:208-221`: o título diz "sobrevive a arquivo quebrado", mas nenhum arquivo é corrompido (`:219` é só comentário).
8. `tools/install/test/preflight.test.mjs`: sem limites exatos (SDK 24/28, Node 20) e sem rodar `SCRIPT_EXTRA` (`preflight.mjs:30`).
9. `tools/server/sync-discovery.sh:15-16`: `scp` sem `BatchMode` nem `ConnectTimeout`; `sync-discovery.test.mjs:81-84` confere o `deploy.ps1` com `indexOf` (uma linha comentada ainda passa).
10. Higiene dos testes: `spawnSync` sem `timeout` em `adb-guard.test.mjs`, `estado-equipe.test.mjs:18`, `watchdog.test.mjs:21`, `setup.test.mjs`; `PATH` montado com `:` em `boot.test.mjs:46` e `watchdog.test.mjs:22`; `watchdog.test.mjs:21` usa `process.cwd()` e só roda da raiz; `perfis.test.mjs:15` exige `>= 4` perfis (liga o teste ao conteúdo do repo); `server/agentops/redact.mjs:14-16` (`github_pat_`, `AKIA`, `xox*`) sem teste (`redact.test.mjs` tem 0 citações).

## Sem achado / bem coberto

- `server/agentops/test/migracao.test.mjs` (v0, idempotência, corrompido, versão futura, backup byte a byte) e `redact.test.mjs` (formatos principais, falso positivo): fortes. Falta só o ramo "backup não pôde ser gravado" (`core.mjs:91`).
- `tools/qa/test/regras.test.mjs`; `tools/lib/test/achar-aparelho.test.mjs` (lógica de achar/conferir/aparelho estranho); parte pura do `netguard` (`classificar`, `decidir`, anti-flood); `parseTop`/`processName` do coletor; ciclo com remoto falso do `versao.test.mjs`.
- Os testes dos hooks executam o hook como processo e conferem o código de saída (bloqueio de verdade).
- A retenção do backup está coberta no caminho feliz (M7a morreu).

## Observações de processo

- **Dois docs de auditoria usam o teste fraco do `post-receive` como prova.** `docs/audit/current-state.md:20` marca o deploy por `post-receive` como `VERIFIED_WORKING` citando `post-receive.test.mjs (2/2)`, e `docs/audit/test-baseline.md:18` diz que o teste "valida o comportamento em repositório temporário real". O teste valida o `git reset` do próprio teste, não o hook (A1). O `VERIFIED_WORKING` passou na varredura de alegações porque `:62` do `alegacoes.mjs` aceita qualquer crase (B8). Sugestão: rebaixar para `PARTIAL` até a tarefa 2.
- **O handoff `2026-10-20_chefe-para-qa_hooks-na-regressao.md` parte de uma premissa já falsa:** `regressao.mjs:97-100` roda todo `*.test.mjs` rastreado pelo git, por pasta, então `.claude/hooks` (8 testes) já está na regressão. Basta a QA marcar o handoff como resolvido; o que falta de verdade é A2 (pulado conta como verde).
- `docs/qa/test-matrix.md` (R1) ainda diz que `backup.sh` não tem teste automático; já existe `backup.test.mjs` (7 testes). Atualizar a matriz.
- Convenção que ajudaria a QA: todo teste de script `.sh` registra o `argv` dos falsos e confere; todo `skip` imprime o motivo (o `skip` de `agentops.test.mjs:231` não traz motivo).

## Tarefas sugeridas para o TASKS.md (máx. 5)

Os "mutantes" são os da tabela acima; a tarefa só fecha quando o mutante indicado morre (teste vermelho com a quebra aplicada, verde sem ela).

1. **Regressão estrita e portões que abrem sozinhos** — dono: QA.
   Arquivos: `tools/qa/regressao.mjs`, `tools/qa/escopo.mjs`, `tools/qa/alegacoes.mjs`, `tools/qa/test/*.test.mjs` (novo `regressao.test.mjs`).
   Teste exigido: suíte com `pulados > 0` nas suítes críticas falha (A2); `TASKS.md` ausente e exceção no `escopo` não liberam commit (B7); título `##` e item `*` com a frase de superlativo acusam (B8); um caso por entrada de `PERIGOS`. Fecha também o handoff da QA sobre hooks.
2. **Deploy e backup executados de verdade** — dono: ORQ.
   Arquivos: `server/termux/git-hooks/post-receive`, `server/termux/test/post-receive.test.mjs`, `tools/server/backup.sh`, `tools/server/test/backup.test.mjs`, `tools/server/deploy.ps1`.
   Teste exigido: hook rodado com `git`/`sv`/`curl`/`node` falsos (deploy ok, testes falham, /health falha, `reset` falha) — mata M6; `ssh` falso que lê o `tar` pedido e falha com 255 — mata M7b; parcial não entra na retenção (A1, A3, B5).
3. **Isolamento do agente e worker** — dono: ORQ.
   Arquivos: `server/agentops/test/agentops.test.mjs`, `server/agentops/adapters.mjs`, `tools/worker/worker.mjs`, `tools/worker/test/worker.test.mjs`.
   Teste exigido: regras de `prepareWorkdir`/`prepareDir` com lista literal — mata M4a, M4b, M16; `claim` pausado e `error` com token — mata M5b e M5; `/result` e `claim` com status ruim (A4, A6, B6).
4. **Hooks de ADB e estado da equipe** — dono: CHEFE.
   Arquivos: `.claude/hooks/adb-guard.test.mjs`, `.claude/hooks/estado-equipe.test.mjs` (e os hooks, só se o teste achar defeito).
   Teste exigido: um caso por entrada de `perigos` e de `scripts` — mata M3a/b/c; lock antigo (`utimes`), `TASKS.md` ausente e handoff `RESOLVIDO` — mata M14; `timeout` nos `spawnSync` (A5, B7).
5. **Ramos silenciosos do servidor** — dono: ORQ (ou BACK se ORQ estiver cheio).
   Arquivos: `server/termux/test/{egress-proxy,watchdog,setup,netguard,boot}.test.mjs`, `server/routines/test/routines.test.mjs`, `server/discovery/test/detect.test.mjs`.
   Teste exigido: túnel com eco real — mata M2; `pgrep` exit 1 — mata M9; `chamadas.log` lido e `sshd -t` falho — mata M10a/b; reenvio do pendente — mata M11; URL do `curl` conferida — mata M12; action que nunca resolve — mata M1; `compararPerfil` fora do perfil — mata M15 (B1–B4).
