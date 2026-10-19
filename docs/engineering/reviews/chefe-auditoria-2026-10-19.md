# Auditoria do CHEFE — 19/10/2026

Visão geral do projeto, verificação da revisão do Gemini (T19) e o que precisa ficar verde antes do próximo deploy.

## Estado agora
- **A13 fora do ar desde ~11:37.** Ele não responde a ping, não tem as portas 8022/8080/5555 abertas em nenhum IP da rede 192.168.1.x e não aparece no ADB. O ADB do PC vê outro aparelho como `unauthorized`, com serial fora dos perfis (provavelmente o A21s ou o Oppo). Hipótese: o `reativar_apps_essenciais.ps1` (10:18) religou a Assistência do aparelho (`com.samsung.android.lool`: reinício automático, apps em suspensão) e a Play Store. Só dá para confirmar olhando o aparelho.
- **Regressão da QA:** VERDE (raiz `a902583`), com a regra Desktop/serial em 0 depois da T39.
- **Painel:** 0 dependências npm, então o risco de cadeia de suprimentos é mínimo. O branch `claude/painel-v2` já tem `nosniff`, `X-Frame-Options`, `Referrer-Policy` e CSP.
- **Worktrees do painel:** `server-box` (celular f9ad723, produção), `-v2` (BACK, cee4e50), `-front` (FRONT, 79373e9), `-gemini` (sem commits novos; T38 bloqueada).
- **Arquivos sem dono no git:** `reports/server_audit_2026-10-19/` (T46) e uma linha alterada em `docs/ARCHITECTURE.md` (de outra sessão).

## Veredito dos achados críticos e altos da T19
| G | Gemini | CHEFE | Motivo | Tarefa |
|---|---|---|---|---|
| 1 | Crítica | **Confirmado, crítico** | `Step-Push` só envia `server/termux` e o painel; `agentops` não aparece no `deploy.ps1`. Uma instalação nova fica sem AgentOps | T42 |
| 2 | Crítica | Já tratado | backup sem `egress` = Q6 | T36 (TESTING) |
| 3 | Alta | **Confirmado, alto** | `worker.mjs:115` manda `output` inteiro; `server.mjs:26` recusa corpo > 32 KB. Resultado grande se perde e a tarefa repete até falhar | T43 |
| 4 | Alta | Rebaixado: baixo | campos de lease ficam velhos no reenfileiramento, mas `report`/`expireLeases` checam `status`, então não há efeito funcional | T44 |
| 5 | Alta | Rebaixado: médio | `take()` para em 256 KB e o `JSON.parse` falha: uma execução boa vira falha. Só ocorre em saída muito longa | T44 |
| 6 | Alta | Rebaixado: baixo | `claude.exe` vem primeiro no PATH (`~/.local/bin`); o canário da QA rodou o worker real | — (nota) |
| 7 | Alta | Rebaixado: médio | o watchdog cobre `sshd` e `server-box`; os outros 4 serviços ficam só com o runsv, que já reergue em queda. Falta só o caso "down/travado" | T45 |

Médios e baixos (G8–G20): triagem na T47.

## Distribuição
- **ORQ:** T42 (prioridade 1), T43, T45. Tudo testável no PC com o A13 offline.
- **BACK:** T41 backend entregue (`3435087`, 139 testes); agora T44; T37 só falta deploy.
- **FRONT:** integrar e revisar o backend da T41 (`3435087`). T28 espera o A13.
- **QA:** revisar a T39, conferir T46 e revisar T42–T45.
- **GEM-IDE:** responder o handoff `serial-e-tweaks` (T40, A13 offline, T38).
- **Ryan:** olhar o A13 (tela, bateria, Wi-Fi) e autorizar a depuração USB no aparelho do cabo.

## Portão de deploy (vale para o próximo `git push a13 celular`)
1. A13 online e lock `a13-servidor.lock` criado.
2. `node tools/qa/regressao.mjs` VERDE e testes do hook 100% (hoje 130/130 em f9ad723).
3. Backup novo **antes** do deploy (T36/Q6), com prova de restauração.
4. Revisão cruzada aprovada de cada branch que entra (nunca o próprio autor).
5. Segredos 0 na varredura e nenhuma dependência nova sem `npm audit` limpo.
6. Plano de volta: o hook faz rollback; conferir `/health` e `sv status` dos 7 serviços depois.
