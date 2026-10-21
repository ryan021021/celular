# GEM-IDE-1 → CHEFE: Loop Arrumado e Execução da T111 em Curso (2026-10-22)

Recado formal em atendimento à ordem direta do Ryan:
"fala com o chefe e arrume o loop"

---

## 1. O que foi Arrumado no Loop
- **O problema original (20/10):** Um ciclo passivo/infinito de 1.345 chamadas em uma única conversa consumiu gigabytes e travou a IDE. A reação emergencial impôs "1 tarefa por conversa e pare", o que exigia intervenção humana a cada 2 minutos e impedia o trabalho simultâneo contínuo das duas abas do Gemini.
- **Ajuste operacional ("Loop Seguro Delimitado"):**
  1. O agente pode pegar e encadear tarefas sequenciais `READY` da sua sigla sem parar a cada commit.
  2. Cada conversa possui um **teto de segurança de 20 a 25 turnos**. Atingido o teto, o agente encerra a rodada com relatório consolidado para reciclar o contexto e manter a IDE rápida e leve.
  3. Proibido polling passivo ou `sleep` sem trabalho: quando a fila estiver vazia para a sigla, responde `FILA VAZIA` e para imediatamente.
  4. Mantida a proibição absoluta de `browser_subagent`, `.webp`, capturas de tela e varreduras em pastas pesadas (`node_modules`, `.git`, `assets/apk`).

## 2. Status das Abas Gemini (Sessões Simultâneas)
- **GEM-IDE-1 (esta aba):**
  - T94 (GEMINI.md enxuto) -> `REVIEW`.
  - T98 (ryx docs_sync / regra 13) -> `DONE` (validado pela QA).
  - T100 (ryx log JSON estruturado) -> `DONE` (validado pela QA).
  - **T111 (ryx estados de nó e severidades no doctor)** -> `IN_PROGRESS` (executando neste ciclo com TDD).
- **GEM-IDE-2 (aba 2):**
  - T99 (auditoria de mutação em backup e permissions) -> `REVIEW`.
  - T119 (lint no PC / CI do ryx) e T107 (fixtures de perfil) -> Próximas na fila dele.

## 3. Próximos Passos Imediatos
- GEM-IDE-1 conclui a implementação e suíte de testes de T111 no `ryx-termux-toolkit`.
- Provas de mutação (heartbeat vencido -> UNKNOWN e nunca HEALTHY; NO_COLOR; tela estreita de 40 colunas).
- Commit com caminhos explícitos e envio de T111 para `REVIEW`.
