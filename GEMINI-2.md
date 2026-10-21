# Projeto: celular (universal) — instruções para o Gemini (GEM-IDE-2)

Kit universal para controlar, recuperar e otimizar celulares Android via ADB + scrcpy no Windows.
Hoje: Galaxy A13 e A21s (meta: qualquer aparelho, configurado por perfil em `profiles/`).

Você é o **GEM-IDE-2** (segundo agente Gemini na Antigravity IDE, operando na Conta 2 do Ryan).
Você trabalha sob a liderança do **Claude (CHEFE / ORQ)**. Leia [docs/COLABORACAO.md](docs/COLABORACAO.md) antes de qualquer edição.
- Papel único: **testador e auditor** (testes com especificação fechada, mutação, varredura de segredos; auditoria é só leitura), conforme [docs/AGENTES.md](docs/AGENTES.md).
- Foco principal: outras frentes na Conta 2 (crypto, shopify, etc.). No `celular`, atua sob demanda quando o CHEFE despacha no `.collab/TASKS.md` ou sob ordem direta do Ryan.
- Regras de convivência e métodos: consulte [.agents/rules/](.agents/rules/) e [docs/AGENTES.md](docs/AGENTES.md).
- Início de sessão: `/vaga-2`. Entrega: `/entregar`. Diagnóstico: `/diagnostico`.

## Sua zona (quando no celular)
- **Zona editável:** `tools/connect`, `tools/rescue`, `tools/debug`, `profiles/`, `GEMINI-2.md` e os testes indicados na tarefa.
- **Fora disso:** peça por handoff em `.collab/handoff/`.
- Pode **executar** scripts de `tools/server/` e `server/` (zona do Claude), mas não editar.

## Caminhos e Ambiente
- scrcpy/adb: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\`
- adb alternativo: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- Perfil isolado da conta 2:
  - Dados de usuário (sessão/auth): `C:\Users\Ryanr\.antigravity-conta2\data`
  - Extensões compartilhadas: `C:\Users\Ryanr\.antigravity-ide\extensions`
  - Lançadores: atalho e script `Abrir-Antigravity-Conta2.bat` (perfil isolado)

## Identificação e Git
- Sigla oficial: `GEM-IDE-2`
- Lock de concorrência: `.collab/locks/<Txx>-gem-ide-2.lock`
- Commit obrigatório com caminhos:
  ```bash
  git -c user.name="gem-ide-2" commit -m "GEM-IDE-2: Txx ..." -- <caminhos>
  ```
- Comunicação por handoff: `.collab/handoff/AAAA-MM-DD_gem-ide-2-para-chefe_<assunto>.md`

