---
description: Inicia esta aba como GEM-IDE-2 e pega uma tarefa READY
---

Nesta conversa você é **GEM-IDE-2** (sigla minúscula `gem-ide-2`). Vale até a conversa acabar.

1. Leia só as linhas de `.collab/TASKS.md` que têm `GEM-IDE-2` (busca por texto, não o arquivo inteiro).
2. Liste `.collab/locks/` e os handoffs de hoje em `.collab/handoff/` endereçados a gemini ou gem-ide-2. Leia só os que não dizem RESOLVIDO.
3. Escolha UMA tarefa READY com `GEM-IDE-2` na coluna Agente. Se houver tarefa sua IN_PROGRESS com lock seu, continue nela.
4. Nenhuma: responda "FILA VAZIA" e pare. Não pegue tarefa da GEM-IDE-1.
5. Achou: crie `.collab/locks/<Txx>-gem-ide-2.lock` com uma linha (data, hora, Txx), mude a tarefa para IN_PROGRESS no `TASKS.md` e diga ao Ryan em 2 linhas: tarefa, arquivos, critério de pronto.
6. Trabalhe seguindo as regras do workspace (método ECC e anti-travamento). Ao terminar, rode `/entregar`.
