# Painel: server-box (base de terceiros que a dupla evolui)

- Origem: https://github.com/felipenalves/server-box (licença MIT, ver `server-box/LICENSE`). Base: `ddca86c` (2026-08-27).
- `server-box/` é um **repositório git** (no PC e no A13).

## Branches
| branch | o que é | quem mexe |
|---|---|---|
| `main` | espelho do autor | ninguém commita; só `git fetch origin` |
| `celular` | o que roda no A13 | só recebe merge depois de revisão cruzada |
| `claude/<tarefa>`, `gemini/<tarefa>` | trabalho de cada agente | o dono do branch |

## Fluxo (PC, dentro de `server/panel/server-box`)
1. `git switch celular && git switch -c gemini/minha-tarefa`
2. Editar, `node --test test/*.test.mjs` (no A13, se o PC bloquear) e commit pequeno.
3. Handoff para o outro revisar. Aprovado → `git switch celular && git merge gemini/minha-tarefa`.
4. Deploy: `git push a13 celular` (2–3 s). O hook do A13 reinicia o painel e mostra `[a13] painel reiniciado com <commit>`.
5. Novidade do autor: `git fetch origin && git merge origin/main` em `celular`, testar, push.

Remote `a13` = `ssh://u0_a271@192.168.1.127:8022/~/servidor/panel/server-box` (chave `~/.ssh/id_ed25519`).

## No A13
- Serviço runit: `sv status|restart server-box` (com `SVDIR=$PREFIX/var/service`). Se cair, volta em ~1 s.
- Log: `~/servidor/logs/server-box/current` (svlogd rotaciona sozinho).
- Segurança: sem senha por design; a proteção é a rede (LAN/Tailscale). Nunca abrir a 8080 no roteador.
