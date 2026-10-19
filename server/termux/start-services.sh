#!/data/data/com.termux/files/usr/bin/sh
# Garante os servicos do servidor. Chamado pelo boot.sh, pelo watchdog.sh e pelo hook de deploy.
# Para adicionar um servico: crie server/termux/sv/<nome>/run e rode o setup.sh.
DIR="$HOME/servidor"
export SVDIR="$PREFIX/var/service"
mkdir -p "$DIR/logs"

# Painel server-box (porta 8080), servico runit. Checa pelo /health, nao so pelo processo.
if ! curl -sf -m 3 http://127.0.0.1:8080/health >/dev/null 2>&1; then
  if [ -d "$SVDIR/server-box" ]; then
    sv restart server-box >/dev/null 2>&1
  else
    # reserva (setup ainda nao instalou o servico)
    nohup node "$DIR/panel/server-box/server.js" < /dev/null >> "$DIR/logs/panel.log" 2>&1 &
  fi
  echo "$(date '+%F %T') painel (re)iniciado"
fi
exit 0
