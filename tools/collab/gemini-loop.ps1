# Loop de tarefas do Gemini CLI (GEM-CLI): pega cada tarefa READY do GEM-CLI no .collab/TASKS.md,
# roda o Gemini sem interação, registra o resultado num handoff e manda a tarefa para REVIEW do CHEFE.
# Não gasta tokens do Claude. O Gemini só edita arquivos (sem shell, sem adb, sem commit).
# Uso: powershell -File tools/collab/gemini-loop.ps1 [-Minutos 10] [-Uma]
# Parar: crie o arquivo .collab/gemini-loop.stop (ou Ctrl+C).
param([int]$Minutos = 10, [switch]$Uma, [string]$Modelo = "")

$raiz   = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$tasks  = Join-Path $raiz ".collab\TASKS.md"
$locks  = Join-Path $raiz ".collab\locks"
$hdir   = Join-Path $raiz ".collab\gemini"
$parar  = Join-Path $raiz ".collab\gemini-loop.stop"
$utf8   = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force $hdir | Out-Null

function Proximas {
    Get-Content $tasks -Encoding UTF8 | Where-Object { $_ -match '^\| T\d+ \|' } | ForEach-Object {
        $c = $_.Split('|') | ForEach-Object { $_.Trim() }
        # colunas: ID, Objetivo, Agente, Depende, Arquivos, Estado, Testes, Evidência, Pendências
        if ($c[3] -match '\bGEM-CLI\b' -and $c[6] -eq 'READY') {
            [pscustomobject]@{ Id = $c[1]; Objetivo = $c[2]; Arquivos = $c[5]; Testes = $c[7]; Linha = $_ }
        }
    }
}

function MudarEstado($t, $novo, $evid) {
    $txt = [IO.File]::ReadAllText($tasks, $utf8)
    $c = $t.Linha.Split('|')
    $c[6] = " $novo "; $c[8] = " $evid "; $c[9] = " revisor: CHEFE "
    [IO.File]::WriteAllText($tasks, $txt.Replace($t.Linha, ($c -join '|')), $utf8)
}

do {
    if (Test-Path $parar) { Write-Host "gemini-loop: parado por $parar"; break }
    foreach ($t in @(Proximas)) {
        $lock = Join-Path $locks "$($t.Id)-gemcli.lock"
        if (Test-Path $lock) { continue }
        Set-Content $lock "gemini-cli $($t.Id) $(Get-Date -Format s)" -Encoding UTF8
        $antes = git -C $raiz status --porcelain
        $prompt = @"
Você é o GEM-CLI no projeto em $raiz. Leia docs/COLABORACAO.md (§9 e §11) antes.
Tarefa $($t.Id): $($t.Objetivo)
Arquivos autorizados (só edite estes): $($t.Arquivos)
Pronto quando: $($t.Testes)
Proibido: adb, qualquer comando no celular, apagar arquivos, git commit/push, credenciais, editar fora dos arquivos autorizados.
No fim, responda em português, em até 15 linhas: o que mudou (arquivo:linha), como testar e o que ficou faltando.
"@
        $opts = @('-p', $prompt, '--approval-mode', 'auto_edit')
        if ($Modelo) { $opts += @('-m', $Modelo) }
        Write-Host "gemini-loop: $($t.Id) rodando..."
        $saida = & gemini @opts 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0 -or $saida -match 'Error authenticating|IneligibleTier|API key') {
            Remove-Item $lock
            Write-Host "gemini-loop: Gemini CLI falhou (login/chave?), $($t.Id) continua READY:"
            Write-Host ($saida.Trim() -split "`n" | Select-String 'Error|reason' | Select-Object -First 2)
            break
        }
        $depois = git -C $raiz status --porcelain
        $mudou = Compare-Object @($antes) @($depois) -PassThru | Where-Object { $_ } | ForEach-Object { $_.Substring(3) }
        $h = Join-Path $hdir ("{0}_gemcli_{1}.md" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'), $t.Id)
        $corpo = "# GEM-CLI → CHEFE: $($t.Id)`n`nArquivos mudados: $(@($mudou) -join ', ')`n`n$saida"
        [IO.File]::WriteAllText($h, $corpo, $utf8)
        MudarEstado $t 'REVIEW' "gemini-loop: $(Split-Path $h -Leaf)"
        Remove-Item $lock
        Write-Host "gemini-loop: $($t.Id) -> REVIEW ($(Split-Path $h -Leaf))"
    }
    if (-not $Uma) { Start-Sleep -Seconds ($Minutos * 60) }
} while (-not $Uma)
