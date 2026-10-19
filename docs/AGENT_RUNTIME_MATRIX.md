# Matriz de runtimes de agentes

Onde cada agente consegue rodar, com evidência (18–19/10/2026).

| Agente | No A13 | No PC (Windows) | Evidência |
|---|---|---|---|
| Claude Code 2.1.303 | **Roda, com login da assinatura (Claude Pro)** — binário oficial `linux-arm64-musl` via carregador musl do Alpine; sai pela internet pelo proxy local `egress` (127.0.0.1:8091, só domínios da Anthropic) porque a musl não acha DNS no Android | Roda (`C:\Users\Ryanr\.local\bin\claude.exe`) | `claude --version` = `2.1.303 (Claude Code)`; sessão interativa mostra `Opus 5.5 · Claude Pro`; tarefa real pelo AgentOps ok |
| Hermes Agent (Nous Research, MIT) | **Bloqueado** | Instalado (`%LOCALAPPDATA%\hermes\bin\hermes.exe`) | Guia oficial do Termux: só aarch64 e "The Termux package does not work right now" |

## Por que o Claude Code roda no A13
- O Android do A13 é **32 bits** (`ro.product.cpu.abilist64` vazio; Termux `arm`; Node `arm`).
- O **kernel é 64 bits**: o binário ARM64 deu "required file not found" (falta o carregador), não "formato inválido".
- O pacote oficial do npm só tem binários nativos (x64/arm64/darwin/win32); não há build ARM de 32 bits nem JS puro nas versões atuais.
- Solução: o binário oficial (SHA-256 idêntico ao do npm, **sem modificação**) é chamado pelo carregador `ld-musl-aarch64.so.1` do pacote oficial `musl 1.2.6-r2` do Alpine (tamanho conferido com o índice).
- `patchelf` foi testado e **corrompe** o binário (segfault) — descartado.

| Item | Valor |
|---|---|
| Binário | `~/opt/claude-code/2.1.303/claude` (265 MB) |
| Carregador | `~/opt/claude-code/2.1.303/ld-musl-aarch64.so.1` |
| Comando | `$PREFIX/bin/claude` (wrapper) |
| ripgrep | o do Termux (`USE_BUILTIN_RIPGREP=0`) |
| Atualização | `sh ~/servidor/termux/claude-update.sh --check` (compara com o npm) · `--apply [versão]` (baixa, confere sha512 com o `dist.integrity` do npm, testa `--version`, troca o link `current` e guarda `previous`) · `--rollback`. O autoupdate do Claude Code fica desligado (`DISABLE_AUTOUPDATER=1`) |

Testado em 19/10 pelo AgentOps: tarefa real no perfil `leitura` respondeu certo; pedido para ler `~/servidor/agentops-workers.json` foi **negado** pelas regras e nenhum token vazou. As tarefas automáticas rodam com `--permission-mode dontAsk` (o padrão novo do Claude Code é `auto`, que aprovaria sozinho). Limitações: se o Claude Code tentar executar a si mesmo pelo caminho do binário (sem o carregador), isso falha; ferramentas que dependem de binários embutidos podem não funcionar.

## Como cada agente entra no AgentOps
| Perfil | Adaptador | Onde roda | Ferramentas |
|---|---|---|---|
| `leitura` | `claude-local` | A13 | Read, Grep, Glob, LS |
| `edicao` | `claude-local` | A13 | Read, Grep, Glob, LS, Edit, Write (sem Bash, sem rede) |
| `pc-claude` | `worker-pc` | PC | Read, Grep, Glob |
| `pc-hermes` | `worker-pc` | PC | `hermes chat --query-file - --oneshot --max-turns 10 --run-budget 1500` (sem `--yolo`) |
