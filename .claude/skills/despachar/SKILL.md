---
name: despachar
description: Só para o CHEFE do projeto celular — lê a fila da equipe e manda a cada sessão parada a próxima tarefa em mensagens curtas, sem acordar quem não tem trabalho.
---
1. `node .claude/hooks/estado-equipe.mjs` e `list_sessions` (veja `isRunning`).
2. Para cada agente com algo em `revisar:` ou READY e com a sessão **parada**, mande uma mensagem de até 3 linhas: a tarefa, os arquivos, o critério de pronto, "feche com /fechar-tarefa" e "não precisa responder".
3. Não mande nada para quem está rodando (a mensagem só entra na fila e custa um turno) nem para quem não tem tarefa.
4. GEM-IDE: acrescente o pedido no fim do handoff aberto dele e dê ao Ryan uma linha pronta para colar no Antigravity.
5. RYAN: junte todos os pedidos de ação humana numa lista numerada, na resposta final.

Sessões:
| Sigla | Título | id |
|---|---|---|
| ORQ | Organizar estrutura com Gemini Antigravity | local_11542123-024a-49b2-8b6b-4a864b878e44 |
| BACK | A13 server OS enterprise reengineering | local_27089016-b63e-48ec-b463-eafcdbde9a99 |
| FRONT | Home VPS control center reengineering | local_a08055c8-66d2-4916-b128-6a1d722899f7 |
| QA | A13 home server architecture reengineering | local_3295f0ab-04ae-4841-9d61-eb2b54e6ac00 |
