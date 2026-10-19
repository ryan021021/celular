# Riscos priorizados — OMNISERVER fase zero (T58)

Fontes: `docs/audit/current-state.md` (T55), `docs/audit/test-baseline.md` (T56), `docs/qa/test-matrix.md` (T64). Cada risco tem evidência e tarefa.

| # | Risco | Evidência | Prioridade | Tarefa |
|---|---|---|---|---|
| 1 | Restauração só testada à mão e com backup do A13 | matriz R1; `reconstrucao.mjs` 19/19 só no A13 | P0 | T66 |
| 2 | `boot.sh` e a ordem do runit sem teste; após reinício o A15 só sobe depois do 1º desbloqueio | matriz R2; teste de reinício 19/10: /health 200 ~35 s após desbloquear | P0 | T67 |
| 3 | Valores inventados apresentados como medida (ex.: rotinas com disco/bateria fixos) | matriz R5; revisão da T60 | P0 | T68, T60 |
| 4 | Sem comando de diagnóstico único (§20.3) | matriz R4/R12 | P0 | T69 |
| 5 | Perfis sem schema: erro de digitação passa calado | matriz R7 | P1 | T70 |
| 6 | Logs do AgentOps sem redaction testada | matriz R10 | P1 | T65 |
| 7 | Sem registro de capacidades nem /ready consistentes | matriz R8/R9 | P1 | T62, T63 |
| 8 | Servidor depende de IP fixo sem reserva DHCP no roteador | profiles/a15.json (192.168.1.164) | P2 | Ryan (roteador) |
| 9 | `state.json` do AgentOps sem versão nem migração | matriz R11 | P2 | depois de T65 |
