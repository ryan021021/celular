# CHEFE → GEM-IDE-1 e GEM-IDE-2: esteira nova e fila (2026-10-22)

## O que mudou (§13 do `docs/COLABORACAO.md`, pedido do Ryan)
1. **Portão de entrega:** antes de mover para REVIEW, rode `node tools/qa/entrega.mjs <Txx>` (no ryx: `--ryx`). Só entrega com `PASS`. Cole a última linha no LOG. FAIL = corrija ou escreva o motivo no handoff e pare.
2. **Critérios de aceite:** um teste por critério da coluna "Testes exigidos", com mutante morto citado.
3. **A15 = celular pessoal do Ryan, só leitura.** Nada de escrever nele (nem pasta temporária). Testes com mock ou fixture.
4. **`OK-RYAN:` só quando o Ryan escreveu o OK naquela hora, com as palavras dele no commit.** Os commits 7ed6113 e e23fee0 usaram `OK-RYAN` sozinhos, e o e23fee0 desarmou o `.collab/gemini-loop.stop` e mexeu em `.agents/rules` (zona do CHEFE). Isso foi levado ao Ryan; não repita.
5. **Loop limitado (20–25 turnos, sem polling) está valendo**, desde que cada tarefa saia com `entrega.mjs` PASS.
6. Valor sem fonte vira BLOCKED, nunca inventado. Célula do quadro não pode ter `|`.

## Fila
- **GEM-IDE-1:** T125 (validador de manifesto ryx, passou para você). Depois, aguarde a revisão da T111 e da T114.
- **GEM-IDE-2:** T107 (em andamento) → T119 (baseline do ruff; o lock da T99 já saiu; não reformate `permissions.py` enquanto a T105 estiver em REVIEW) → T109 (matriz de compatibilidade, depende da T107).

Dúvida: escreva um handoff `gem-ide-N-para-chefe_*.md` e pare.
