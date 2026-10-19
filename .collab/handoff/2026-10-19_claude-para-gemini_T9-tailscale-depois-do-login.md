# T9 Tailscale: o que fazer depois do login do Ryan + 1 pergunta — FRONT (claude) → GEM-IDE (2026-10-19 02:05)

## Contexto
O Ryan quer acessar o servidor **de qualquer lugar** (ele nos dados móveis ou em outro Wi-Fi), com segurança máxima e **sem nada exposto na internet**, e só se for de graça.
- Conferido em https://tailscale.com/pricing (19/10/2026): plano **Personal = $0**, até 6 usuários, aparelhos ilimitados, uso não comercial.
- Tailscale = WireGuard entre os aparelhos do Ryan: nenhuma porta no roteador, nada público.
- O A13 não tem chip: fica no Wi-Fi; quem pode estar nos dados móveis é o Ryan.
- Hoje o painel (8080), o SSH (8022) e o AgentOps (8090) escutam em `0.0.0.0` (só IPv4). Com o Tailscale eles passam a responder também pelo IP `100.x`, então **a ACL é a barreira** (sem ela, qualquer aparelho do tailnet chega nas portas).

## Passo 1 — Ryan (humano, ninguém faz por ele)
1. Espelhar o A13 (`ESPELHAR_TELA.bat`), abrir o app Tailscale e tocar em **Log in**. Entrar com a conta dele (Google, GitHub ou Microsoft). Se o app mostrar "entrar de outro aparelho", dá para concluir pelo navegador do PC.
2. Instalar o Tailscale no PC e no celular dele com **a mesma conta**.

## Passo 2 — GEM-IDE (com o lock `.collab/locks/a13-servidor.lock`, só leitura)
1. IP do A13 no tailnet: `adb shell ip -4 addr show tailscale0` (ou `ip addr | grep 100.`). Anotar o `100.x`.
2. Do PC, com o Tailscale ligado:
   - `curl -s -o NUL -w "%{http_code}" http://100.x:8080/health` → **200**;
   - `ssh -p 8022 u0_a271@100.x echo ok` → **ok**. A host key é a mesma do `known_hosts`; se pedir para aceitar uma nova, **pare e avise**.
3. Conferir que nada abriu para a internet: `/health` pelo IPv6 global continua sem resposta (T13 segue com o Ryan).
4. Registrar em `docs/LOG.md` (só acrescentar no fim) e mudar o T9 no `.collab/TASKS.md`.

## Passo 3 — ajustes que o Ryan faz no painel do Tailscale (passe para ele)
- **Tailscale SSH: desligado.** Usamos o sshd próprio, só com chave.
- **Aprovação de aparelhos: ligada.** Aparelho novo só entra com a aprovação dele.
- **Marcar o A13 com a tag `tag:servidor`.** Machines → A13 → Edit ACL tags.
- **Política de acesso:** só os aparelhos do Ryan chegam às portas do servidor; o resto é negado. Rascunho para colar em Access controls (conferir no editor antes de salvar):
```json
{
  "tagOwners": { "tag:servidor": ["autogroup:admin"] },
  "grants": [
    { "src": ["autogroup:member"], "dst": ["tag:servidor"], "ip": ["tcp:8080", "tcp:8022", "tcp:8023"] }
  ],
  "ssh": []
}
```
- **Não** transformar o A13 em exit node nem em subnet router.

## Passo 4 — ajuste no Android (o Ryan faz, é configuração de segurança do aparelho)
Configurações → Conexões → Mais configurações → VPN → Tailscale (engrenagem) → **VPN sempre ativa: LIGADA**. Deixe "Bloquear conexões sem VPN" **DESLIGADO**: se o Tailscale cair, o servidor continua na rede de casa. O Tailscale já está na whitelist de bateria.

Depois disso o painel fica em `http://100.x:8080` (ou pelo nome MagicDNS do A13), cifrado pelo WireGuard. O SFTP pelo Tailscale é a T25 (ORQ).

## Pergunta (responda mesmo que não tenha sido você)
Às 01:35, alguém reescreveu `server/panel/server-box-front/test/console-ui.test.mjs` (harness de DOM, ~800 linhas) **dentro da worktree do FRONT**, sem combinar. Foi você?
- Se foi: a ideia era boa. Integrei como `test/console-dom.test.mjs`, com uma correção: os timers do harness prendiam o Node e o `node --test` não terminava, o que travaria o hook de deploy do A13.
- Regra (docs/COLABORACAO.md): cada `server/panel/server-box-*` é só da sessão que a criou. Para contribuir, use handoff.

Responda acrescentando no fim deste arquivo e marque RESOLVIDO no topo quando o T9 terminar.
