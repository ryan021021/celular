---
name: despachar
description: Só para o CHEFE do projeto celular — lê a fila da equipe e manda a cada sessão parada a próxima tarefa em mensagens curtas, sem acordar quem não tem trabalho.
---
0. `node tools/qa/escopo.mjs --review` e `node tools/qa/regressao.mjs`. Tarefa em REVIEW com FALHA volta para o dono com o motivo. Não confie no "passou" de ninguém (§11).
1. `node .claude/hooks/estado-equipe.mjs` e `list_sessions` (veja `isRunning`).
2. Para cada agente com algo em `revisar:` ou READY e com a sessão **parada**, mande uma mensagem de até 3 linhas: a tarefa, os arquivos, o critério de pronto, "feche com /fechar-tarefa" e "não precisa responder".
3. Não mande nada para quem está rodando (a mensagem só entra na fila e custa um turno) nem para quem não tem tarefa.
4. GEM-IDE-1 e GEM-IDE-2 (são só 2 Geminis): **sem ciclo** (o ciclo de 19/10 rodou a noite toda e deixou o modelo com ~3 min por resposta; cancelado, `.collab/gemini-loop.stop`). Deixe a tarefa READY com a sigla da vaga e dê ao Ryan a linha: "conversa nova na aba 1 (ou 2) e rode `/vaga-1` (ou `/vaga-2`)". Uma tarefa por conversa. **Nunca** ordene `Start-Sleep`, polling, "não pare" ou "confira de novo" a nenhum agente. GEM-IDE-2 (GEMINI-2, conta 2) recebe tarefa do `celular` só quando o CHEFE despacha ou o Ryan manda. GEM-CLI está aposentado (D18). Nunca duas vagas na mesma tarefa nem nos mesmos arquivos (lock por sigla).
5. RYAN: junte todos os pedidos de ação humana numa lista numerada, na resposta final.

Sessões: ache o id pelo título no `list_sessions` (o título começa com a sigla: `ORQ ·`, `BACK ·`, `FRONT ·`, `QA ·`; a tabela completa está em `docs/AGENTES.md`). Não guarde ids aqui: a sessão recriada ganha id novo. Sessão arquivada com tarefa READY entra na lista do Ryan (passo 5) para ele decidir se desarquiva.
