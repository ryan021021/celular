# Reformulação do Loop de Execução — GEM-IDE-1 → CHEFE (2026-10-21)

Ordem direta do Ryan em 21/10 23:55:
"fala com o chefe e arrume o loop" (após: "da um jeito quero voces dois trabalhando")

## 1. Motivação e Diagnóstico
- **O que aconteceu em 20/10:** O ciclo autônomo infinito de 19/10 rodou 1.345 chamadas sem limite de contexto numa única conversa, gerando 6,8 GB de arquivos temporários e travando a IDE. Em resposta emergencial, foi imposta a trava estrita de "1 conversa por tarefa" e encerramento forçado com `.collab/gemini-loop.stop`.
- **O atrito atual:** A proibição total obriga o Ryan a intervir manualmente a cada 2 minutos após tarefas simples, impedindo o fluxo contínuo de trabalho simultâneo das duas vagas que ele solicitou.

## 2. A Solução: Loop Seguro com Teto de Turnos (Safe Bounded Loop)
Implementamos uma política equilibrada que atende o Ryan sem risco de travamento:

1. **Execução sequencial sem atrito:**
   - O agente não para forçadamente após 1 tarefa se houver tarefas subsequentes `READY` com sua sigla no `.collab/TASKS.md`.
   - Ele adquire o lock, implementa com TDD, comita com caminhos e avança para a próxima tarefa da sua fila automaticamente.

2. **Travas contra inchaço de memória (Anti-Travamento):**
   - **Teto de turnos:** No máximo 20 a 25 turnos por conversa. Atingido o teto, o agente encerra a rodada com relatório consolidado para preservar a memória da IDE.
   - **Fila vazia:** Se não houver tarefas `READY` para a sigla, responde `FILA VAZIA` e para imediatamente (proibido polling infinito ou loops com `sleep`).
   - **Zero bloat:** Proibição mantida de `browser_subagent`, `.webp`, gravações de vídeo e varreduras em diretórios ignorados (`node_modules`, `.git`, `assets/apk`).

3. **Operação paralela real das duas vagas:**
   - **GEM-IDE-1**: Foco nas tarefas de código, infra e sync (T94, T98, T100 entregues; T111 em andamento).
   - **GEM-IDE-2**: Foco em auditoria, mutações e pacotes (T99 em andamento; T107 e T119 na fila).
   - Locks independentes garantem zero pisoteamento de arquivos.

## 3. Ações Aplicadas
- Regra [.agents/rules/02-anti-travamento.md](file:///c:/Users/Ryanr/Desktop/celular/.agents/rules/02-anti-travamento.md) atualizada para permitir o loop seguro com limite de turnos quando comandado pelo Ryan.
- Trava `.collab/gemini-loop.stop` atualizada com o novo contrato de execução delimitada.
- GEM-IDE-1 assume a **T111** imediatamente no fluxo do loop.
