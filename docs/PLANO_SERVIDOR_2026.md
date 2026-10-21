# Plano: servidor profissional no celular (2026)

Escrito pelo CHEFE em 21/10/2026, a partir do pedido do Ryan: tudo o que uma VPS tem, só por software, em
celular parado **ou pessoal**, com o aparelho continuando a funcionar normalmente e segurança de 2026.
Tarefas: T112–T120 no `.collab/TASKS.md`.

Os requisitos continuam na [spec OMNISERVER](spec/OMNISERVER_MASTER_SPEC.md) (D17). Este arquivo é o
roteiro do ponto A ao ponto B e acrescenta o que ela não tem: o **modo pessoal** e a **tabela de paridade
com VPS**. Onde a tabela abaixo cita catálogo, file manager, painel, rede, segurança ou laboratório de
aparelhos, vale o detalhe da OMNISERVER §8, §11, §13, §14, §15 e §18.

## Ponto A (medido no A15 em 21/10, só leitura)

- Serviços runit rodando: `sshd`, `sftp`, `server-box` (painel), `agentops`, `alertas`, `egress`, `crond`.
  73 GB livres. Bateria e temperatura legíveis pelo termux-api.
- Não instalado: proxy reverso/TLS (`nginx`, `caddy`), cifra (`age`, `openssl-tool`), banco de dados,
  `tailscale`, `proot-distro`. Acesso de fora da rede local: nenhum (T9, T13 bloqueadas).
- Painel com quatro cópias (`server/panel/server-box*`): é a "cara de gambiarra".
- `ryx`: CLI de manutenção e capacidades com frescor (T104). Sem fila de tarefas (T108).
- Teste no aparelho: só feito à mão (T97, T104). Nenhum dos dois repositórios tem remoto; CI nunca rodou.
- Equipe: 11 tarefas em REVIEW para uma revisora só; sessões BACK e FRONT arquivadas desde 19/10.

## Ponto B

Qualquer Android vira servidor com o que uma VPS tem, sem root, instalado por um comando, seguro por
padrão. No aparelho pessoal, o dono não percebe o servidor: ligação, apps e bateria seguem normais.

## Regras do modo pessoal (valem já no A15, que é o celular principal do Ryan)

1. Sem root. Nenhum ajuste do Android muda sem o Ryan; ADB destrutivo só com confirmação.
2. O servidor não lê dado pessoal (fotos, contatos, mensagens, contas). Sem `termux-setup-storage` por
   padrão; app que precisa de arquivo ganha uma pasta própria dentro do Termux.
3. Orçamento: trabalho pesado (build, backup grande, atualização) só carregando, no Wi-Fi, bateria ≥ 50% e
   temperatura < 40 °C. Fora disso o servidor só atende. A decisão lê as capacidades do `ryx` (T104).
4. Rede: todo serviço escuta em `127.0.0.1`. De fora, só SSH com chave; acesso remoto por túnel
   (Tailscale/WireGuard) quando liberado, nunca porta aberta no 4G.
5. Botão de parar: um comando derruba todos os serviços e tira o servidor do boot; desinstalar remove só
   o que o servidor criou.
6. O uso normal manda: aparelho quente ou bateria caindo rápido, o servidor se reduz sozinho.

## Paridade com VPS, sem root

