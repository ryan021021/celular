$port = New-Object System.IO.Ports.SerialPort "COM6", 115200, "None", 8, "One"
$port.ReadTimeout = 1500
$port.WriteTimeout = 1500
try {
    $port.Open()
    Write-Output "COM6 Aberta com sucesso!"
    
    $commands = @("AT", "ATI", "AT+DEVCONINFO")
    foreach ($cmd in $commands) {
        $port.WriteLine($cmd)
        Start-Sleep -Milliseconds 400
        try {
            $resp = $port.ReadExisting()
            Write-Output "Comando: $cmd"
            Write-Output "Resposta: $resp"
        } catch {
            Write-Output "Comando: $cmd => Sem resposta"
        }
    }
    $port.Close()
} catch {
    Write-Output "Erro ao abrir COM6: $_"
}
