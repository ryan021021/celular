# T6 — Instalar o servidor 24/7 no A13

**Dono:** gemini · **Revisor:** claude · **Tempo:** ~10 min · **Precisa:** A13 ligado no Wi-Fi, SSH funcionando

## Passos (um por vez; pare no primeiro erro)
Rodar na raiz do projeto (`Desktop\celular`), em PowerShell:

| # | Comando | Deu certo se… |
|---|---|---|
| 1 | `.\tools\server\deploy.ps1 -Step Check` | aparece `conectado: u0_a271 em ...` e uma versão do Node |
| 2 | `.\tools\server\deploy.ps1 -Step Push` | termina com `[PRONTO] Push concluido.` |
| 3 | `.\tools\server\deploy.ps1 -Step Install` | termina com `[PRONTO]` e o aviso do Termux:Boot |
| 4 | **Pedir ao Ryan** para abrir o app Termux:Boot uma vez no celular | Ryan confirmou |
| 5 | `.\tools\server\deploy.ps1 -Step Start` | log mostra `server-box ouvindo em http://0.0.0.0:8080` |
| 6 | `.\tools\server\deploy.ps1 -Step Test` | `# fail 0` |
| 7 | `.\tools\server\deploy.ps1 -Step Health` | `{"ok":true,"service":"server-box"}` e o crontab com a linha do watchdog |
| 8 | Abrir `http://192.168.1.127:8080` no navegador | painel mostra "Samsung Galaxy A13" e bateria |

## Se der erro
- Passo 1 falha → Wi-Fi caiu. `adb forward tcp:8022 tcp:8022`, mudar `network.ip` do perfil para `127.0.0.1` só durante o teste, repetir. **Voltar o IP depois.**
- Passo 3 falha no `pkg` → rodar de novo (espelho do Termux instável). Duas falhas seguidas → handoff para o claude com a saída.
- Passo 6 com `fail` > 0 → **não** editar `server/panel/server-box/`. Copiar a saída num handoff para o claude.
- Qualquer outra coisa → handoff com a saída completa. Não improvisar.

## Não fazer
- Não editar arquivos em `server/` (zona do claude). Problema → handoff.
- Não abrir a porta 8080 no roteador.

## Ao terminar
TASKS.md: T6 → `review`. LOG.md: uma linha com o resultado do passo 6 e 7.
