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
`.collab/TASKS.md` é a fila. Cada agente pega uma tarefa mudando o campo `dono` e `status`
(`todo` → `doing` → `review` → `done`). Uma tarefa = um dono. Nunca pegar tarefa `doing` de outro.

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
Nada de revisar o próprio código. (19/10, D16: em tarefa não crítica o subagente `revisor`, com contexto isolado, conta como o outro agente; tarefa crítica segue com a QA. Ver §10.)

## 6. Log
Ao terminar uma tarefa, uma linha em `docs/LOG.md`: data, agente, o que mudou, arquivos.

## 7. Versionamento
- Git (já instalado, 2.53): um branch por agente (`claude/<tarefa>`, `gemini/<tarefa>`), commits pequenos,
  merge no `main` só após revisão cruzada. Ainda **não** foi iniciado (`git init` pendente).
- Se for usar outra ferramenta de versão, a regra de ouro continua: um dono por zona + locks + revisão.

## 8. Segurança
- Nunca rodar comandos destrutivos no celular (`wipe`, `uninstall`, factory reset) sem confirmação do usuário.
- Nunca colocar senhas, padrões de desbloqueio ou tokens em arquivos do projeto.

## 9. Economia de tokens (19/10, obrigatório)
O limite do plano é compartilhado por todas as sessões. Contexto grande = custo em toda chamada.
- **Ler só o necessário.** `TASKS.md` tem só tarefas abertas (feitas: `.collab/TASKS_FEITAS.md`). LOG: só `tail -n 10 docs/LOG.md`; arquivo antigo em `docs/log/`, não ler sem motivo.
- **Arquivo grande** (> 300 linhas): Grep, `sed -n 'a,bp'` ou Read com offset/limit. Nunca reler arquivo que já está no contexto.
- **Revisão cruzada:** `git diff -- <arquivos>` ou `git show <commit> --stat` + trechos, não o arquivo inteiro.
- **Escrever sem ler:** LOG com append (`>>` / `Add-Content`), 1 linha de até ~300 caracteres; detalhes ficam no commit/handoff. Tarefa nova DONE: mover a linha para `TASKS_FEITAS.md`.
- **Saída curta:** filtrar comandos (`| tail -n 30`, `--quiet`); testes: só resumo e falhas. Nada de despejar log/JSON inteiro.
- **Sem espera ativa:** proibido `/loop`, ScheduleWakeup, `sleep` ou releitura periódica para esperar outra sessão. Deixe o handoff/TASKS e encerre o turno.
- **Subagentes:** só os do projeto (§10), que são baratos e devolvem resumo. Agent genérico, Explore e pesquisa web só com pedido do Ryan.
- **Respostas curtas** ao Ryan e entre sessões: o que mudou, o que falta. Sem repetir o que já está nos arquivos.
- **Contexto:** o projeto compacta sozinho aos 25% da janela (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=25` em `.claude/settings.json`, ~250 mil). Antes disso, registre o estado em TASKS/handoff; sessão com muito histórico inútil: `/compact` ou sessão nova.
- **Cache:** não trocar de modelo nem de esforço no meio da sessão (perde o cache e reprocessa tudo). Troque só depois de `/clear` ou em sessão nova.
- **Uma tarefa por contexto:** terminou e fechou a tarefa (`/fechar-tarefa`)? Rode `/clear` antes da próxima, a menos que ela dependa do que acabou de ser feito. O estado fica em TASKS/LOG/commit, não no histórico.
- **Plugins e conectores fora do projeto:** os plugins de Shopify/Trackbee ficam desligados neste projeto (`.claude/settings.json`). Conectores da conta (meta-ads, Hostinger, Gmail…) só o Ryan desliga.
- **Modelo/esforço (20/10, Ryan): quem codifica é barato, quem confere é o melhor.** Executores BACK, FRONT e ORQ = **Haiku**, esforço médio; QA = **Opus**, esforço médio (testa, revisa pelo diff e reprova); CHEFE = **Opus**, esforço médio (supervisiona e decide). Subagentes = Haiku. Haiku: tarefas pequenas, uma por vez, sempre com a ficha ou os critérios "deu certo se…" da tarefa; nada de refatoração grande ou decisão de arquitetura (isso sobe para o CHEFE). Nada vai a DONE sem a revisão do QA ou do CHEFE. Nunca xhigh/max sem OK do Ryan. No máximo 2 sessões trabalhando ao mesmo tempo; as outras ficam paradas até o CHEFE chamar.

## 10. Time de especialistas (19/10, CHEFE)
Montado no padrão atual da Anthropic: subagentes em `.claude/agents/` (contexto isolado, ferramentas mínimas, modelo barato onde dá), skills em `.claude/skills/` e uma trava em `.claude/hooks/`. Fica no git e vale para toda sessão Claude aberta na raiz do projeto.

| Subagente | Modelo | Ferramentas | Quando usar |
|---|---|---|---|
| `explorador` | haiku | só leitura | "onde está X?" sem encher o contexto |
| `verificador` | haiku | Bash sem editar | regressão e testes: devolve só o resumo e as falhas |
| `revisor` | sonnet | Bash/leitura, sem editar | revisão cruzada pelo diff |
| `simplificador` | sonnet | edita | limpar o código da tarefa sem mudar o comportamento |
| `android-adb` | sonnet | ADB | diagnóstico, cadastro de aparelho, ajustes (tem memória do projeto) |
| `termux-infra` | sonnet | Bash/edita | runit, sshd, deploy, backup, egress (tem memória do projeto) |
| `seguranca` | sonnet | só leitura | auditoria antes de deploy e quando mexer em auth ou rede |

Skills: `/rotina <SIGLA>` (início de turno com 1 comando), `/fechar-tarefa <Txx> <REVIEW|DONE> <evidência>`, `/revisar-tarefa <Txx>`.

Trava (`adb-guard`): bloqueia comando ADB destrutivo (uninstall, clear, disable, reboot, compile, wm density, policy_control, rm -rf, fastboot). Só passa com o OK do Ryan e o marcador `# OK-RYAN: <motivo>` no comando. Teste: `node --test .claude/hooks/adb-guard.test.mjs`.

Não usamos o "Agent Teams" experimental: custa mais e a coordenação já é feita pelo CHEFE com as sessões.

### Esteira automática (19/10, D16)
- **Início de sessão:** o hook `SessionStart` injeta sozinho a fila por agente, os locks, os handoffs e o fim do LOG (`.claude/hooks/estado-equipe.mjs`, ~400 tokens). Para atualizar: `node .claude/hooks/estado-equipe.mjs`.
- **Entrega:** `/fechar-tarefa <Txx> <evidência>` roda `verificador` e `revisor` em paralelo. Tarefa não crítica aprovada vai direto para DONE. Tarefa crítica (aparelho, `profiles/`, `server/termux`, `tools/server`, deploy, auth, rede, segredos) vai para REVIEW com a QA.
- **Distribuição:** o CHEFE usa `/despachar`, que só acorda sessão parada que tem trabalho.
- **Gemini:** pedidos no fim do handoff aberto dele; o Ryan cola uma linha no Antigravity.

## 11. Supervisão do CHEFE (20/10, pedido do Ryan)
O CHEFE (Opus) não codifica: confere. A cada tarefa que chega em REVIEW, ele (ou o QA, também Opus) faz, nesta ordem e pelo diff:
1. **Roda** `node tools/qa/regressao.mjs` e os testes da tarefa — nunca confia no "passou" do executor.
2. **Reproduz** o critério "deu certo se…" da tarefa; sem isso, devolve para IN_PROGRESS com o motivo em 1 linha.
3. **Confere o escopo**: `git show --stat` só pode ter os arquivos autorizados da tarefa; qualquer outro → reprova.
4. **Segurança**: segredo no diff, porta/exposição nova, `--yolo`/`-Force` fora de lugar, ADB destrutivo → reprova e avisa o Ryan.
5. **Registra** o veredito (APROVADO/REPROVADO + motivo) na linha da tarefa; só então vai a DONE.
Auditoria do **Gemini (GEM-IDE)**: igual, porém sempre mais rígida — ele não é revisado por si mesmo e não roda nada no A13 sem lock. Entregas dele só chegam em `main` depois dessa conferência; o CHEFE lê o handoff e o diff, não a conversa.
Saúde da equipe (1x por rodada, via `list_sessions`/`get_usage`): modelo/esforço de cada sessão conforme o §9, contexto > 200 mil → pedir `/compact`, sessão parada ou repetindo tarefa → reatribuir. Acesso amplo do Ryan não muda os limites: credenciais novas, gastos, roteador, exposição à internet e apagar dados continuam só com OK explícito dele.
