# Protocolo da dupla: Claude + Gemini

Objetivo: dois agentes no mesmo projeto sem sobrescrever o trabalho um do outro.
Funciona com git ou com outra ferramenta de versão (ver "Versionamento").

## 1. Zonas (cada arquivo tem um dono)
| Zona | Dono | O outro pode… |
|---|---|---|
| `tools/connect`, `tools/rescue`, `tools/debug`, `profiles/` | **Gemini** | pedir mudança via handoff |
| `tools/optimize`, `tools/server`, `server/`, `docs/`, `.collab/TASKS.md` (estrutura), `.collab/fichas/` | **Claude** | pedir mudança via handoff; **executar** é liberado |
| `server/panel/server-box/` (repo git) | **os dois**, cada um no seu branch `claude/*` / `gemini/*` | merge em `celular` só depois da revisão do outro (ver `server/panel/UPSTREAM.md`) |
| `assets/` | quem gerar o arquivo | só adicionar, nunca sobrescrever |
| `GEMINI.md`, `CLAUDE.md`, `AGENTS.md` | cada um edita só o seu | — |
| `.claude/` (agentes, skills, hooks, settings), `.agents/` (regras do Antigravity) | **CHEFE** (a ORQ executa os hooks) | as vagas do Gemini **não** editam `.agents/`: pedem por handoff |
| `tools/qa/` (regressão, escopo, validadores) | **QA** | o CHEFE mexe só com tarefa própria e avisa a QA |

Regra: **só edite arquivos da sua zona.** Fora dela, use um handoff.

## 1b. Regras novas (19/10, orquestrador)
- **Orquestração (atualizado 19/10, D14):** a sessão Claude "Otimizar consumo de tokens" é o **CHEFE** do projeto: define prioridades, distribui tarefas e dá a aprovação final. A sessão "Organizar…" (ORQ) segue como executora de infra/AgentOps. Dúvida de prioridade ou conflito entre sessões → handoff `*-para-chefe_*` ou mensagem ao CHEFE. Tarefas só pelo `.collab/TASKS.md`.
- **Worktrees do painel:** cada `server/panel/server-box-*` pertence à sessão que a criou. Ninguém escreve na worktree de outro; para propor mudança, mande diff ou abra tarefa.
- **Git na raiz:** o projeto tem git local. Depois de mudar arquivos, faça `git add` dos SEUS arquivos e commit com o nome do agente (`git -c user.name="<agente>" commit`). Nunca `git reset --hard`, `git checkout -- .` ou `git stash` sem tag na raiz: você apagaria o trabalho dos outros.
- **Credenciais novas** (chaves SSH, logins, tokens) só com OK explícito do Ryan, mesmo com a autorização ampla de automação.

## 2. Locks (para áreas compartilhadas)
Antes de mexer em algo fora do óbvio, crie `.collab/locks/<nome>.lock` com:
`agente | data/hora | o que vai mexer`. Se o lock existe, **espere ou escolha outra tarefa**.
Apague o seu lock ao terminar. Lock com mais de 2 h é considerado abandonado (avise o usuário).

## 3. Quadro de tarefas
`.collab/TASKS.md` é a fila. Cada agente pega a tarefa da sua sigla com lock e muda a coluna `Estado`
(`BACKLOG` → `READY` → `IN_PROGRESS` → `TESTING`/`REVIEW` → `DONE`; `BLOCKED` quando depende de alguém).
Uma tarefa = um dono. Nunca pegar tarefa `IN_PROGRESS` de outro.

## 3b. Fichas
Tarefas operacionais (mexer no celular) ganham uma ficha em `.collab/fichas/` com: comando exato,
"deu certo se…", o que fazer se der erro e o que não fazer. Quem executa segue a ficha passo a passo
e para no primeiro erro. Ficha errada ou incompleta → handoff para quem escreveu.

## 4. Handoff
Para pedir algo ao outro, crie `.collab/handoff/AAAA-MM-DD_<de>-para-<para>_<assunto>.md`
com: contexto, o que precisa, arquivos envolvidos, critério de pronto.
Quem recebe responde no mesmo arquivo e marca `RESOLVIDO` no topo.
**Só acrescentar no fim do arquivo, nunca reescrever o que já existe.** Dois agentes escrevendo ao mesmo tempo apagam o texto um do outro.

