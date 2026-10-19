# Como desfazer cada mudança deste lote

| Mudança | Desfazer |
|---|---|
| Depuração sem fio desligada | `adb shell settings put global adb_wifi_enabled 1` |
| Token no painel | No A13: `rm ~/servidor/painel.token && SVDIR=$PREFIX/var/service sv restart server-box alertas` (painel volta aberto na rede) |
| Código de autenticação | PC: `git -C server/panel/server-box revert -m 1 1609b67` e `git push a13 celular` |
| Hook com testes e rollback | Copiar a versão anterior de `server/termux/git-hooks/post-receive` (sem o bloco de testes) para `~/servidor/panel/server-box/.git/hooks/` |
| Backup | Apagar `backups/` e `~/.servidor-a13/` no PC (não mexe no A13) |
| Permissão da chave de backup | `icacls %USERPROFILE%\.servidor-a13\backup.key /reset` |