| Item | Na VPS | No celular | Como | Hoje |
|---|---|---|---|---|
| SSH endurecido | sim | sim | OpenSSH só com chave ed25519, `PerSourcePenalties`, `MaxAuthTries` | existe, conferir (T114) |
| Firewall | nftables | **não** (precisa root) | escutar só em `127.0.0.1`, proxy com autenticação, `netguard`, ACL do túnel | parcial |
| TLS e proxy reverso | nginx/caddy | sim | `caddy` ou `nginx` do Termux na frente de tudo | falta (T115) |
| Supervisão e boot | systemd | sim | runit + Termux:Boot | existe |
| Agendador | cron | sim | `cronie` | existe |
| Logs com rotação | journald | sim | `svlogd` | existe, conferir rotação (T114) |
| Monitoramento e alerta | Prometheus etc. | sim, limitado | capacidades + `watchdog` + `alertas`; `/proc` é parcial (loadavg negado) | parcial |
| Backup cifrado | restic/borg | sim | `backup.sh` + `age` | backup existe, cifra falta (T116) |
| Atualização automática | unattended-upgrades | sim, com cuidado | `pkg upgrade` só no orçamento, com plano e volta | falta |
| Bloqueio de força bruta | fail2ban | sim | penalidades nativas do OpenSSH | conferir (T114) |
| Contêineres | Docker | **não** | `proot-distro` (não é fronteira de segurança) | falta |
| Usuários isolados | sim | **não** (um UID só) | uma pasta e uma porta por app; app sem confiança não entra | limite do Android |
| Banco de dados | sim | sim | sqlite, postgresql, mariadb, redis do Termux | falta |
| Domínio e DNS | sim | sim | MagicDNS do Tailscale ou DNS dinâmico; IPv6 (T13) | bloqueado |
| Catálogo de apps | CasaOS/YunoHost | sim | manifesto por app (abaixo) | falta (T117) |

"Não" quer dizer que é preciso compensar e dizer isso ao usuário, nunca fingir que existe.

## Catálogo de apps ("baixar e testar fácil"; OMNISERVER §8 e §11)

Cada app tem um manifesto: nome, origem, versão, `sha256`, porta, pasta de dados, serviço runit, rota no
proxy, teste de saúde e como desinstalar. Instalar é: baixar conferindo o hash → criar o serviço → criar a
rota → rodar o teste de saúde; se o teste falhar, volta ao estado anterior. Primeiro app: um gerenciador de
arquivos web (ex.: filebrowser; disponibilidade no Termux NOT VERIFIED).

## Testes no aparelho por USB

**Suspenso por enquanto (diretriz do Ryan, 21/10): o A15 é o celular pessoal dele, só leitura.** A T112 só roda com `--autorizado-pelo-ryan` (T124); o portão do código é mock e fixture (T107). O que segue descreve a ferramenta, não a rotina.

Um comando acha o aparelho pelo perfil, faz o forward, confere a host key contra o perfil (nunca
`accept-new`), manda o código para uma pasta temporária do Termux, roda a suíte e devolve JSON com
PASS/FAIL/BLOCKED por teste. É o que foi feito à mão na T97 e na T104 (T112).

## Onde o código mora (decisão do CHEFE; o Ryan pode vetar)

- `ryx` vira o gerente do servidor no aparelho: modo pessoal, orçamento, catálogo de apps.
- `celular` continua sendo o laboratório do lado do PC (ADB, deploy, testes no aparelho) e a configuração
  do A15. O que já roda em `server/termux` migra para o `ryx` aos poucos, sem parar o A15.

## Equipe: o que muda para andar mais rápido

1. O gargalo é a revisão. Daqui em diante o `code-reviewer` faz a primeira passada na esteira
   (`/fechar-tarefa`); a QA confere com mutante próprio, da tarefa mais antiga para a mais nova; o GEM-IDE-2
   também revisa tarefa de Claude (revisão cruzada, §11).
2. Teste no aparelho é exceção com ordem do Ryan; o portão para o que roda no Termux é mock e fixture de aparelho (T107), e a conferência no A15 é só leitura (T114).
3. Lint de verdade no PC: hoje o `ruff` não está instalado e o lint do `ryx` não roda (T119).
4. GitHub privado com CI nos dois repositórios (T118): depende do login do `gh` e da ordem do Ryan.
5. Painel novo do zero, **depois**: substitui as quatro cópias do `server-box`; só começa com
   especificação e sistema de design aprovados (T120).

## Ondas

| Onda | Tarefas |
|---|---|
| 1, agora | T112 testes no aparelho · T113 modo pessoal (orçamento e parar) · T114 paridade conferida no A15 · T119 lint · T108 fila · fila de REVIEW |
| 2 | T115 TLS e proxy reverso · T116 backup cifrado · T117 catálogo de apps · T118 GitHub e CI |
| 3 | acesso remoto pelo túnel · atualização com volta · T120 painel novo |
