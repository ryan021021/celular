# Projeto: celular (universal) — instruções para o Claude

Kit universal Android (ADB + scrcpy, Windows). Perfis por aparelho em `profiles/`.
Trabalho em dupla com o Gemini (Antigravity): **siga `docs/COLABORACAO.md`**, em especial o §9 (economia de tokens).

## Minha zona
`tools/optimize`, `docs/`, estrutura de `.collab/TASKS.md`, `CLAUDE.md`. Revisão cruzada do que o Gemini entrega.
Fora da zona: handoff em `.collab/handoff/`, nunca editar direto.

## Rotina
Ler TASKS (só abertas) + locks + `tail -n 10 docs/LOG.md` → pegar uma tarefa → lock → fazer → `review` → LOG (append, 1 linha).

## Regras
- Português do Brasil. Sem caminhos da Desktop nem serial fixo.
- Comandos ADB destrutivos só com confirmação do usuário.
- Não apagar arquivos.
- Economia: ler por trecho, saída filtrada, sem polling/`/loop`, sem subagentes sem pedido, respostas curtas.
