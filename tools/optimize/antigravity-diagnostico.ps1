<#
.SYNOPSIS
  Diagnostico do agente do Antigravity IDE. So le, nunca altera nada.

.DESCRIPTION
  Mede quanto o modelo leva para responder nas conversas recentes (transcript_full.jsonl)
  e aponta o que ja travou o agente antes: conversa gigante, limite de uso da conta,
  execucao automatica (turbo), plugin superpowers, MCP pesado e erro de checkpoint no log.
  Cada problema sai numa linha "ALERTA: ..." com o que fazer. Sempre sai com codigo 0.

.EXAMPLE
  .\antigravity-diagnostico.ps1
#>
[CmdletBinding()]
param(
  [string]$Raiz = (Join-Path $env:USERPROFILE '.gemini\antigravity-ide'),
  [string]$Config = (Join-Path $env:USERPROFILE '.gemini\config'),
  [string]$Logs = (Join-Path $env:APPDATA 'Antigravity IDE\logs'),
  [ValidateRange(1, 50)][int]$Conversas = 5
)

$ErrorActionPreference = 'Stop'
$LIMITE_LENTO_S = 60
$LIMITE_PASSOS = 500
$MCP_PESADOS = 'chrome-devtools|hermes|code-review-graph'
$script:alertas = 0

function Write-Alerta([string]$texto) {
  $script:alertas++
  Write-Output "ALERTA: $texto"
}

function Get-Conversa([string]$arquivo) {
  $lat = @(); $modelo = ''; $prev = $null; $passos = 0
  foreach ($linha in [IO.File]::ReadLines($arquivo)) {
    if (-not $linha) { continue }
    $passos++
    try { $o = $linha | ConvertFrom-Json } catch { continue }
    if ("$($o.content)" -match 'Model Selection` from .{0,60}? to (.{1,60}?)\. No need') { $modelo = $Matches[1] }
    if ($prev -and $prev.type -eq 'PLANNER_RESPONSE') {
      $s = ([datetime]$o.created_at - [datetime]$prev.created_at).TotalSeconds
      if ($s -ge 0 -and $s -lt 3600) { $lat += $s }
    }
    $prev = $o
  }
  $media = 0; $max = 0
  if ($lat.Count -gt 0) {
    $m = $lat | Measure-Object -Average -Maximum
    $media = [int]$m.Average; $max = [int]$m.Maximum
  }
  return [pscustomobject]@{ Passos = $passos; Modelo = $modelo; Media = $media; Max = $max; Chamadas = $lat.Count }
}

