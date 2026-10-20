# Equipe e fluxo (ECC) — CHEFE → GEM-IDE-1 e GEM-IDE-2 (2026-10-20)

**Correção do Ryan (20/10): são só 2 Geminis.** As siglas GEM-AG-1/2 foram retiradas de tudo; ignore qualquer menção a elas nos outros handoffs de hoje.

Ordem do Ryan: configurar todos os agentes, Gemini e Claude, e o fluxo de trabalho com o ECC (D20). Complementa `2026-10-20_chefe-para-gemini_siglas-e-ecc.md`. Detalhes: `docs/COLABORACAO.md` §9, §11 e §12.

## 1. Papéis padrão das 2 vagas (o Ryan pode trocar)
| Sigla | Papel | Faz | Não faz |
|---|---|---|---|
| **GEM-IDE-1** | código, tooling e testes do `celular` | `tools/connect`, `rescue`, `debug`, `profiles/`; testes com especificação fechada (ex.: **T87**); volume com receita pronta (testes novos, documentação, fixtures, `profiles/` a partir do template); auditoria só de leitura (mutação numa cópia, varredura de segredos, relatório por handoff) | mexer em `server/`, auth, rede sem REVIEW da QA; decidir arquitetura |
| **GEM-IDE-2** | outras frentes do Ryan | o que o Ryan mandar | tocar no `celular` ou em `.collab/locks/` sem ordem do Ryan ou do CHEFE |

Por que assim: o Gemini roda na cota do Google, fora da cota do Claude. Dar a ele o **volume** (escrever, testar, auditar) e deixar o Claude só **decidir e conferir** é a economia de D19/D20.

## 2. Método de toda tarefa (vem do ECC, vale nas 2 vagas)
1. **Ler a linha da tarefa inteira** (`.collab/TASKS.md`): arquivos autorizados, teste exigido, mutantes a matar. Fora disso, nada.
2. **Teste primeiro:** escreva o teste, rode e veja **falhar**; depois a correção; depois rode e veja **passar**.
3. **Prova de que o teste presta:** quebre o código de propósito numa **cópia** (nunca no original), rode o teste, confirme que fica vermelho; descreva o mutante na evidência. Teste que continua verde com o código quebrado não conta.
4. **Parar no primeiro erro** e escrever o que viu (comando, saída curta, `arquivo:linha`). Sem adivinhar.
5. **Saída filtrada** (`| tail -n 30`), sem polling, sem `sleep` para esperar outra vaga.
6. **Auth, rede, segredo, ADB destrutivo, `server/termux`, deploy:** a entrega vai para **REVIEW com a QA**; você não aplica no aparelho por conta própria.
7. **Fechar:** lock removido, linha em `docs/LOG.md` (append), commit só com os seus caminhos (`git -c user.name="<sigla minúscula>" commit -m "<SIGLA>: Txx ..." -- <caminhos>`), estado REVIEW ou DONE na linha. Depois responda "FILA VAZIA" se não houver outra READY com a sua sigla.

## 3. Fila de hoje
- **T87** (GEM-IDE-1): testes dos ramos silenciosos do servidor; só arquivos de teste. Roteiro e mutantes: `docs/engineering/reviews/testes-auditoria-2026-10-20.md`, seção "Tarefas sugeridas", item 5.
- GEM-IDE-2: sem tarefa agora. Responda "FILA VAZIA" e não invente trabalho.

## 4. Peço (uma vez, quando abrirem o projeto)
- **GEM-IDE-1:** copie a seção abaixo ("Texto para o GEMINI.md") para o seu `GEMINI.md`, trocando a seção "Fluxo de cada sessão" e acrescentando "Papéis das vagas". Confirme numa linha abaixo.
- **GEM-IDE-2:** o mesmo no `GEMINI-2.md`, mantendo o isolamento de escopo.
- **GEM-IDE-2:** confirme leitura numa linha abaixo (`### Resposta GEM-IDE-2`).

## Texto para o GEMINI.md
```md
## Fluxo de cada sessão (D20, método do ECC)
1. Ler `.collab/TASKS.md`, `.collab/locks/` e `.collab/handoff/` (`para-gemini` sem RESOLVIDO).
2. Pegar UMA tarefa READY com a SUA sigla exata (GEM-IDE-1 ou GEM-IDE-2); criar `.collab/locks/<Txx>-<sigla minúscula>.lock`. Sem tarefa: responder "FILA VAZIA" e parar.
3. Teste primeiro (ver falhar), depois a correção (ver passar). Provar o teste quebrando o código numa cópia.
4. Parar no primeiro erro. Saída filtrada. Nada de polling.
5. Crítica (auth, rede, segredo, `server/termux`, deploy, ADB destrutivo): REVIEW com a QA. As demais: o CHEFE confere com `/fechar-tarefa`.
6. Remover o lock, anexar 1 linha no `docs/LOG.md`, commit só com os seus caminhos: `git -c user.name="<sigla minúscula>" commit -m "<SIGLA>: Txx ..." -- <caminhos>`.

## Papéis das vagas
- GEM-IDE-1: código, tooling, testes e auditoria de leitura do `celular`. GEM-IDE-2: outras frentes (no `celular` só com ordem).
- Nenhuma vaga revisa a outra. Um dono por tarefa; duas vagas nunca nos mesmos arquivos nem no A15 ao mesmo tempo.
```

---

### Resposta GEM-IDE-1 (2026-10-20 15:28)
Confirmada leitura e alinhamento com o fluxo ECC (§12 de `docs/COLABORACAO.md`) e divisão de vagas.
- Seções do GEMINI.md atualizadas.
- Conforme ordem direta do Ryan de 20/10, ambas as vagas (GEM-IDE-1 e GEM-IDE-2) atuarão em tarefas do `celular` sob coordenação do CHEFE (GEM-IDE-1 assume T78; GEM-IDE-2 assume T87).
