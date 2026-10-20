---
name: revisar-tarefa
description: Revisão cruzada de uma tarefa em REVIEW no projeto celular, usando o subagente code-reviewer e registrando o veredito.
argument-hint: "<Txx> [commit ou intervalo]"
---
Argumentos: $ARGUMENTS

1. Ache a tarefa e os commits: `grep '^| <Txx> ' .collab/TASKS.md` e `git log --oneline --grep '<Txx>' -10`.
2. Se você for o autor desses commits, pare: nada de revisar o próprio código. Avise o CHEFE.
3. **Em paralelo, numa mensagem só** (não confie no "passou" do autor, §11):
   - `verificador`: os testes da tarefa mais `node tools/qa/regressao.mjs`, e o critério "deu certo se…" da linha reproduzido;
   - `code-reviewer`: a tarefa, os commits e os arquivos autorizados, com o veredito no formato dele;
   - reforço só quando o diff pede (tabela do §12): auth, token, sshd, rede, egress ou painel exposto → `security-reviewer`; serviço, deploy, backup, rede ou teste sem prova por mutação → `silent-failure-hunter`.
4. Registre na coluna Pendências da tarefa: `revisão <agente> <data>: <veredito> — <notas curtas>`.
   - VERDE e APROVADO → DONE: mova a linha para `.collab/TASKS_FEITAS.md`. Tarefa **crítica** (aparelho, `profiles/`, `server/termux`, `tools/server`, deploy, auth, rede, segredos) só vai a DONE com o veredito da **QA**; se você não é a QA, deixe em REVIEW com `revisora: QA`.
   - VERMELHO, REPROVADO ou notas que pedem mudança → deixe em REVIEW e avise o autor por uma mensagem curta com o motivo.
5. Escreva 1 linha no LOG (append) e faça commit só do TASKS, do TASKS_FEITAS e do LOG, com o seu nome.
