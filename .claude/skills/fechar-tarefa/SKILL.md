---
name: fechar-tarefa
description: Fecha a sua parte de uma tarefa do projeto celular — verifica, muda o estado no TASKS, escreve 1 linha no LOG e faz commit só dos seus arquivos.
argument-hint: "<Txx> <REVIEW|DONE> <evidência curta>"
---
Argumentos: $ARGUMENTS

1. **Verificar:** chame o subagente `verificador` com os arquivos que você mudou. VERMELHO → não feche; corrija primeiro.
2. **TASKS:** em `.collab/TASKS.md`, na linha da tarefa, troque a coluna Estado e acrescente a evidência (commit e teste) na coluna Evidência. Use Edit na linha, sem reescrever o arquivo.
   - DONE só depois da revisão cruzada aprovada: mova a linha inteira para o fim de `.collab/TASKS_FEITAS.md`.
3. **LOG:** acrescente sem ler o arquivo:
   `echo "- $(date '+%Y-%m-%d %H:%M') · <agente> · <Txx>: <o que mudou, até ~250 caracteres> · <arquivos>" >> docs/LOG.md`
4. **Commit** só dos seus arquivos: `git add -- <arquivos> .collab/TASKS.md docs/LOG.md` e depois `git -c user.name="<agente>" commit -m "<AGENTE>: <Txx> ..." -- <os mesmos arquivos>`. Nunca `git add -A`, `reset --hard` nem `stash` sem tag.
5. Apague o seu lock, se tiver um. Avise o CHEFE em uma linha só se ele precisar agir: aprovar, mandar ao Ryan ou desbloquear outra tarefa.
