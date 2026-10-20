---
name: fechar-tarefa
description: Esteira automática para entregar uma tarefa do projeto celular em um comando — testes (verificador) e revisão independente (code-reviewer) em paralelo, depois TASKS/TASKS_FEITAS, LOG e commit.
argument-hint: "<Txx> <evidência curta>"
---
Argumentos: $ARGUMENTS

1. **Arquivos da tarefa:** os que você mudou (`git status --short` e `git diff --stat`) e a linha da tarefa (`grep '^| <Txx> ' .collab/TASKS.md`).
2. **Em paralelo, numa mensagem só**, chame dois subagentes:
   - `verificador`: os testes ligados a esses arquivos mais a regressão.
   - `code-reviewer`: a tarefa, o diff desses arquivos e os "Arquivos autorizados" da linha.
2b. **Reforço só quando o diff pede** (na mesma mensagem do passo 2; tabela do §12):
   - mexe em auth, token, sshd, rede, egress ou painel exposto → também `security-reviewer`;
   - script de serviço, deploy, backup, rede, ou teste novo sem prova por mutação → também `silent-failure-hunter`;
   - código novo ou bug sem teste que falhava antes, ou teste novo sem mutante morto → devolva ao autor (subagente `tdd-guide`), sem gastar code-reviewer.
   Tarefa comum não chama nenhum dos dois: o custo fica no `verificador` e no `code-reviewer`.
3. **Decida:**
   - VERMELHO ou REPROVADO: corrija e volte ao passo 2. No máximo 2 voltas; depois disso, avise o CHEFE.
   - VERDE e APROVADO (ou com notas só cosméticas), numa tarefa **não crítica**: vira **DONE**. Mova a linha para o fim de `.collab/TASKS_FEITAS.md` com a evidência e `code-reviewer (subagente): APROVADO`.
   - Tarefa **crítica** (mexe no aparelho, `profiles/`, `server/termux`, `tools/server`, painel em produção, deploy, auth, rede ou segredos): vira **REVIEW** com `revisora: QA`, e o veredito do code-reviewer vai na evidência.
4. **LOG** (append, sem ler): `echo "- $(date '+%Y-%m-%d %H:%M') · <agente> · <Txx>: <até ~250 caracteres>" >> docs/LOG.md`
5. **Commit** só dos seus arquivos: `git add -- <arquivos> .collab/TASKS.md .collab/TASKS_FEITAS.md docs/LOG.md` e `git -c user.name="<agente>" commit -m "<AGENTE>: <Txx> ..." -- <os mesmos>`. Nunca `add -A`, `reset --hard` nem `stash` sem tag.
5b. Se o commit for recusado pela trava (§11, escopo ou perigo), corrija. Não use `OK-RYAN` por conta própria.
6. Apague o seu lock e **sempre** avise o CHEFE (a sessão cujo título começa com `CHEFE ·`; o id sai do `list_sessions`) em uma linha: `Txx → DONE|REVIEW, commit <hash>`. É o que fecha o ciclo: o CHEFE confere e despacha a próxima. Depois encerre o turno.
7. Na última linha da resposta, sugira ao Ryan `/clear` antes da próxima tarefa (§9: uma tarefa por contexto).