function Test-Conversas {
  Write-Output '== Conversas recentes (tempo de resposta do modelo)'
  $brain = Join-Path $Raiz 'brain'
  if (-not (Test-Path -LiteralPath $brain)) { Write-Output "Historico nao encontrado: $brain"; return }
  $dirs = Get-ChildItem -LiteralPath $brain -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First $Conversas
  $primeira = $true
  foreach ($d in $dirs) {
    $f = Join-Path $d.FullName '.system_generated\logs\transcript_full.jsonl'
    if (-not (Test-Path -LiteralPath $f)) { continue }
    $c = Get-Conversa $f
    $id = $d.Name.Substring(0, [math]::Min(8, $d.Name.Length))
    Write-Output ("{0} {1:MM-dd HH:mm} passos={2} chamadas={3} modelo='{4}' media={5} s max={6} s" -f `
      $id, $d.LastWriteTime, $c.Passos, $c.Chamadas, $c.Modelo, $c.Media, $c.Max)
    if ($c.Passos -gt $LIMITE_PASSOS) {
      Write-Alerta "conversa $id tem $($c.Passos) passos: abra conversa nova (uma tarefa por conversa)."
    }
    if ($primeira -and $c.Media -gt $LIMITE_LENTO_S) {
      Write-Alerta "o modelo leva $($c.Media) s por resposta (normal: menos de 30 s). Provavel limite de uso (cota) da conta: troque o modelo no painel ou espere renovar."
    }
    $primeira = $false
  }
}

function Test-Politicas {
  Write-Output '== Permissoes do agente (config.json)'
  $arq = Join-Path $Config 'config.json'
  if (-not (Test-Path -LiteralPath $arq)) { Write-Output "config.json nao encontrado: $arq"; return }
  $u = (Get-Content -LiteralPath $arq -Raw -Encoding UTF8 | ConvertFrom-Json).userSettings
  Write-Output ("execucao de comandos: {0} | arquivos fora do workspace: {1} | JS no navegador: {2}" -f `
    $u.autoExecutionPolicy, $u.nonWorkspaceFileAccessPolicy, $u.browserJsExecutionPolicy)
  if ("$($u.autoExecutionPolicy)" -match '_ON$') {
    Write-Alerta 'execucao automatica de comandos ligada (turbo): o agente roda comandos sem pedir. Painel do agente: Terminal em pedir revisao.'
  }
  if ("$($u.nonWorkspaceFileAccessPolicy)" -match 'ALLOW') {
    Write-Alerta 'acesso a arquivos fora do workspace liberado: desligue no painel do agente.'
  }
  if ("$($u.browserJsExecutionPolicy)" -match 'TURBO') {
    Write-Alerta 'JS no navegador do agente em turbo: mude para pedir revisao.'
  }
}

function Test-Plugins {
  Write-Output '== Plugins (pastas em config\plugins)'
  $pasta = Join-Path $Config 'plugins'
  if (-not (Test-Path -LiteralPath $pasta)) { Write-Output "Pasta de plugins nao encontrada: $pasta"; return }
  $nomes = @(Get-ChildItem -LiteralPath $pasta -Directory | Where-Object Name -ne 'references' | Select-Object -ExpandProperty Name)
  Write-Output ('carregados: ' + ($nomes -join ', '))
  if ($nomes -contains 'superpowers') {
    Write-Alerta 'pasta do superpowers em plugins: ele entra pelo GEMINI.md mesmo com enabled false. Mova para config\plugins-desligados.'
  }
}

function Test-Mcps {
  Write-Output '== MCPs ativos'
  foreach ($arq in (Join-Path $Config 'mcp_config.json'), (Join-Path $Raiz 'mcp_config.json')) {
    if (-not (Test-Path -LiteralPath $arq)) { continue }
    $srv = (Get-Content -LiteralPath $arq -Raw -Encoding UTF8 | ConvertFrom-Json).mcpServers
    if (-not $srv) { continue }
    $ativos = @($srv.PSObject.Properties | Where-Object { $_.Value.disabled -ne $true } | Select-Object -ExpandProperty Name)
    $lista = if ($ativos.Count) { $ativos -join ', ' } else { 'nenhum' }
    Write-Output "${arq}: $lista"
    foreach ($n in $ativos) {
      if ($n -match $MCP_PESADOS) { Write-Alerta "MCP pesado ativo ($n): a IDE carrega todos antes do agente; desligue com disabled true." }
    }
  }
}

function Test-Log {
  Write-Output '== Log da IDE (ls-main.log mais recente)'
  if (-not (Test-Path -LiteralPath $Logs)) { Write-Output "Logs nao encontrados: $Logs"; return }
  # janela que abre e fecha cria pasta de sessao sem ls-main.log: pega o log mais novo de qualquer sessao
  $ls = Get-ChildItem -LiteralPath $Logs -Recurse -Filter 'ls-main.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $ls) { Write-Output "ls-main.log nao encontrado em $Logs"; return }
  $texto = Get-Content -LiteralPath $ls.FullName -Raw
  $cp = ([regex]::Matches($texto, 'failed to get checkpoint config')).Count
  $regras = ([regex]::Matches($texto, 'Failed to parse global rule')).Count
  Write-Output "$($ls.Directory.Name): erros de checkpoint=$cp, regras globais ignoradas (frontmatter invalido)=$regras"
  if ($cp -gt 0) {
    Write-Alerta "checkpoint: a IDE nao reconhece o modelo escolhido ($cp vezes) e o resumo da conversa falha. Troque o modelo no painel ou atualize o Antigravity."
  }
}

function Show-Processos {
  Write-Output '== Processos (so informacao)'
  $ide = @(Get-Process | Where-Object { $_.ProcessName -like 'Antigravity*' -or $_.ProcessName -like 'language_server*' })
  $mbIde = [int](($ide | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
  $chrome = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'antigravity-browser-profile' })
  $livre = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)
  Write-Output "IDE: $($ide.Count) processos, $mbIde MB | navegador do agente: $($chrome.Count) processos | RAM livre: $livre GB"
}

foreach ($etapa in 'Test-Conversas', 'Test-Politicas', 'Test-Plugins', 'Test-Mcps', 'Test-Log', 'Show-Processos') {
  try { & $etapa } catch { Write-Output "($etapa nao concluiu: $($_.Exception.Message))" }
}
Write-Output "== Resumo: $script:alertas alerta(s)."
exit 0
