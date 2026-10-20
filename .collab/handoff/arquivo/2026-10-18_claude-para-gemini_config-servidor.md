# Mudanças no A13 que afetam a sua zona — claude → gemini

O Ryan pediu para eu reforçar a configuração do servidor. O que muda para você:

1. **SSH agora só aceita chave.** Login por senha foi desligado. Para cadastrar aparelhos novos (T8), autorize a chave **antes** de rodar o `setup.sh`. Se não houver chave, o setup mantém a senha ligada e avisa.
2. **`~/.bashrc` do A13:** comentei a linha `sshd` (backup em `~/.bashrc.bak-claude`). Agora quem cuida do sshd é o runit. O `termux-wake-lock` continua.
3. **`README.md` (raiz) está desatualizado:** diz `max_phantom_processes=2147483647`, mas esse valor é **apagado a cada reboot** (estava `null`). O ajuste certo no Android 14 é `settings put global settings_enable_monitor_phantom_procs false` (já aplicado). Corrija o README.
4. **`profiles/a13.json`:** além do node (o certo é v24.18.0), dá para registrar `"battery_protection": "80%"` e `"ssh_auth": "key-only"`.
5. **Tela:** `stay_on_while_plugged_in` passou de 15 para 0 e o timeout para 30 s. O scrcpy com `--stay-awake` continua mantendo a tela acesa enquanto estiver espelhando.

Responda aqui (acrescentando no fim) e marque RESOLVIDO no topo.

---

## Acréscimo do claude (23:10) — conflito de lock + toque fantasma

1. **Conflito:** o seu debloat (snapshot marcado 23:03) rodou enquanto o `a13-servidor.lock` era **meu** (reboot de validação das 23:00, aprovado pelo Ryan). Mexer no A13 durante um reboot alheio pode deixar o aparelho num estado que nenhum de nós conhece. **Antes de qualquer comando no A13, confira `.collab/locks/`.** Se o lock é de outro, espere.
2. **Revisão do debloat:** li o `change_log.csv` inteiro (28 itens + `send_action_app_error`). Está ok: nada de que o servidor dependa, tudo reversível, com rollback registrado. Corrija só os timestamps: estão com `Z` (UTC), mas parecem ser hora local.
3. **Toque fantasma:** a tela quebrada gera toques sozinha a cada 1–3 s. Desliguei "tocar 2x para acordar" e "levantar para acordar", e a tela agora fica apagada. **Ao usar o scrcpy, lembre que toques fantasmas podem clicar em coisas na tela.** Depois de um reboot, rode `adb shell input keyevent KEYCODE_SLEEP`.
