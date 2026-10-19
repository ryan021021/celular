#!/usr/bin/env bash
# Backup cifrado do servidor A13 para o PC (rodar no Git Bash do PC).
#   bash tools/server/backup.sh            -> faz backup + confere restauracao
#   bash tools/server/backup.sh --restaurar <arquivo.enc> <pasta>  -> decifra e extrai
# Chave: ~/.servidor-a13/backup.key (so no PC, fora do projeto). Sem ela o backup nao abre.
set -euo pipefail

KEYDIR="$HOME/.servidor-a13"; KEY="$KEYDIR/backup.key"
DEST="$(cd "$(dirname "$0")/../.." && pwd)/backups"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" -p 8022 u0_a271@192.168.1.127)
CIFRA=(-aes-256-cbc -pbkdf2 -iter 200000 -salt)
MANTER=7

# OpenSSL do Windows nao entende /c/... depois de "file:": converte para C:/...
win() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
decifra() { openssl enc -d "${CIFRA[@]}" -pass "file:$(win "$KEY")" -in "$(win "$1")"; }

if [ "${1:-}" = "--restaurar" ]; then
  [ -f "$KEY" ] || { echo "sem chave em $KEY"; exit 1; }
  mkdir -p "$3"; decifra "$2" | tar -xzf - -C "$3"; echo "restaurado em $3"; exit 0
fi

mkdir -p "$KEYDIR" "$DEST"; chmod 700 "$KEYDIR"
[ -f "$KEY" ] || { openssl rand -base64 48 > "$KEY"; chmod 600 "$KEY"; echo "chave nova criada em $KEY (guarde uma copia fora do PC)"; }

NOME="a13-$(date +%Y%m%d-%H%M%S).tar.gz.enc"
# No A13: inventario + arquivos de configuracao e segredos (sem logs, sem caches)
"${SSH[@]}" 'set -e; cd $HOME
  I=servidor/.inventario; mkdir -p $I
  crontab -l > $I/crontab.txt 2>/dev/null || true
  pkg list-installed 2>/dev/null > $I/pacotes.txt || true
  (cd servidor/panel/server-box && git log -1 --format="%H %s" > ../../.inventario/commit.txt && git bundle create ../../.inventario/server-box.bundle --all 2>/dev/null)
  cp $PREFIX/etc/ssh/sshd_config.d/10-servidor.conf $I/ 2>/dev/null || true
  tar -czf - --exclude=servidor/logs --exclude=servidor/teste-alertas --exclude="servidor/panel/server-box/.git" \
    servidor .termux/boot .ssh/authorized_keys \
    -C $PREFIX etc/ssh/ssh_host_ed25519_key etc/ssh/ssh_host_ed25519_key.pub etc/ssh/ssh_host_rsa_key etc/ssh/ssh_host_rsa_key.pub \
       etc/ssh/ssh_host_ecdsa_key etc/ssh/ssh_host_ecdsa_key.pub var/service/server-box var/service/alertas \
       var/service/agentops var/service/sftp
  rm -rf $I' | openssl enc "${CIFRA[@]}" -pass "file:$(win "$KEY")" -out "$(win "$DEST/$NOME")"

(cd "$DEST" && sha256sum "$NOME" > "$NOME.sha256")
echo "backup: $DEST/$NOME ($(du -h "$DEST/$NOME" | cut -f1))"

# Prova de restauracao: confere integridade, decifra numa pasta temporaria e checa os arquivos essenciais
(cd "$DEST" && sha256sum -c --quiet "$NOME.sha256") && echo "sha256 ok"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
decifra "$DEST/$NOME" | tar -xzf - -C "$TMP"
faltando=0
for f in servidor/alertas.json servidor/painel.token servidor/start-services.sh servidor/watchdog.sh \
         servidor/panel/server-box/server.js servidor/.inventario/crontab.txt servidor/.inventario/server-box.bundle \
         .termux/boot/boot.sh .ssh/authorized_keys etc/ssh/ssh_host_ed25519_key var/service/server-box/run var/service/alertas/run \
         servidor/agentops/server.mjs servidor/agentops.token servidor/agentops-workers.json servidor/agentops-data/state.json \
         servidor/sftp/host_ed25519 servidor/sftp_authorized_keys var/service/agentops/run var/service/sftp/run; do
  [ -s "$TMP/$f" ] || { echo "FALTANDO: $f"; faltando=1; }
done
if git clone -q -b celular "$TMP/servidor/.inventario/server-box.bundle" "$TMP/clone-teste" 2>/dev/null; then
  echo "painel clonado do backup: $(git -C "$TMP/clone-teste" log -1 --format=%h) (producao: $(cut -c1-7 "$TMP/servidor/.inventario/commit.txt"))"
else
  echo "FALTANDO: historico git do painel"; faltando=1
fi
[ $faltando = 0 ] && echo "restauracao conferida: $(find "$TMP" -type f | wc -l) arquivos" || { echo "RESTAURACAO INCOMPLETA"; exit 1; }

# Avisa o A13 que houve backup bom (o vigia de alertas pode cobrar quando ficar velho)
# (só chega aqui depois da prova de restauração; "at" = epoch em ms, UTC; arquivo 600)
"${SSH[@]}" "umask 077; printf '{\"at\": %s, \"file\": \"%s\", \"files\": %s}\n' \"\$(date +%s)000\" \"$NOME\" \"$(find "$TMP" -type f | wc -l)\" > \$HOME/servidor/backup-ultimo.json && chmod 600 \$HOME/servidor/backup-ultimo.json" \
  && echo "registro do ultimo backup gravado no A13" || echo "AVISO: nao gravei o registro no A13"

# Retencao: mantem os $MANTER mais recentes
ls -1t "$DEST"/a13-*.tar.gz.enc | tail -n +$((MANTER+1)) | while read -r velho; do rm -f "$velho" "$velho.sha256"; done
echo "backups guardados: $(ls -1 "$DEST"/a13-*.tar.gz.enc | wc -l) (maximo $MANTER)"
