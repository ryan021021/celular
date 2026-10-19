#!/usr/bin/env bash
# Chamado pela tarefa "Servidor A13 - backup semanal" do Agendador do Windows (T18).
# Registra tudo em backups/backup-agendado.log (mantém as últimas 500 linhas).
cd "$(dirname "$0")/../.." || exit 1
LOG=backups/backup-agendado.log
mkdir -p backups
{
  echo "=== $(date '+%F %T') backup agendado"
  bash tools/server/backup.sh
  echo "=== fim (código $?)"
} >> "$LOG" 2>&1
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
