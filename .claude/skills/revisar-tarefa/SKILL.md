---
name: revisar-tarefa
description: Revisão cruzada de uma tarefa em REVIEW no projeto celular, usando o subagente revisor e registrando o veredito.
argument-hint: "<Txx> [commit ou intervalo]"
---
Argumentos: $ARGUMENTS

1. Ache a tarefa e os commits: `grep '^| <Txx> ' .collab/TASKS.md` e `git log --oneline --grep '<Txx>' -10`.
2. Se você for o autor desses commits, pare: nada de revisar o próprio código. Avise o CHEFE.
3. Chame o subagente `revisor` com: a tarefa, os commits e os arquivos autorizados. Peça o veredito no formato dele.
4. Registre na coluna Pendências da tarefa: `revisão <agente> <data>: <veredito> — <notas curtas>`.
   - APROVADO → mova a linha para `.collab/TASKS_FEITAS.md` com o Estado DONE.
   - REPROVADO ou APROVADO COM NOTAS que precisem de mudança → deixe em REVIEW e avise o autor por uma mensagem curta.
5. Escreva 1 linha no LOG (append) e faça commit só do TASKS, do TASKS_FEITAS e do LOG, com o seu nome.
