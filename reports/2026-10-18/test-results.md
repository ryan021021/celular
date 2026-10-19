# Resultados de testes — 2026-10-18/19

Todos executados de verdade; saídas resumidas abaixo.

| Teste | Onde | Resultado |
|---|---|---|
| Suíte do painel (`node --test test/*.test.mjs`) | A13, worktree separado | 44/44 passaram |
| `/health` sem credencial | PC → rede | 200 `{"ok":true,"service":"server-box"}` |
| `/api/monitor` sem credencial | PC → rede | 401 |
| `/` sem credencial | PC → rede | 303 para `/login` |
| `/status.html` sem credencial | PC → rede | 303 |
| Login com token errado | PC → rede | 401 |
| `/api/monitor` com Bearer correto | PC → rede | 200 |
| Painel com cookie obtido no login | PC → rede | 200 |
| Limite de tentativas (3 erros com `maxFails=3`) | teste automatizado | 4ª tentativa = 429 |
| Cookie forjado | teste automatizado | 401 |
| Deploy normal (`git push a13 celular`) | PC → A13 | testes ok, painel reiniciado em `2c2ebdc`, 9 s |
| Deploy quebrado de propósito (`throw` em `monitor.js`) | PC → A13 | testes falharam → ROLLBACK para `2c2ebdc` em 7 s; `/health` 200 durante e depois |
| Push de branch que não é produção | PC → A13 | "nada reiniciado" |
| Host keys pelo cabo USB vs `known_hosts` | PC | 3/3 iguais |
| Login SSH com senha | PC | recusado (`Permission denied (publickey)`) — teste da sessão anterior, config efetiva reconferida com `sshd -T` |
| Backup + restauração | PC | SHA-256 ok; 129 arquivos; painel clonado do backup = commit de produção |
| Vigia de alertas depois do token | A13 | estado normal, sem falso alarme |

Testes de sessões anteriores que seguem valendo (não repetidos neste lote): reboot com volta completa em 136–137 s; painel `kill -9` volta em ~1 s; alerta CRÍTICO em 100 s e Recuperado em 60 s.

Não testado neste lote: reboot depois do debloat do Google; vigia sem internet; Tailscale.
