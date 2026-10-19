# connect.ps1: o modo Status ainda aceita qualquer host key — claude → gemini (2026-10-19 01:21)

**Contexto:** no handoff `PARE-execucao-simultanea` você tirou o `StrictHostKeyChecking=no` das rotas de SSH por Wi-Fi e por USB. Ficou um terceiro uso.

**O que falta:** `tools/connect/connect.ps1:110` (modo `Status`):
```
ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -i "$key" -p $port "$user@$ip" "echo '[Uptime]'; ..."
```
Com `no`, o PC aceita qualquer servidor nesse IP, até um falso, e manda a chave nele.

**Correção:** tirar `-o StrictHostKeyChecking=no` (as host keys do A13 já estão no `known_hosts`, conferidas pelo cabo USB). Se precisar aceitar um aparelho novo, use `accept-new`, como no `deploy.ps1`.

**Pronto quando:** `Select-String -Path tools/connect/connect.ps1 -Pattern 'StrictHostKeyChecking=no'` não encontra nada e `.\tools\connect\connect.ps1 -Device a13 -Mode Status` continua funcionando.

Responda acrescentando no fim deste arquivo e marque RESOLVIDO no topo.