## 5. Revisão cruzada
Todo trabalho vai para `review`. O **outro** agente revisa antes de `done`.
Nada de revisar o próprio código. (19/10, D16: em tarefa não crítica o subagente `code-reviewer`, com contexto isolado, conta como o outro agente; tarefa crítica segue com a QA. Ver §10.)

## 6. Log
Ao terminar uma tarefa, uma linha em `docs/LOG.md`: data, agente, o que mudou, arquivos.

## 7. Versionamento
- Git ativo: commit pequeno direto no `main`, sempre com caminhos (`git commit -m "<SIGLA>: <Txx> ..." -- <arquivos>`),
  porque o índice é compartilhado entre as sessões. A trava `commit-msg` confere o escopo pelo `Txx`.
  Branch próprio só para sessão em worktree (`claude/*`) e para o `server-box`; o merge passa pelo CHEFE.
- Se for usar outra ferramenta de versão, a regra de ouro continua: um dono por zona + locks + revisão.

## 8. Segurança
- Nunca rodar comandos destrutivos no celular (`wipe`, `uninstall`, factory reset) sem confirmação do usuário.
- **A15 só leitura (21/10, diretriz do Ryan):** é o celular pessoal dele, de uso diário. Nenhum agente (Claude ou Gemini) escreve nele: nem pasta temporária no Termux, instalar/remover app, mudar ajuste, tocar arquivo pessoal, root, bootloader ou debloat. O que pode: ler configuração do servidor (`sshd -T`, lista de serviços) sem copiar dado pessoal. Teste de código usa mock, fixture ou teste unitário (T107). Escrita só com ordem do Ryan naquele momento, e a ordem vale para aquela ação.
- Nunca colocar senhas, padrões de desbloqueio ou tokens em arquivos do projeto.

