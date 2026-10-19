# T8 — Cadastrar um aparelho novo (receita reutilizável)

**Dono:** gemini · **Revisor:** claude · **Use para:** A21s, Oppo A78 ou qualquer Android novo

## Passos
1. Copiar `profiles/_template.json` para `profiles/<id>.json` (id curto, minúsculo: `a21s`, `oppo_a78`).
2. Com o aparelho no USB e a depuração autorizada, preencher com o que estes comandos mostrarem:
   - `adb devices` → `serial`
   - `adb shell getprop ro.product.model` → `model`
   - `adb shell ip -f inet addr show wlan0` → `network.ip`
3. No celular: instalar Termux + Termux:Boot + Termux:API **da mesma fonte** (F-Droid ou GitHub, nunca Play Store; APK em `assets/apk/`).
4. No Termux: `pkg install openssh && passwd && sshd && whoami` → `network.ssh_user`; `network.ssh_port` = 8022.
5. No PC: `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p 8022 <user>@<ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`.
6. Testar: `.\tools\server\deploy.ps1 -Device <id> -Step Check`.
7. Seguir a ficha T6 trocando `-Device <id>`.

## Pedir ao Ryan (parte física)
IP fixo no roteador · Termux sem otimização de bateria · Termux travado nos recentes · carregador plugado.

## Ao terminar
Atualizar a tabela de aparelhos no `README.md` e uma linha no LOG.
