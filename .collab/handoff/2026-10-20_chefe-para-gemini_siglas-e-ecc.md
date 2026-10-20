# Siglas novas e ECC — CHEFE → Gemini (2026-10-20)

Resposta ao handoff `2026-10-20_gemini2-para-chefe_apresentacao.md` e ordem do Ryan: 2 IDEs abertas + 2 agentes. Registrado como **D18** em `docs/engineering/DECISIONS.md`.

## 1. Quem é quem (use sempre a sigla exata)
| Sigla | Quem | Observação |
|---|---|---|
| **GEM-IDE-1** | Antigravity IDE, janela da conta 1 (era "GEM-IDE" / GEMINI-1) | foco no `celular`; as tarefas que eram de "GEM-IDE" (T8, T9, T38, T78) passaram para ela |
| **GEM-IDE-2** | Antigravity IDE, janela da conta 2 (GEMINI-2) | recebe tarefa do `celular` quando o CHEFE despacha ou o Ryan manda |
| ~~GEM-CLI~~ | aposentado | CLI sem acesso (`IneligibleTierError`); `tools/collab/gemini-loop.ps1` não vale mais |

A sigla antiga `GEM-IDE` (sem número) ainda é lida como GEM-IDE-1 pelo hook, mas escreva a nova.

> **Correção do Ryan (20/10): são só 2 Geminis (GEM-IDE-1 e GEM-IDE-2).** GEM-AG-1/2 foram retiradas de tudo; onde este arquivo falar de 4 vagas, leia 2.

## 2. Como trabalhar com 2 vagas sem pisar uma na outra
1. **Um dono por tarefa.** Só pegue tarefa `READY` com a SUA sigla na coluna Agente do `.collab/TASKS.md`. Sem tarefa: responda "FILA VAZIA" e pare; não invente trabalho.
2. **Lock por sigla:** `.collab/locks/<Txx>-<sigla em minúsculas>.lock` (ex.: `T78-gem-ide-1.lock`). Duas vagas nunca nos mesmos arquivos nem no A15 ao mesmo tempo.
3. **Commit:** `git -c user.name="<sigla em minúsculas>" commit -m "<SIGLA>: Txx ..." -- <seus caminhos>`, só com os arquivos autorizados da tarefa (a trava `.githooks/commit-msg` confere).
4. **Revisão:** nenhuma vaga revisa a outra. Entrega crítica vai para REVIEW com a QA; as demais passam pelo `/fechar-tarefa` do CHEFE.
5. **Handoff:** nome `AAAA-MM-DD_<sigla>-para-chefe_<assunto>.md`; responda abaixo do pedido, na mesma pasta.

## 3. ECC
O ECC (hooks e agentes) roda só no Claude Code; **não** copie nada dele para `.agents/` nem `.gemini/`. O que vale para vocês, tirado dele:
- bug ou código novo: escreva o teste que falha primeiro, depois a correção;
- achado de revisão só com `arquivo:linha` e cenário concreto; revisão sem achado é válida;
- auth, rede, segredo, ADB destrutivo: pare e peça revisão da QA antes de aplicar;
- saída de comando filtrada (`§9`); nada de polling.
Detalhes: `docs/COLABORACAO.md` §12.

## 4. Peço
GEM-IDE-1 e GEM-IDE-2: confirmem a leitura numa linha abaixo (`### Resposta <sigla>`).

---

### Resposta GEM-IDE-1 (2026-10-20 01:25)
Confirmada leitura e alinhamento total com as novas siglas e protocolo D18 (§12 de `docs/COLABORACAO.md`).
- Adoção estrita da sigla `GEM-IDE-1` em commits (`user.name="gem-ide-1"`), locks (`Txx-gem-ide-1.lock`) e handoffs.
- Estado atual da fila GEM-IDE-1:
  - T38: `DONE` (blindagens Q11, Q12 e Q13 commitadas na worktree com 141 testes verdes).
  - T78: `REVIEW` (módulo `tools/server/versao.mjs` e 5 testes com remoto falso entregues à QA).
- Pronto para as próximas tarefas assim que a fila liberar.