## 9. Economia de tokens (19/10, obrigatório)
O limite do plano é compartilhado por todas as sessões. Contexto grande = custo em toda chamada.
- **Ler só o necessário.** `TASKS.md` tem só tarefas abertas (feitas: `.collab/TASKS_FEITAS.md`). LOG: só `tail -n 10 docs/LOG.md`; arquivo antigo em `docs/log/`, não ler sem motivo.
- **Arquivo grande** (> 300 linhas): Grep, `sed -n 'a,bp'` ou Read com offset/limit. Nunca reler arquivo que já está no contexto.
- **Revisão cruzada:** `git diff -- <arquivos>` ou `git show <commit> --stat` + trechos, não o arquivo inteiro.
- **Escrever sem ler:** LOG com append (`>>` / `Add-Content`), 1 linha de até ~300 caracteres; detalhes ficam no commit/handoff. Tarefa nova DONE: mover a linha para `TASKS_FEITAS.md`.
- **Saída curta:** filtrar comandos (`| tail -n 30`, `--quiet`); testes: só resumo e falhas. Nada de despejar log/JSON inteiro.
- **Sem espera ativa:** proibido `/loop`, ScheduleWakeup, `sleep` ou releitura periódica para esperar outra sessão. Deixe o handoff/TASKS e encerre o turno.
- **Subagentes:** os do projeto (§10) primeiro, que são baratos e devolvem resumo. Os do ECC só nos passos e nas condições da tabela do §12 (D20). Agent genérico, Explore e pesquisa web só com pedido do Ryan.
- **Respostas curtas** ao Ryan e entre sessões: o que mudou, o que falta. Sem repetir o que já está nos arquivos.
- **Contexto:** o projeto compacta sozinho aos 25% da janela (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=25` em `.claude/settings.json`, ~250 mil). Antes disso, registre o estado em TASKS/handoff; sessão com muito histórico inútil: `/compact` ou sessão nova.
- **Cache:** não trocar de modelo nem de esforço no meio da sessão (perde o cache e reprocessa tudo), nem com `/model` ou `/effort` digitado à mão. Troque só depois de `/clear` ou em sessão nova.
- **Opus com contexto curto (20/10, D19):** CHEFE e QA abrem sessão nova a cada onda (despacho, revisões, decisão) ou quando o contexto passa de ~100 mil, com o estado já em TASKS/handoff; o hook `SessionStart` repõe a fila. Cada turno do Opus reprocessa o contexto inteiro, então é a maior economia isolada.
- **Uma tarefa por contexto:** terminou e fechou a tarefa (`/fechar-tarefa`)? Rode `/clear` antes da próxima, a menos que ela dependa do que acabou de ser feito. O estado fica em TASKS/LOG/commit, não no histórico.
- **Plugins e conectores fora do projeto:** os plugins de Shopify/Trackbee ficam desligados neste projeto (`.claude/settings.json`). Conectores da conta (meta-ads, Hostinger, Gmail…) só o Ryan desliga.
- **Modelo/esforço (20/10, Ryan): quem codifica é barato, quem confere é o melhor.** O modelo de cada sessão e de cada subagente está **só** em `docs/AGENTES.md` (fonte única; o validador `tools/qa/agentes.mjs` confere os arquivos de agente contra ele). Esforço médio para todos. Volume com especificação fechada e teste de aceite vai de preferência para as vagas do Gemini (fora da cota do Claude); quem decide se passou é a trava (`regressao.mjs`, `escopo.mjs`, `commit-msg`), não o modelo. Haiku: tarefas pequenas, uma por vez, sempre com a ficha ou os critérios "deu certo se…" da tarefa; nada de refatoração grande ou decisão de arquitetura (isso sobe para o CHEFE). Nada vai a DONE sem a revisão do QA ou do CHEFE. Nunca xhigh/max sem OK do Ryan. No máximo 2 sessões trabalhando ao mesmo tempo; as outras ficam paradas até o CHEFE chamar.

## 10. Time de especialistas (19/10, CHEFE)
**Quadro único de nomes, papéis e pares do ECC: `docs/AGENTES.md`** (T90; a regressão confere o quadro contra `.claude/agents/`, passo "agentes"). Esta seção e o §12 explicam o porquê.

Montado no padrão atual da Anthropic: subagentes em `.claude/agents/` (contexto isolado, ferramentas mínimas, modelo barato onde dá), skills em `.claude/skills/` e uma trava em `.claude/hooks/`. Fica no git e vale para toda sessão Claude aberta na raiz do projeto.

| Subagente | Modelo | Ferramentas | Quando usar |
|---|---|---|---|
| `code-explorer` | haiku | só leitura | "onde está X?" sem encher o contexto |
| `verificador` | haiku | Bash sem editar | regressão e testes: devolve só o resumo e as falhas |
| `code-reviewer` | sonnet | Bash/leitura, sem editar | revisão cruzada pelo diff |
| `code-simplifier` | haiku | edita | limpar o código da tarefa sem mudar o comportamento |
| `android-adb` | sonnet | ADB | diagnóstico, cadastro de aparelho, ajustes (tem memória do projeto) |
| `termux-infra` | sonnet | Bash/edita | runit, sshd, deploy, backup, egress (tem memória do projeto) |
| `security-reviewer` | sonnet | só leitura | auditoria antes de deploy e quando mexer em auth ou rede |
| `silent-failure-hunter` | sonnet | só leitura | erro engolido, fallback que finge sucesso, falta de timeout, teste fraco (scripts de serviço, deploy, rede) |
| `tdd-guide` | sonnet | edita | código novo ou bug: teste que falha, correção mínima, prova por mutação (T90) |

Reforço de 20/10 (ideias do ECC, adaptadas): `code-reviewer` e `security-reviewer` só reportam achado com `arquivo:linha` e cenário concreto, e revisão sem achado é válida; o `code-reviewer` roda `escopo.mjs --review`; o `android-adb` tem o roteiro de rede do A15. O plugin ECC (`ecc@ecc`) está ligado só neste projeto (`.claude/settings.json`), com os hooks no perfil standard e o GateGuard ligado (§12). A config global do Claude fica no padrão de fábrica. Os agentes do ECC entram só nos passos e nas condições da tabela do §12 (D20); fora dela, só com pedido do Ryan.

Skills: `/rotina <SIGLA>` (início de turno com 1 comando), `/fechar-tarefa <Txx> <evidência>` (a esteira decide REVIEW ou DONE), `/revisar-tarefa <Txx>`, `/despachar` (só o CHEFE) e o workflow `/diagnostico` do Antigravity.

Trava (`adb-guard`): bloqueia comando ADB destrutivo (uninstall, clear, disable, reboot, compile, wm density, policy_control, rm -rf, fastboot). Só passa com o OK do Ryan e o marcador `# OK-RYAN: <motivo>` no comando. Teste: `node --test .claude/hooks/adb-guard.test.mjs`.

Não usamos o "Agent Teams" experimental: custa mais e a coordenação já é feita pelo CHEFE com as sessões.

### Esteira automática (19/10, D16)
- **Início de sessão:** o hook `SessionStart` injeta sozinho a fila por agente, os locks, os handoffs e o fim do LOG (`.claude/hooks/estado-equipe.mjs`, ~400 tokens). Para atualizar: `node .claude/hooks/estado-equipe.mjs`.
- **Entrega:** `/fechar-tarefa <Txx> <evidência>` roda `verificador` e `code-reviewer` em paralelo. Tarefa não crítica aprovada vai direto para DONE. Tarefa crítica (aparelho, `profiles/`, `server/termux`, `tools/server`, deploy, auth, rede, segredos) vai para REVIEW com a QA.
- **Distribuição:** o CHEFE usa `/despachar`, que só acorda sessão parada que tem trabalho.
- **Gemini:** pedidos no fim do handoff aberto dele; o Ryan cola uma linha no Antigravity.

## 11. Supervisão do CHEFE (20/10, pedido do Ryan)
O CHEFE (Opus) não codifica: confere. A cada tarefa que chega em REVIEW, ele (ou o QA, também Opus) faz, nesta ordem e pelo diff:
1. **Roda** `node tools/qa/regressao.mjs` e os testes da tarefa — nunca confia no "passou" do executor.
2. **Reproduz** o critério "deu certo se…" da tarefa; sem isso, devolve para IN_PROGRESS com o motivo em 1 linha.
3. **Confere o escopo**: `git show --stat` só pode ter os arquivos autorizados da tarefa; qualquer outro → reprova.
4. **Segurança**: segredo no diff, porta/exposição nova, `--yolo`/`-Force` fora de lugar, ADB destrutivo → reprova e avisa o Ryan.

Os passos 3 e 4 são **automáticos** (20/10):
- **Trava no commit** (`.githooks/commit-msg`, ligada com `git config core.hooksPath .githooks`): todo commit que cita `Txx` só passa com arquivos que estão entre crases nos "Arquivos autorizados" da tarefa, mais `.collab/**` e `docs/LOG.md`. Se a coluna disser "testes", os arquivos de teste também passam. Qualquer commit, com ou sem `Txx`, é recusado se trouxer comando destrutivo de ADB ou segredo em código. Vale para o Claude e para o Gemini. Liberação pontual só com `OK-RYAN: <motivo>` na mensagem.
- **Conferência das tarefas em REVIEW**: `node tools/qa/escopo.mjs --review` confere os commits de cada uma. Tarefa com FALHA volta para o dono.
- **Fila protegida**: o mesmo hook trava o commit que apaga linha do `docs/LOG.md` (só acrescentar) ou que rebaixa o estado de uma tarefa que a mensagem não cita, o sinal de `TASKS.md` regravado de uma cópia velha. Antes de editar o TASKS, releia o arquivo e mude só a sua linha.
5. **Registra** o veredito (APROVADO/REPROVADO + motivo) na linha da tarefa; só então vai a DONE.
Auditoria do **Gemini (GEM-IDE-1 e GEM-IDE-2, D18)**: igual, porém sempre mais rígida — nenhuma vaga é revisada por si mesma nem por outra vaga do Gemini, e nenhuma roda nada no A13 sem lock. O lock leva a sigla da vaga; duas vagas nunca na mesma tarefa nem nos mesmos arquivos. GEM-IDE-2 só trabalha no `celular` com ordem do Ryan ou do CHEFE. Entregas dele só chegam em `main` depois dessa conferência; o CHEFE lê o handoff e o diff, não a conversa.
Saúde da equipe (1x por rodada, via `list_sessions`/`get_usage`): modelo/esforço de cada sessão conforme o §9, contexto > 200 mil → pedir `/compact`, sessão parada ou repetindo tarefa → reatribuir. Acesso amplo do Ryan não muda os limites: credenciais novas, gastos, roteador, exposição à internet e apagar dados continuam só com OK explícito dele.

## 12. ECC neste projeto (20/10, pedido do Ryan, D18)
**Onde mora:** plugin `ecc@ecc` 2.2.3 só em `.claude/settings.json` (plugin, marketplace, hooks no perfil `standard`, estado em `.claude/ecc-data`, fora do git). O global do Claude é `{}` e continua assim. O `spy` tem a própria cópia, por isso o `/ecc:configure-ecc` trava (dois escopos). **Não usar** `ecc install --target claude`/`antigravity`/`gemini` nem o `/ecc:configure-ecc`: gravam centenas de arquivos no global ou no `.agents/`. Mudar o perfil de hooks = editar `pluginConfigs` no `.claude/settings.json`.
**Regras (rules) do ECC:** o plugin não distribui; copiamos `common` + `typescript` para `.claude/rules/ecc/` (commit 24da32f). Sem filtro `paths:`, entram em toda sessão (~19 KB). Onde conflitam com o projeto vale `.claude/rules/projeto.md` (commit `SIGLA: Txx`, testes por arquivo, subagentes `ecc:*` só com pedido).
**Quem usar em cada passo** (20/10, D20; o Ryan autorizou o ECC nestes passos, fora deles continua "só com pedido"). Regra de custo: o nosso primeiro (barato, em português, preso ao protocolo); o especialista do ECC entra só na coluna "Escala quando". Todos rodam na mesma cota do Claude.
| Passo | Nosso (padrão) | ECC | Escala quando |
|---|---|---|---|
| Planejar | ficha em `.collab/fichas/` | `/ecc:plan` · `ecc:architect` | 3+ arquivos, decisão de arquitetura ou mexe em mais de uma zona; quem planeja é o CHEFE (Opus) |
| Código novo ou bug | — | skill `tdd-workflow` · `ecc:tdd-guide` | sempre: teste que falha primeiro, depois a correção; vale para todos os executores e vagas do Gemini |
| Rodar testes | `verificador` (Haiku) | skill `verification-loop` | nunca: o `verificador` basta |
| Revisar pelo diff | `code-reviewer` (Sonnet) | `ecc:typescript-reviewer` (nosso código é `.mjs`) · `/ecc:code-review` | diff com mais de ~300 linhas de JS, ou o `code-reviewer` reprovou 2 vezes |
| Auth, rede, segredos | `security-reviewer` (Sonnet) | `ecc:security-reviewer` · `/ecc:security-scan` | token, sshd, egress, painel exposto, antes de deploy; o scan roda 1 vez por semana ou antes de release |
| Falha silenciosa, teste fraco | `silent-failure-hunter` (Sonnet) | `ecc:silent-failure-hunter` · `ecc:pr-test-analyzer` | script de serviço, deploy, backup, rede; ou o teste novo não tem prova por mutação |
| Limpar o código | `code-simplifier` (Haiku) | `ecc:code-simplifier` · `/ecc:refactor-clean` | depois da tarefa verde; `/ecc:refactor-clean` só com pedido do CHEFE |
| Build ou erro de compilação | — | `/ecc:build-fix` · `ecc:build-error-resolver` | o painel (`server-box`) ou o `claude` no Termux não compila |
| Teste de ponta a ponta do painel | — | `ecc:e2e-runner` | FRONT, tela nova do painel; roda no PC contra o A15, sem mexer no aparelho |
| Documentação | CHEFE na própria tarefa | `/ecc:update-docs` · `ecc:doc-updater` | mudou comportamento e `docs/` ficou para trás |
| Contexto pesado | `/compact` (CLAUDE.md) | skill `context-budget` | sessão passou de ~100 mil (§9) |
| Fim de sessão longa | handoff + TASKS + LOG | `/ecc:save-session` · `/ecc:resume-session` | CHEFE e QA ao trocar de sessão (§9, D19) |

**Agente do ECC de cada seção** (20/10, pedido do Ryan). Cada sessão tem um agente do ECC como padrão do seu trabalho; o apoio é o subagente enxuto do projeto. Os nomes sem `ecc:` são a versão barata do projeto (modelo fixo, em português); com `ecc:` é a versão completa do plugin, só quando a coluna "Escala quando" acima pede.
| Seção (título da sessão) | Agente ECC padrão | Apoio do projeto |
|---|---|---|
| CHEFE · planeja e confere | `ecc:planner` (`ecc:architect` se mexe em arquitetura) | `code-reviewer`, `security-reviewer` |
| ORQ · infra e economia | `ecc:harness-optimizer` | `termux-infra`, `verificador` |
| BACK · servidor A15 | `ecc:tdd-guide` | `silent-failure-hunter`, `termux-infra` |
| FRONT · console do painel | `ecc:e2e-runner` | `code-simplifier`, `verificador` |
| QA · revisão e testes | `ecc:pr-test-analyzer` | `silent-failure-hunter`, `security-reviewer` |
| GEM-IDE-1 e GEM-IDE-2 | sem ECC (não roda no Antigravity) | regras do `GEMINI.md`/`GEMINI-2.md` |

**Renomeados em 20/10** (arquivos em `.claude/agents/`): `revisor` → `code-reviewer`, `seguranca` → `security-reviewer`, `cacador-falhas` → `silent-failure-hunter`, `explorador` → `code-explorer`, `simplificador` → `code-simplifier`. `verificador`, `android-adb` e `termux-infra` ficam (sem par no ECC). Valem a partir de uma sessão nova (a lista de subagentes é lida ao abrir). O campo `revisor:` da coluna Pendências do `TASKS.md` é o **papel** de quem revisa e não muda.

**Não se aplica a este projeto** (não gaste turno): revisores de Go, Python, F#, C++, C#, Java, Kotlin, Rust, Swift, PHP, Ruby, Vue, React, Flutter, Django e FastAPI; `database-reviewer` (sem Postgres), `mle-reviewer` (sem ML), `harmonyos-app-resolver`, SEO e marketing. O `/code-review` do ECC vale para o JS do projeto; os revisores de linguagem só entram se a linguagem aparecer.
**Hooks do ECC ligados:** GateGuard (pede fatos antes da 1ª edição/Bash), context-monitor, quality-gate e afins no `standard`. Desligados por `ECC_DISABLED_HOOKS`: mcp-health-check, plan-canvas e command-log (ruído e tokens). Para o ECC pesar menos: `ECC_GATEGUARD=off` no `env` do projeto.
**Gemini (2 vagas, D18/D20):** os hooks e os agentes do ECC são do Claude Code; no Antigravity valem só as regras escritas em `GEMINI.md`/`GEMINI-2.md` e nos handoffs. Não copiar o ECC para `.agents/` nem `.gemini/`. Papéis padrão (o Ryan pode trocar): **GEM-IDE-1** = código e tooling do `celular` (`tools/connect`, `rescue`, `debug`, `profiles/`), tarefas de teste com especificação fechada (ex.: T87), volume com receita pronta (testes novos, documentação, fixtures) e auditoria só de leitura (mutação, varredura de segredos, relatório via handoff); **GEM-IDE-2** = outras frentes do Ryan, no `celular` só com ordem. Todas seguem o mesmo método do ECC: teste que falha primeiro, achado com `arquivo:linha`, parar no primeiro erro. Quem confere o que o Gemini entrega é a trava + o `/fechar-tarefa` do CHEFE ou a QA; vaga não revisa vaga. Pacote de instruções: `.collab/handoff/arquivo/2026-10-20_chefe-para-gemini_equipe-e-fluxo.md`.
**Conferir:** `node --test .claude/hooks/adb-guard.test.mjs .claude/hooks/estado-equipe.test.mjs` (o `node --test <pasta>` falha neste Node; passe os arquivos) · `node tools/qa/regressao.mjs` (já roda os testes dos hooks: pega todo `*.test.mjs` rastreado, por pasta; o pedido à QA em `2026-10-20_chefe-para-qa_hooks-na-regressao.md` partiu de uma premissa falsa). O `ecc doctor` avisa "No ECC install-state files": normal, só existe em instalação manual.
