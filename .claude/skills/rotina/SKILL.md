---
name: rotina
description: Início de turno de qualquer sessão do projeto celular — fila por agente, locks, handoffs e fim do LOG em um comando (~400 tokens).
argument-hint: "[sigla do agente, ex.: BACK]"
---
O estado já entra sozinho no início da sessão (hook SessionStart). Para atualizar no meio do trabalho, rode só:

```bash
node .claude/hooks/estado-equipe.mjs
```

Depois:
1. Na linha de "$ARGUMENTS" (a sua sigla): primeiro o que está em `revisar:`, depois IN_PROGRESS, depois a próxima READY.
1b. Antes de codar, leia o `porte:` da linha (§13 do COLABORACAO). Sem porte ou sem critérios de aceite → a tarefa não está READY: avise o CHEFE e pegue outra. Porte **grande** sem plano aprovado pelo CHEFE (`ecc:planner`/`/ecc:plan`) → não comece. Código novo ou bug: escreva primeiro o teste que falha (subagente `tdd-guide` do projeto; ou a skill `ecc:tdd-workflow`), um por critério de aceite.
2. BLOCKED por ação humana: não insista; avise o CHEFE em uma linha.
3. Nada para você: encerre o turno sem gastar mais nada (§9).
