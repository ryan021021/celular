#!/data/data/com.termux/files/usr/bin/sh
# T113: modo pessoal do A15 (celular principal do Ryan). Regras 3 e 5 do docs/PLANO_SERVIDOR_2026.md.
#   modo-pessoal.sh orcamento           exit 0 = trabalho pesado liberado; exit 1 = só atender (mostra os motivos)
#   modo-pessoal.sh parar [--apply]     derruba os serviços do projeto e tira o servidor do boot e do cron
#   modo-pessoal.sh retomar [--apply]   desfaz o parar
# parar/retomar SIMULAM por padrão: só com --apply mudam algo. Nada é apagado (o boot.sh é renomeado).
# O sshd e o crond não são tocados: o acesso do Ryan continua. Só leitura da bateria e da rede.
SVDIR="${SVDIR:-$PREFIX/var/service}"
DIR="$HOME/servidor"
BOOT="$HOME/.termux/boot/boot.sh"
SERVICOS="server-box alertas agentops sftp egress"
CRON_PROJETO='servidor/watchdog.sh|servidor/netguard.mjs'
MARCA="$DIR/parado"
SALVO_SERVICOS="$DIR/parado.servicos"
SALVO_CRON="$DIR/parado.cron"
MIN_BATERIA=50
MAX_TEMP=40

uso() { echo "uso: modo-pessoal.sh orcamento | parar [--apply] | retomar [--apply]" >&2; exit 2; }

# campo do JSON do termux-battery-status (sem jq)
campo() { printf '%s' "$J" | tr -d '\n ' | sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p"; }

orcamento() {
  motivos=""
  J="$(termux-battery-status 2>/dev/null)"
  pct="$(campo percentage)"; plug="$(campo plugged)"; temp="$(campo temperature)"
  sem_leitura=0
  case "$pct" in ""|*[!0-9]*) sem_leitura=1;; esac
  case "$temp" in ""|.|*[!0-9.]*|*.*.*) sem_leitura=1;; esac
  if [ "$sem_leitura" = 1 ]; then
    motivos="$motivos
- sem leitura da bateria (na dúvida o servidor só atende)"
  else
    [ "$pct" -ge "$MIN_BATERIA" ] 2>/dev/null || motivos="$motivos
- bateria ${pct}% (mínimo ${MIN_BATERIA}%)"
    case "$plug" in UNPLUGGED|"") motivos="$motivos
- descarregando (só pesado carregando)";; esac
    awk "BEGIN{exit !($temp >= $MAX_TEMP)}" && motivos="$motivos
- aparelho quente (${temp} °C, limite ${MAX_TEMP} °C)"
  fi
  case "$(ip route show default 2>/dev/null)" in
    *" dev wlan"*) ;;
    *) motivos="$motivos
- fora do Wi-Fi";;
  esac
  if [ -n "$motivos" ]; then
    echo "Pesado bloqueado, o servidor só atende:$motivos"
    return 1
  fi
  echo "Pesado liberado (carregando, Wi-Fi, ${pct}%, ${temp} °C)."
}

# executa ou, sem --apply, só descreve
faz() { if [ "$APLICA" = 1 ]; then "$@"; fi; }
diz() { if [ "$APLICA" = 1 ]; then echo "feito: $*"; else echo "[simulação] faria: $*"; fi; }

parar() {
  for s in $SERVICOS; do
    [ -d "$SVDIR/$s" ] || continue
    # serviço que já estava desligado de propósito (down antigo) não é nosso: retomar não o religa
    if [ ! -e "$SVDIR/$s/down" ]; then
      diz "parar o serviço $s (arquivo down: o watchdog não religa)"
      if [ "$APLICA" = 1 ]; then mkdir -p "$DIR"; echo "$s" >> "$SALVO_SERVICOS"; fi
    fi
    faz touch "$SVDIR/$s/down"
    faz sv down "$s" >/dev/null 2>&1
  done
  if [ -f "$BOOT" ]; then
    diz "tirar o servidor do boot (boot.sh vira boot.sh.parado)"
    faz mv "$BOOT" "$BOOT.parado"
  fi
  atual="$(crontab -l 2>/dev/null)"
  if printf '%s\n' "$atual" | grep -Eq "$CRON_PROJETO"; then
    diz "tirar watchdog e netguard do cron (linhas guardadas em $SALVO_CRON)"
    if [ "$APLICA" = 1 ]; then
      mkdir -p "$DIR"
      printf '%s\n' "$atual" | grep -E "$CRON_PROJETO" >> "$SALVO_CRON"
      printf '%s\n' "$atual" | grep -Ev "$CRON_PROJETO" | crontab -
    fi
  fi
  diz "marcar o servidor como parado ($MARCA); o sshd continua para o seu acesso"
  if [ "$APLICA" = 1 ] && [ ! -e "$MARCA" ]; then mkdir -p "$DIR"; echo "parado em $(date '+%F %T')" > "$MARCA"; fi
  [ "$APLICA" = 1 ] || echo "Nada foi mudado. Para valer: modo-pessoal.sh parar --apply"
}

retomar() {
  if [ -s "$SALVO_SERVICOS" ]; then
    for s in $(sort -u "$SALVO_SERVICOS"); do
      [ -e "$SVDIR/$s/down" ] || continue
      diz "religar o serviço $s"
      faz rm -f "$SVDIR/$s/down"
      faz sv up "$s" >/dev/null 2>&1
    done
    faz rm -f "$SALVO_SERVICOS"
  fi
  if [ -f "$BOOT.parado" ]; then
    diz "devolver o servidor ao boot"
    faz mv "$BOOT.parado" "$BOOT"
  fi
  if [ -s "$SALVO_CRON" ]; then
    diz "devolver watchdog e netguard ao cron"
    if [ "$APLICA" = 1 ]; then
      { crontab -l 2>/dev/null | grep -Ev "$CRON_PROJETO"; sort -u "$SALVO_CRON"; } | crontab -
      rm -f "$SALVO_CRON"
    fi
  fi
  if [ -e "$MARCA" ]; then diz "tirar a marca de parado"; faz rm -f "$MARCA"; fi
  [ "$APLICA" = 1 ] || echo "Nada foi mudado. Para valer: modo-pessoal.sh retomar --apply"
}

CMD="${1:-}"; APLICA=0
case "${2:-}" in
  "") ;;
  --apply) APLICA=1 ;;
  *) uso ;;
esac
case "$CMD" in
  orcamento) orcamento ;;
  parar) parar ;;
  retomar) retomar ;;
  *) uso ;;
esac
