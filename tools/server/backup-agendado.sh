#!/usr/bin/env bash
# Chamado pela tarefa "Servidor A13 - backup semanal" do Agendador do Windows (T18).
# Registra tudo em backups/backup-agendado.log (mantém as últimas 500 linhas).
# Respeita o lock do A13 (R5): se outro agente estiver mexendo, espera 30 min (até 4 vezes).
# Sai com o código do backup.sh (R4), para o Agendador mostrar falha de verdade.
cd "$(dirname "$0")/../.." || exit 1
LOG=backups/backup-agendado.log
LOCK=.collab/locks/a13-servidor.lock
mkdir -p backups
rc=0
{
  echo "=== $(date '+%F %T') backup agendado"
  for i in 1 2 3 4 5; do
    if [ -f "$LOCK" ] && [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 7200 ]; then
      echo "lock do A13 ativo ($(head -c 120 "$LOCK")); tentativa $i, esperando 30 min"
      [ $i -lt 5 ] && sleep 1800 && continue
      echo "lock continuou ativo: backup adiado para a próxima execução"; rc=75; break
    fi
    bash tools/server/backup.sh; rc=$?
    break
  done
  echo "=== fim (código $rc)"
} >> "$LOG" 2>&1
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
exit $rc
