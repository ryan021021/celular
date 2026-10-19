# Decisões de arquitetura

Formato: data · decisão · por quê · alternativa descartada. Decisão nova = linha nova; para mudar uma, crie outra que a substitua.

| # | Data | Decisão | Por quê | Descartado |
|---|---|---|---|---|
| D1 | 18/10 | runit (termux-services) supervisiona todos os serviços | Já existe no Termux, religa em ~1 s, sobe no boot via Termux:Boot | systemd/Docker (não existem sem root); nohup + cron só (lento, 5 min) |
| D2 | 18/10 | Painel = server-box (MIT) evoluído no branch `celular` | Zero dependências, testado, detecta o aparelho | Escrever painel do zero |
| D3 | 19/10 | Deploy por `git push a13 celular` com hook que testa e volta sozinho | Deploy em segundos com rollback provado | scp de pasta (estragava o `.git`) |
| D4 | 19/10 | Claude Code no A13 = binário oficial `linux-arm64-musl` chamado pelo carregador musl do Alpine | Android 32 bits sobre kernel 64 bits; binário intacto (SHA-256 igual ao npm) | `patchelf` (corrompe: segfault); versões antigas em JS puro (sem correções) |
| D5 | 19/10 | Proxy de saída `egress` (127.0.0.1:8091, só domínios da Anthropic) | musl não acha DNS no Android; de quebra limita a saída dos agentes | Criar `/etc/resolv.conf` (sem root) |
| D6 | 19/10 | AgentOps próprio, mínimo, sem dependências; tarefa = perfil + texto | Fila persistente com o essencial cabe em ~35 MB; sem rota de comando livre | Filas externas (Redis etc.) pesadas demais para o A13 |
| D7 | 19/10 | Workers remotos **buscam** tarefas (pull) com token próprio e lease | PC não abre porta; resultado atrasado não fecha tentativa nova | A13 chamando o PC (exigiria porta aberta no PC) |
| D8 | 19/10 | Agentes rodam com `--permission-mode dontAsk` e ferramentas por perfil; perfis locais sem Bash | Padrão novo é `auto`; sem sandbox de kernel, Bash daria acesso a tudo | `--dangerously-skip-permissions` (proibido) |
| D9 | 19/10 | Todos os serviços só em IPv4; SFTP preso ao IP do Wi-Fi | A13 tem IPv6 público; Go abre IPv6 com 0.0.0.0 | Confiar no roteador para filtrar IPv6 |
| D10 | 19/10 | Sem DNS bloqueador no A13 | Portas 53/853 negadas sem root (EACCES) | Porta alternativa (clientes não suportam) |
| D11 | 19/10 | Hermes desligado no worker do PC | Toolsets padrão incluem terminal e leitura livre; `approvals test` permite ler chaves | Rodar com `--yolo` ou sem prova |
| D12 | 19/10 | Orquestração: ORQ coordena; BACK, FRONT, QA, GEM-IDE e GEM-CLI com zonas próprias | Evitar dois orquestradores e edição concorrente | Cada sessão seguindo o próprio plano |
| D13 | 19/10 | Projeto inteiro em git local (sem remoto); repos do painel e binários ficam fora | Histórico e revisão entre 4+ agentes; Ryan autorizou automação ampla | Seguir sem histórico (A2) |
