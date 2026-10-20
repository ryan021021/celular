<#
.SYNOPSIS
  Move (nunca apaga) o historico antigo do agente do Antigravity IDE para uma pasta de arquivo.

.DESCRIPTION
  A IDE carrega o historico do agente (conversations, brain, browser_recordings) e fica pesada:
  com alguns GB a IDE trava e o agente fica "working" para sempre.
  Por padrao so SIMULA. Com -Aplicar move o que esta parado ha mais de -Dias dias.
  Para desfazer, mova de volta de -Destino para -Raiz (mesmos nomes de pasta).
  Com a raiz padrao, recusa aplicar enquanto a IDE estiver aberta.

.EXAMPLE
  .\antigravity-arquivar.ps1                 # simulacao
  .\antigravity-arquivar.ps1 -Aplicar        # move o antigo (feche a IDE antes)
#>
[CmdletBinding()]
param(
  [string]$Raiz = (Join-Path $env:USERPROFILE '.gemini\antigravity-ide'),
  [string]$Destino = (Join-Path $env:USERPROFILE '.gemini\antigravity-ide-arquivo'),
  [ValidateRange(1, 365)][int]$Dias = 7,
  [switch]$Aplicar
)

$ErrorActionPreference = 'Stop'
$PADRAO_ID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
$RAIZ_PADRAO = Join-Path $env:USERPROFILE '.gemini\antigravity-ide'

if (-not (Test-Path -LiteralPath $Raiz)) {
  Write-Output "Raiz nao encontrada: $Raiz"
  exit 2
}

if ($Aplicar -and ($Raiz -eq $RAIZ_PADRAO)) {
  $abertos = Get-Process | Where-Object { $_.ProcessName -like 'Antigravity*' -or $_.ProcessName -like 'language_server*' }
  if ($abertos) {
    Write-Output 'A IDE do Antigravity esta aberta. Feche todas as janelas e rode de novo (nada foi movido).'
    exit 3
  }
}

$limite = (Get-Date).AddDays(-$Dias)

function Get-IdDoArquivo([string]$nome) {
  if ($nome -match $PADRAO_ID) { return $Matches[0].ToLower() }
  return $null
}

function Get-MaisRecente([System.IO.FileSystemInfo]$item) {
  if (-not $item.PSIsContainer) { return $item.LastWriteTime }
  $maior = Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force |
    Measure-Object -Property LastWriteTime -Maximum
  if ($maior.Count -gt 0) { return $maior.Maximum }
  return $item.LastWriteTime
}

function Get-Tamanho([System.IO.FileSystemInfo]$item) {
  if (-not $item.PSIsContainer) { return $item.Length }
  $soma = (Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $soma) { return 0 }
  return $soma
}

# 1) conversas: um id so vai se TODOS os arquivos dele (db, wal...) estao parados
$pastaConversas = Join-Path $Raiz 'conversations'
$porId = @{}
if (Test-Path -LiteralPath $pastaConversas) {
  foreach ($f in Get-ChildItem -LiteralPath $pastaConversas -File -Force) {
    $id = Get-IdDoArquivo $f.Name
    if (-not $id) { continue }
    if (-not $porId.ContainsKey($id)) { $porId[$id] = @() }
    $porId[$id] += $f
  }
}
$idsMovidos = @()
$idsMantidos = @()
foreach ($id in $porId.Keys) {
  $maisNovo = ($porId[$id] | Measure-Object -Property LastWriteTime -Maximum).Maximum
  if ($maisNovo -lt $limite) { $idsMovidos += $id } else { $idsMantidos += $id }
}

# 2) itens a mover: [pasta-origem-relativa, item]
$lista = @()
foreach ($id in $idsMovidos) {
  foreach ($f in $porId[$id]) { $lista += , @('conversations', $f) }
}
foreach ($sub in 'brain', 'browser_recordings') {
  $pasta = Join-Path $Raiz $sub
  if (-not (Test-Path -LiteralPath $pasta)) { continue }
  foreach ($item in Get-ChildItem -LiteralPath $pasta -Force) {
    $id = Get-IdDoArquivo $item.Name
    if ($id -and ($idsMantidos -contains $id)) { continue }
    if ((Get-MaisRecente $item) -lt $limite) { $lista += , @($sub, $item) }
  }
}

$bytes = 0
foreach ($par in $lista) { $bytes += Get-Tamanho $par[1] }
$mb = [math]::Round($bytes / 1MB)
Write-Output ("Parado ha mais de {0} dias: {1} itens, {2} MB (conversas {3}, mantidas {4})." -f $Dias, $lista.Count, $mb, $idsMovidos.Count, $idsMantidos.Count)

if (-not $Aplicar) {
  Write-Output "SIMULA: nada foi movido. Destino seria: $Destino"
  Write-Output 'Para mover de verdade (com a IDE fechada): rode com -Aplicar.'
  exit 0
}

$falhas = 0
$movidos = 0
foreach ($par in $lista) {
  $pastaDestino = Join-Path $Destino $par[0]
  $alvo = Join-Path $pastaDestino $par[1].Name
  if (Test-Path -LiteralPath $alvo) {
    Write-Output "Ja existe no destino, pulado: $alvo"
    continue
  }
  try {
    New-Item -ItemType Directory -Path $pastaDestino -Force | Out-Null
    Move-Item -LiteralPath $par[1].FullName -Destination $pastaDestino
    $movidos++
  } catch {
    $falhas++
    Write-Output ("Falhou ao mover {0}: {1}" -f $par[1].FullName, $_.Exception.Message)
  }
}
Write-Output ("APLICADO: {0} itens movidos para {1} ({2} falhas). Para desfazer, mova de volta." -f $movidos, $Destino, $falhas)
if ($falhas -gt 0) { exit 4 }
exit 0
