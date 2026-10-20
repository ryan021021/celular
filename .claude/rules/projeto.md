# Regras deste projeto (valem sobre as de `.claude/rules/ecc/`)

Quando uma regra do ECC conflitar com esta, vale esta.

## Commits
- Mensagem: `<SIGLA>: <Txx> <resumo>` (ex.: `CHEFE: T86 ...`), nunca `feat:` / `fix:` do `ecc/common/git-workflow.md`.
- Sempre com caminhos: `git commit -m "..." -- <arquivos>` (o índice do git é compartilhado entre as sessões).
- A trava `.githooks/commit-msg` (`tools/qa/escopo.mjs`) confere o escopo da tarefa pelo `Txx` e os comandos perigosos. Não contorne.

## Testes e cobertura
- Rode testes por arquivo: `node --test <arquivo1> <arquivo2>` (a forma por pasta falha neste Node). O portão é `node tools/qa/regressao.mjs`.
- A meta de 80% do ECC não se aplica como número: vale "o teste falha quando o código quebra" (mutação), conforme a auditoria de 20/10.

## Agentes e economia
- Use primeiro os subagentes do projeto (`.claude/agents/`). Os do ECC (`ecc:*`) só nos passos e nas condições da tabela do `docs/COLABORACAO.md` §12; fora dela, só com pedido do Ryan. Modelos e custos: §9 e §10.
- Código novo ou bug: teste que falha primeiro, depois a correção (`tdd-workflow`). Em tarefa com 3+ arquivos, o CHEFE planeja antes (`/ecc:plan`).
- Não troque de modelo nem de esforço no meio da sessão.
