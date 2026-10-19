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
- **Orquestração:** a sessão Claude "Organizar estrutura com Gemini Antigravity" coordena (ver `docs/engineering/MASTER_PLAN.md`). Tarefas só pelo `.collab/TASKS.md`.
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
Nada de revisar o próprio código.

## 6. Log
Ao terminar uma tarefa, uma linha em `docs/LOG.md`: data, agente, o que mudou, arquivos.

## 7. Versionamento
- Git (já instalado, 2.53): um branch por agente (`claude/<tarefa>`, `gemini/<tarefa>`), commits pequenos,
  merge no `main` só após revisão cruzada. Ainda **não** foi iniciado (`git init` pendente).
- Se for usar outra ferramenta de versão, a regra de ouro continua: um dono por zona + locks + revisão.

## 8. Segurança
- Nunca rodar comandos destrutivos no celular (`wipe`, `uninstall`, factory reset) sem confirmação do usuário.
- Nunca colocar senhas, padrões de desbloqueio ou tokens em arquivos do projeto.
