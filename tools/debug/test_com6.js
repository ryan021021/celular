const { SerialPort } = require('child_process');
const fs = require('fs');

// We can send AT commands via PowerShell or .NET System.IO.Ports.SerialPort
const script = `
$port = New-Object System.IO.Ports.SerialPort "COM6", 9600, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One
$port.ReadTimeout = 2000
$port.WriteTimeout = 2000
try {
    $port.Open()
    Write-Output "COM6 Aberta com sucesso!"
    
    $commands = @("AT", "ATI", "AT+DEVCONINFO", "AT+SWVER")
    foreach ($cmd in $commands) {
        $port.WriteLine($cmd + "\`r")
        Start-Sleep -Milliseconds 300
        try {
            $resp = $port.ReadExisting()
            Write-Output "Enviado: $cmd => Resposta: $resp"
        } catch {
            Write-Output "Enviado: $cmd => Sem resposta direta"
        }
    }
    $port.Close()
} catch {
    Write-Output "Erro ao abrir COM6: $_"
}
`;

fs.writeFileSync('C:/Users/Ryanr/Desktop/test_com6.ps1', script);
