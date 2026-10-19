#!/data/data/com.termux/files/usr/bin/sh
# Roda a cada 5 min via cron. Reergue sshd e servicos que cairam.
# (crond nao e checado aqui: se este script roda, o crond esta vivo; quem cuida dele e o runit.)
DIR="$HOME/servidor"
LOG="$DIR/logs/watchdog.log"
export SVDIR="$PREFIX/var/service"
mkdir -p "$DIR/logs"

if ! pgrep -x sshd >/dev/null; then
  sv up sshd 2>/dev/null || sshd
  echo "$(date '+%F %T') sshd reiniciado" >> "$LOG"
fi
sh "$DIR/start-services.sh" >> "$LOG" 2>&1

# Mantem os logs pequenos (ultimas 500 linhas cada)
for f in "$LOG" "$DIR/logs/boot.log" "$DIR/logs/panel.log"; do
  if [ -f "$f" ] && [ "$(wc -l < "$f")" -gt 500 ]; then
    tail -n 500 "$f" > "$f.tmp" && cat "$f.tmp" > "$f" && rm -f "$f.tmp"
  fi
done
exit 0
