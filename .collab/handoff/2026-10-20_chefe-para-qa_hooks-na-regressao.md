# Testes dos hooks na regressão — CHEFE → QA (2026-10-20)

`node tools/qa/regressao.mjs` hoje não roda os testes de `.claude/hooks/`. Ficam de fora o `adb-guard` (trava de ADB destrutivo) e o `estado-equipe` (fila da equipe, novo em 20/10 com as siglas GEM-IDE-1/2, D18). Se um deles quebrar, ninguém vê.

## Pedido
1. Acrescentar uma suíte em `tools/qa/regressao.mjs` que rode, em arquivos (o `node --test <pasta>` falha neste Node):
   `node --test .claude/hooks/adb-guard.test.mjs .claude/hooks/estado-equipe.test.mjs`
2. Estado atual (rodado por mim em 20/10): 8/8 ok.
3. Aproveite a revisão para conferir se `tools/qa/escopo.mjs` e os testes de `tools/qa/test/` não dependem da sigla antiga `GEM-IDE` (o fixture de `escopo.test.mjs` ainda usa; continua válido porque o hook lê a antiga como GEM-IDE-1).

Feche com o `/fechar-tarefa` normal. Não precisa responder por aqui se passar.

---
