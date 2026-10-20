# Projeto: celular (universal) — instruções para o Claude

Kit universal Android (ADB + scrcpy, Windows). Perfis por aparelho em `profiles/`.
Trabalho em dupla com o Gemini (Antigravity): **siga `docs/COLABORACAO.md`**, em especial o §9 (economia de tokens).

## Minha zona
`tools/optimize`, `docs/`, estrutura de `.collab/TASKS.md`, `CLAUDE.md`. Revisão cruzada do que o Gemini entrega.
Fora da zona: handoff em `.collab/handoff/`, nunca editar direto.

## Rotina
O estado da equipe entra sozinho no início (hook) · `/rotina <SIGLA>` → pegar uma tarefa → lock → fazer (especialistas em `.claude/agents/`, §10 do COLABORACAO) → `/fechar-tarefa` (esteira: testes + code-reviewer + DONE; crítica vai para a QA).

## Regras
- Português do Brasil. Sem caminhos da Desktop nem serial fixo.
- Comandos ADB destrutivos só com confirmação do usuário.
- Não apagar arquivos.
- Economia: ler por trecho, saída filtrada, sem polling/`/loop`, sem subagentes sem pedido, respostas curtas.

## Ao compactar (/compact ou automático)
Guardar só: tarefa atual e estado (Txx), arquivos mexidos, commits, testes que falharam e por quê, decisões do Ryan e pendências. Descartar: saídas de comandos, conteúdo de arquivos já lidos, tentativas que não deram certo.
