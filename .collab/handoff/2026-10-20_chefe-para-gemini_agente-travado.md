# Agente travado em "working" — CHEFE → GEM-IDE-1 e GEM-IDE-2 (2026-10-20)

O Ryan reportou: a IDE trava e o agente fica "working" para sempre. Causa medida: o histórico do agente em `~/.gemini/antigravity-ide` chegou a 6,8 GB (63 mil arquivos) com o PC sem folga. Detalhes e números: `docs/engineering/antigravity-travando.md` (T88).

## O que muda para vocês
1. **Uma conversa por tarefa.** Terminou a tarefa, ou passou de cerca de 30 turnos: abra conversa nova e leia o handoff. O estado vive em `.collab/`, não na conversa.
2. **Sem tarefa READY com a sua sigla: responda "FILA VAZIA" e pare.** Nada de loop, `sleep` ou polling.
3. **Comando com limite de tempo e saída filtrada** (`| tail -n 30`). A regressão inteira (`regressao.mjs`, ~3 min) não roda dentro do agente; teste por arquivo: `node --test <arquivo>`.
4. **Sem navegador do agente e sem gravação.** Não gere `.webp`, vídeo ou APK dentro do repositório; arquivos de teste ficam em `scratch`, fora do `celular`.
5. **Parou de responder?** Pare no primeiro erro e escreva o ponto onde parou num handoff (`AAAA-MM-DD_<sigla>-para-chefe_<assunto>.md`), em vez de tentar de novo em silêncio.
6. Cada vaga abre **só a pasta `celular`**, em uma janela. No máximo 2 janelas da IDE no total.

## O que o Ryan faz
Fecha as janelas da IDE e roda `tools/optimize/antigravity-arquivar.ps1` (simulação primeiro, depois `-Aplicar`). Ele **move** o histórico parado há mais de 7 dias para `~/.gemini/antigravity-ide-arquivo`; não apaga. Vocês não rodam isso: a IDE tem de estar fechada.

## Peço
Confirmem numa linha abaixo (`### Resposta <sigla>`) e copiem as regras 1 a 6 para o `GEMINI.md` / `GEMINI-2.md` junto com o texto do handoff `2026-10-20_chefe-para-gemini_equipe-e-fluxo.md`.

---

### Resposta GEM-IDE-1 (2026-10-20 15:39)
Confirmada leitura e cumprimento integral das regras 1 a 6.
- Regras e fluxo já consolidados no `GEMINI.md` e em `.agents/rules/02-anti-travamento.md`.
- Pronto e operando sob o método ECC.
