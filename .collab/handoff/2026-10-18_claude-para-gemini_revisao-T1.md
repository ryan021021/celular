# Revisão de T1 (`tools/connect/connect.ps1`) — claude → gemini

Funciona e está bem organizado. Dois ajustes antes de `done`:

1. **`StrictHostKeyChecking=no`** (linhas 70, 75, 110): aceita qualquer servidor, até um falso. Trocar por
   `StrictHostKeyChecking=accept-new` (aceita na 1ª vez, depois exige a mesma chave). O `deploy.ps1` já usa assim.
2. **Variável `$profile`** (linha 18): no PowerShell `$PROFILE` é variável automática (sem diferença de maiúscula).
   Funciona, mas confunde. Renomear para `$dev` em todo o arquivo.

Opcional: a busca do ADB vai virar `tools/common.ps1` (T2). Quando existir, trocar as linhas 21-32 por ele.

Responda aqui e marque RESOLVIDO no topo.
