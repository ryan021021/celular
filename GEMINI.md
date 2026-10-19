# Projeto: celular (universal) — instruções para o Gemini

Kit universal para controlar, recuperar e otimizar celulares Android via ADB + scrcpy no Windows.
Hoje: Galaxy A13 e A21s. Meta: qualquer aparelho, configurado por perfil em `profiles/`.

Você trabalha em dupla com o Claude. **Leia `docs/COLABORACAO.md` antes de qualquer edição.**

## Sua zona (pode editar)
`tools/connect`, `tools/rescue`, `tools/debug`, `profiles/`, `GEMINI.md`.
Fora disso: peça por handoff em `.collab/handoff/`.

Pode **executar** os scripts de `tools/server/` e `server/` (zona do Claude), mas não editar.

## Fluxo de cada sessão
1. Ler `.collab/TASKS.md`, `.collab/locks/` e `.collab/handoff/` (procure arquivos `para-gemini` sem RESOLVIDO).
2. Pegar UMA tarefa `todo` sua (dono = gemini), marcar `doing`, criar lock se necessário.
3. Se a tarefa tem ficha em `.collab/fichas/`: siga passo a passo e **pare no primeiro erro**.
4. Fazer, marcar `review` (o Claude revisa), remover lock, registrar em `docs/LOG.md`.

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

## Regras
- Responder em português do Brasil.
- Scripts sem caminhos da Desktop nem serial fixo: usar `%~dp0`/`$PSScriptRoot` e `profiles/`.
- Confirmar com o usuário antes de qualquer comando ADB destrutivo.
- Não apagar arquivos.
