# Handoff QA → GEM-IDE: lançadores de resgate quebrados e caminhos fixos (achado Q5)

De: QA (Claude, sessão "A13 home server architecture reengineering") · Para: Gemini no Antigravity · 19/10/2026
Zona: `tools/rescue`, `tools/debug`, `tools/connect` (sua). Não editei nada aí.

## Contexto
A regressão (`node tools/qa/regressao.mjs`) confere a regra do GEMINI.md/CLAUDE.md: scripts sem caminho da Desktop
nem serial fixo. Dois casos não são só estilo: **o script não funciona mais**, porque o alvo foi movido para
`tools/rescue/` na reorganização de 18/10 e não existe mais na Desktop (conferido: `desenhar_padrao.py` e
`resgatar_galaxy_a21s.ps1` não estão em `C:\Users\Ryanr\Desktop\`).

## O que precisa (em ordem)
1. **Quebrado:** `tools/rescue/desenhar_padrao.bat:15`, `python "C:\Users\Ryanr\Desktop\desenhar_padrao.py" %SEQ%` → usar `"%~dp0desenhar_padrao.py"`.
2. **Quebrado:** `tools/rescue/resgatar_galaxy_a21s.bat:4`, `-File "C:\Users\Ryanr\Desktop\resgatar_galaxy_a21s.ps1"` → `-File "%~dp0resgatar_galaxy_a21s.ps1"`.
3. `tools/rescue/resgatar_galaxy_a21s.ps1:60`: grava o print em `C:\Users\Ryanr\Desktop\a21s_sucesso.png` → usar `$PSScriptRoot` ou `assets/screenshots/sessao-a21s/`.
4. `tools/debug/collect_vps_baseline.cjs:6,9` e `tools/debug/generate_phase0_reports.cjs:5,11,35,109`: pasta de relatório com caminho da Desktop e serial `RQ8TC00EJNB` fixos → caminho relativo ao script (`path.join(__dirname, "..", "..", "reports", <data>)`) e serial lido de `profiles/a13.json`.
5. `tools/debug/check_tailscale.cjs:3`, `tools/debug/test_com6.js:30`: idem (serial do perfil; saída numa pasta do projeto).
6. `tools/connect/legacy/monitor_e_abrir.ps1:15,20,23` (serial fixo): se o legado não é mais usado, basta uma nota no topo do arquivo; se é, ler o serial do perfil.

## Critério de pronto
- `node tools/qa/regressao.mjs` com a etapa "regras · sem caminho da Desktop nem serial fixo" em **ok**.
- Itens 1 e 2: rodar o .bat a partir de outra pasta (ex.: `cd %TEMP%` e chamar pelo caminho completo) e ver que ele acha o .py/.ps1. **Não precisa mandar nada ao aparelho**: pare antes do primeiro comando ADB, ou rode sem celular conectado.
- Responder neste arquivo, só acrescentando no fim, e marcar RESOLVIDO no topo.
