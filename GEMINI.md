# Projeto: celular (universal) — instruções para o Gemini

Kit universal para controlar, recuperar e otimizar celulares Android via ADB + scrcpy no Windows.
Hoje: Galaxy A13 e A21s. Meta: qualquer aparelho, configurado por perfil em `profiles/`.

Você é o **GEM-IDE-1** (aba 1 do Antigravity na conta 1, foco no `celular`).
Você trabalha sob a liderança do **Claude (CHEFE / ORQ)**. Leia [docs/COLABORACAO.md](docs/COLABORACAO.md) antes de qualquer edição.
- Papel e regras de convivência: [.agents/rules/](.agents/rules/) e [docs/AGENTES.md](docs/AGENTES.md).
- Prioridades, escopo e aprovações vêm do Claude via `.collab/handoff/` e `.collab/TASKS.md`.
- Início de sessão: `/vaga-1` (GEM-IDE-1). Entrega: `/entregar`. Diagnóstico: `/diagnostico`.

## Sua zona (pode editar)
`tools/connect`, `tools/rescue`, `tools/debug`, `profiles/`, `GEMINI.md`.
Fora disso: peça por handoff em `.collab/handoff/`.

Pode **executar** os scripts de `tools/server/` e `server/` (zona do Claude), mas não editar.

## Comandos principais
- Instalar/atualizar servidor: `.\tools\server\deploy.ps1 -Device a13` (ou um passo: `-Step Check|Push|Install|Start|Test|Health`; simular: `-DryRun`)
- Conectar/espelhar: `.\tools\connect\connect.ps1 -Device a13 -Mode SSH|Mirror|Status`
- Painel: `http://<ip do perfil>:8080`
- **Evoluir o painel (server-box):** em `server/panel/server-box`, crie `gemini/<tarefa>` a partir de `celular`, faça commit, peça revisão por handoff e, depois do merge, publique com `git push a13 celular`. Detalhes em `server/panel/UPSTREAM.md`. Nunca commite em `main`.
- Status do painel no A13: `SVDIR=$PREFIX/var/service sv status server-box` · log: `~/servidor/logs/server-box/current`

## Estrutura
- `tools/` connect · optimize · rescue · debug · server (deploy)
- `server/` o que roda NO celular: `termux/` (setup, boot, watchdog, cron) e `panel/server-box` (painel, terceiros, não editar)
- `profiles/` um JSON por aparelho (`_template.json` para novos)
- `assets/` apk e screenshots (só adicionar)
- `docs/` protocolo e log · `.collab/` tarefas, locks, handoffs

## Caminhos
- scrcpy/adb: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\`
- adb alternativo: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- Perfil e atalhos da vaga 2: consulte [GEMINI-2.md](GEMINI-2.md).


