---
description: Entrega a tarefa atual com testes, LOG, commit com caminhos e REVIEW
---

Use a sigla desta conversa (GEM-IDE-1 ou GEM-IDE-2). Se não souber qual é, pergunte ao Ryan e pare.

1. Rode só os testes da tarefa: `node --test <arquivo1> <arquivo2>` com saída curta. Falhou: corrija ou escreva o motivo no handoff e pare. Não entregue com teste vermelho.
2. Prova de mutação feita? Diga em 1 linha qual quebra o teste pegou. Se não fez, faça agora (cópia fora do repositório).
3. No `.collab/TASKS.md` a tarefa vai para **REVIEW** (nunca DONE). No fim do `docs/LOG.md` acrescente uma linha `AAAA-MM-DD HH:MM · <sigla minúscula> · Txx: o que mudou, testes N/N, mutação pegou X`.
4. Remova o seu lock `.collab/locks/<Txx>-<sigla minúscula>.lock` e o `A15-<sigla minúscula>.lock` se tiver criado (só os seus).
5. Commit só com os seus arquivos: `git -c user.name="<sigla minúscula>" commit -m "<SIGLA>: Txx resumo" -- <arquivos da tarefa> .collab/TASKS.md docs/LOG.md`. Se a trava do commit recusar, leia o motivo, não contorne, escreva no handoff.
6. Responda ao Ryan em até 3 linhas: commit, testes, "TAREFA ENTREGUE, abra conversa nova". Pare.
