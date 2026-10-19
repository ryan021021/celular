#!/data/data/com.termux/files/usr/bin/sh
# Atualizador seguro do Claude Code no A13 (T24). Uso:
#   sh claude-update.sh --check            -> só compara a versão instalada com a do npm
#   sh claude-update.sh --apply [versão]   -> baixa, confere sha512, testa e troca (guarda a anterior)
#   sh claude-update.sh --rollback         -> volta para a versão anterior
# O binário oficial nunca é modificado: só o link ~/opt/claude-code/current muda.
set -eu
BASE="$HOME/opt/claude-code"
PKG="@anthropic-ai/claude-code-linux-arm64-musl"
cur() { basename "$(readlink "$BASE/current" 2>/dev/null || echo nenhuma)"; }

case "${1:---check}" in
  --check)
    latest=$(npm view "$PKG" version 2>/dev/null)
    echo "instalada: $(cur) | npm: ${latest:-indisponível}"
    [ "$(cur)" = "$latest" ] && echo "atualizado" || echo "há versão nova: rode --apply"
    ;;
  --apply)
    v="${2:-$(npm view "$PKG" version)}"
    [ "$v" = "$(cur)" ] && { echo "já está em $v"; exit 0; }
    tmp="$BASE/.baixando-$v"; rm -rf "$tmp"; mkdir -p "$tmp"; cd "$tmp"
    want=$(npm view "$PKG@$v" dist.integrity)
    npm pack -q "$PKG@$v" >/dev/null
    tgz=$(ls *.tgz)
    got=$(node -e 'const f=process.argv[1];process.stdout.write("sha512-"+require("crypto").createHash("sha512").update(require("fs").readFileSync(f)).digest("base64"))' "$tgz")
    [ "$got" = "$want" ] || { echo "ERRO: sha512 não confere ($got != $want)"; rm -rf "$tmp"; exit 1; }
    tar -xzf "$tgz"
    mkdir -p "$BASE/$v"; mv package/claude "$BASE/$v/claude"; chmod +x "$BASE/$v/claude"
    cp "$BASE/current/ld-musl-aarch64.so.1" "$BASE/$v/"; ln -sf ld-musl-aarch64.so.1 "$BASE/$v/libc.musl-aarch64.so.1"
    cd "$BASE"; rm -rf "$tmp"
    out=$("$BASE/$v/ld-musl-aarch64.so.1" "$BASE/$v/claude" --version 2>&1 || true)
    case "$out" in "$v"*) ;; *) echo "ERRO: versão nova não roda ($out); nada trocado"; rm -rf "$BASE/$v"; exit 1;; esac
    old=$(cur)
    ln -sfn "$old" "$BASE/previous"
    ln -sfn "$v" "$BASE/current.novo" && mv -fT "$BASE/current.novo" "$BASE/current"
    echo "atualizado: $old -> $v (anterior guardada; volta com --rollback)"
    # mantém só current e previous
    for d in "$BASE"/2.*; do n=$(basename "$d"); [ "$n" = "$v" ] || [ "$n" = "$old" ] || rm -rf "$d"; done
    ;;
  --rollback)
    prev=$(basename "$(readlink "$BASE/previous" 2>/dev/null || echo)")
    [ -n "$prev" ] && [ -d "$BASE/$prev" ] || { echo "sem versão anterior guardada"; exit 1; }
    now=$(cur); ln -sfn "$prev" "$BASE/current.novo" && mv -fT "$BASE/current.novo" "$BASE/current"; ln -sfn "$now" "$BASE/previous"
    echo "voltou: $now -> $prev"
    ;;
  *) echo "uso: $0 --check | --apply [versão] | --rollback"; exit 2;;
esac
