#!/usr/bin/env bash
# T74: leva server/discovery/detect.mjs para ~/servidor/discovery/ no aparelho e confere o sha256.
# O painel (GET /api/v1/capabilities) importa esse arquivo; sem ele a rota responde 503 sem_descoberta.
# Uso: sync-discovery.sh usuario@ip [porta] [chave]   (o deploy.ps1 chama no passo Push, antes do push do painel)
# Só copia um arquivo e lê o sha; não apaga nada no aparelho.
set -euo pipefail

ALVO="${1:?uso: sync-discovery.sh usuario@ip [porta] [chave]}"
PORTA="${2:-8022}"
CHAVE="${3:-}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
ORIGEM="$AQUI/../../server/discovery/detect.mjs"
[ -f "$ORIGEM" ] || { echo "ERRO: $ORIGEM não existe" >&2; exit 2; }

SSH_OPTS=(-o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -p "$PORTA")
SCP_OPTS=(-o StrictHostKeyChecking=accept-new -P "$PORTA")
if [ -n "$CHAVE" ]; then SSH_OPTS+=(-i "$CHAVE"); SCP_OPTS+=(-i "$CHAVE"); fi

ssh "${SSH_OPTS[@]}" "$ALVO" 'mkdir -p ~/servidor/discovery'
scp -q "${SCP_OPTS[@]}" "$ORIGEM" "$ALVO:servidor/discovery/detect.mjs"

LOCAL="$(sha256sum "$ORIGEM" | cut -d' ' -f1)"
REMOTO="$(ssh "${SSH_OPTS[@]}" "$ALVO" 'sha256sum ~/servidor/discovery/detect.mjs' | cut -d' ' -f1)"
if [ "$LOCAL" != "$REMOTO" ]; then
  echo "ERRO: sha256 diferente (repo $LOCAL, aparelho ${REMOTO:-vazio})" >&2
  exit 3
fi
echo "discovery ok: detect.mjs sha256 $LOCAL"
