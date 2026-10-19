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

# Demais servicos do runit (G7): se nao estao em "run:" (caidos ou parados), sobe de novo.
# Servico com arquivo "down" na pasta foi parado de proposito e nao e religado.
for s in agentops alertas egress sftp; do
  [ -d "$SVDIR/$s" ] || continue
  [ -e "$SVDIR/$s/down" ] && continue
  case "$(sv status "$s" 2>/dev/null)" in
    run:*) ;;
    *) sv up "$s" >/dev/null 2>&1; echo "$(date '+%F %T') $s religado" >> "$LOG" ;;
  esac
done

# Mantem os logs pequenos (ultimas 500 linhas cada)
for f in "$LOG" "$DIR/logs/boot.log" "$DIR/logs/panel.log" "$DIR/logs/netguard.log"; do
  if [ -f "$f" ] && [ "$(wc -l < "$f")" -gt 500 ]; then
    tail -n 500 "$f" > "$f.tmp" && cat "$f.tmp" > "$f" && rm -f "$f.tmp"
  fi
done
exit 0
