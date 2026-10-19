$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$items = $computer.Items()

Write-Output "Itens encontrados no Meu Computador:"
foreach ($item in $items) {
    Write-Output " - Nome: $($item.Name) | Tipo: $($item.Type)"
}
