---
name: despachar
description: Só para o CHEFE do projeto celular — lê a fila da equipe e manda a cada sessão parada a próxima tarefa em mensagens curtas, sem acordar quem não tem trabalho.
---
0. `node tools/qa/escopo.mjs --review` e `node tools/qa/regressao.mjs`. Tarefa em REVIEW com FALHA volta para o dono com o motivo. Não confie no "passou" de ninguém (§11).
1. `node .claude/hooks/estado-equipe.mjs` e `list_sessions` (veja `isRunning`).
2. Para cada agente com algo em `revisar:` ou READY e com a sessão **parada**, mande uma mensagem de até 3 linhas: a tarefa, os arquivos, o critério de pronto, "feche com /fechar-tarefa" e "não precisa responder".
3. Não mande nada para quem está rodando (a mensagem só entra na fila e custa um turno) nem para quem não tem tarefa.
4. GEM-IDE e GEM-CLI: o Gemini roda em ciclo no Antigravity (`.collab/handoff/2026-10-19_chefe-para-gemini_LOOP-de-tarefas.md`). Basta a tarefa estar READY com GEM-IDE ou GEM-CLI; se ele parou ("FILA VAZIA"), dê ao Ryan a linha para colar e reiniciar o ciclo.
5. RYAN: junte todos os pedidos de ação humana numa lista numerada, na resposta final.

Sessões:
| Sigla | Título | id |
|---|---|---|
| ORQ | ORQ · infra e economia | local_11542123-024a-49b2-8b6b-4a864b878e44 |
| BACK | BACK · servidor A15 | local_27089016-b63e-48ec-b463-eafcdbde9a99 |
| FRONT | FRONT · console do painel | local_a08055c8-66d2-4916-b128-6a1d722899f7 |
| QA | QA · revisão e testes | local_3295f0ab-04ae-4841-9d61-eb2b54e6ac00 |
