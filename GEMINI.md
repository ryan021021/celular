# Projeto: celular (universal) — instruções para o Gemini

Kit universal para controlar, recuperar e otimizar celulares Android via ADB + scrcpy no Windows.
Hoje: Galaxy A13 e A21s. Meta: qualquer aparelho, configurado por perfil em `profiles/`.

Você trabalha sob a liderança do **Claude (CHEFE / ORQ)**. **Leia `docs/COLABORACAO.md` antes de qualquer edição.**
- O Claude (CHEFE/ORQ) é o líder e comandante do projeto (D14 e ordem direta do Ryan).
- Prioridades, escopo e aprovações vêm do Claude via `.collab/handoff/` e `.collab/TASKS.md`.

## Sua zona (pode editar)
`tools/connect`, `tools/rescue`, `tools/debug`, `profiles/`, `GEMINI.md`.
Fora disso: peça por handoff em `.collab/handoff/`.

Pode **executar** os scripts de `tools/server/` e `server/` (zona do Claude), mas não editar.

## Fluxo de cada sessão (D20, método do ECC)
1. Ler `.collab/TASKS.md`, `.collab/locks/` e `.collab/handoff/` (`para-gemini` sem RESOLVIDO).
2. Pegar UMA tarefa READY com a SUA sigla exata (GEM-IDE-1 ou GEM-IDE-2); criar `.collab/locks/<Txx>-<sigla minúscula>.lock`. Sem tarefa: responder "FILA VAZIA" e parar.
3. Teste primeiro (ver falhar), depois a correção (ver passar). Provar o teste quebrando o código numa cópia.
4. Parar no primeiro erro. Saída filtrada. Nada de polling.
5. Crítica (auth, rede, segredo, `server/termux`, deploy, ADB destrutivo): REVIEW com a QA. As demais: o CHEFE confere com `/fechar-tarefa`.
6. Remover o lock, anexar 1 linha no `docs/LOG.md`, commit só com os seus caminhos: `git -c user.name="<sigla minúscula>" commit -m "<SIGLA>: Txx ..." -- <caminhos>`.

## Papéis das vagas
- GEM-IDE-1: código, tooling, testes e auditoria de leitura do `celular`. GEM-IDE-2: aba 2 no `celular` (só tarefa READY com a sigla GEM-IDE-2) ou outras frentes na conta 2.
- Nenhuma vaga revisa a outra. Um dono por tarefa; duas vagas nunca nos mesmos arquivos nem no A15 ao mesmo tempo.

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

## Multi-Agente (Instância 2 da IDE / Segunda Conta)
Configuração criada a pedido do Ryan para rodar 2 agentes da Antigravity IDE simultaneamente em janelas e contas separadas:
- **Instância 1 (GEM-IDE-1):** Conta 1 do Ryan, projeto `celular`, uma tarefa por conversa (sem loop; ver `.agents/rules/02-anti-travamento.md`).
- **Duas abas na mesma janela (20/10):** aba 1 começa com `/vaga-1` (GEM-IDE-1), aba 2 com `/vaga-2` (GEM-IDE-2); entrega com `/entregar`. Regras do workspace em `.agents/rules/` (lock por sigla, git com caminhos, nunca os mesmos arquivos nem o A15 ao mesmo tempo).
- **Instância 2 (GEM-IDE-2 / janela secundária):** Conta 2 do Ryan (perfil isolado para tarefas paralelas, ex.: crypto, shopify, outras frentes). Ver instruções completas em [GEMINI-2.md](GEMINI-2.md).
  - **Dados de Usuário (Sessão/Auth):** `C:\Users\Ryanr\.antigravity-conta2\data` (totalmente isolada, sem colisão de login nem de tokens).
  - **Extensões Compartilhadas:** `C:\Users\Ryanr\.antigravity-ide\extensions`.
  - **Atalhos de Lançamento:** `Antigravity IDE - Conta 2.lnk` e `Abrir-Antigravity-Conta2.bat` na Área de Trabalho.
  - **Isolamento de Escopo:** A Instância 2 não toca nos locks de `.collab/locks/` do projeto `celular` a menos que explicitamente ordenado pelo Ryan ou pelo Claude.

