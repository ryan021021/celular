---
name: rotina
description: Início de turno de qualquer sessão do projeto celular — tarefas abertas, locks, handoffs pendentes e fim do LOG, gastando o mínimo de tokens.
argument-hint: "[sigla do agente, ex.: BACK]"
---
Rode **um** comando só e leia a saída. Não abra os arquivos inteiros.

```bash
grep '^| T' .collab/TASKS.md | awk -F'|' '{printf "%s|%s|%s|%s\n",$2,substr($3,1,70),$4,$7}'; echo '--- locks'; ls .collab/locks/*.lock 2>/dev/null && head -c 300 .collab/locks/*.lock; echo '--- handoffs sem RESOLVIDO'; for f in .collab/handoff/*.md; do head -3 "$f" | grep -q RESOLVIDO || echo "$f"; done; echo '--- log'; tail -n 5 docs/LOG.md | cut -c1-200; git log --oneline -5
```

Depois:
1. Filtre o que é de "$ARGUMENTS" (ou da sua sigla em `.collab/TASKS.md`): uma tarefa em IN_PROGRESS/REVIEW sua, ou a próxima READY com você como agente.
2. Se uma tarefa sua estiver BLOCKED por ação humana, não insista: diga ao CHEFE em uma linha.
3. Sem tarefa sua? Encerre o turno sem gastar mais nada (§9).
