# server/ — o que roda NO celular (servidor 24/7 via Termux)

Baseado no guia do J5 Prime (inovadigitalid.com/news/servidor-j5-prime) e no painel
[server-box](https://github.com/felipenalves/server-box) (MIT, ver `panel/UPSTREAM.md`).

| Arquivo | Função |
|---|---|
| `termux/setup.sh` | instala openssh, termux-services, termux-api, cronie, nodejs-lts, git, curl |
| `termux/boot.sh` | vai para `~/.termux/boot/`; wake-lock + sshd + crond + serviços no boot |
| `termux/start-services.sh` | sobe o painel se o `/health` não responder (e futuros serviços) |
| `termux/watchdog.sh` | cron a cada 5 min: reergue sshd, crond e serviços; log rotativo |
| `termux/crontab.example` | watchdog + limpeza semanal (o deploy **acrescenta**, não apaga crons existentes) |
| `panel/server-box/` | painel de status na porta 8080 (código de terceiros, sem alterações) |

## Instalar
No PC: `INSTALAR_SERVIDOR.bat` (ou `tools\server\deploy.ps1 -Device a13`). Passo a passo: `.collab/fichas/T6_deploy_servidor_a13.md`.
No celular, uma única vez: abrir o app **Termux:Boot**.

No celular, fica assim:
```
~/servidor/
├── start-services.sh  watchdog.sh
├── termux/            (cópia de server/termux)
├── panel/server-box/  (painel)
└── logs/              panel.log · watchdog.log · boot.log
```

## Adicionar um serviço novo (bot, API, webhook)
1. Colocar o código em `server/<nome>/`.
2. Em `termux/start-services.sh`, copiar o bloco do painel trocando a checagem e o comando.
3. `deploy.ps1 -Step Push` e depois `-Step Start`. O watchdog passa a cuidar dele.

## Cuidados
- Painel sem senha por design: a proteção é a rede. **Nunca abrir a 8080 no roteador.** Fora de casa: Tailscale (T9).
- IP fixo no roteador, Termux fora da otimização de bateria, carregador plugado.
- Ligado 24/7: acompanhar temperatura/bateria no painel. Bateria estufada = desligar e trocar.
