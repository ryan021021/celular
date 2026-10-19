#!/data/data/com.termux/files/usr/bin/sh
# Instala a base do servidor no Termux. Idempotente: pode rodar 1, 2 ou N vezes, e retoma se parou no meio.
# Uso (dentro do Termux, via SSH): sh setup.sh
# Não apaga nada: serviços do runit são copiados por cima (o diretório supervise/ do runsv fica), o cron
# troca só as linhas do projeto e ~/.ssh/authorized_keys nunca é tocado.
set -e

pkg update -y && pkg upgrade -y || {
  echo "ERRO: pkg update/upgrade falhou. Confira a internet e os espelhos (termux-change-repo) e rode setup.sh de novo." >&2
  exit 1
}

# Node: o pacote "nodejs" (26.x) é o que roda e foi testado em produção; "nodejs-lts" conflita com ele (achado Q8 da QA)
for p in openssh termux-services termux-api cronie nodejs nano curl git rclone; do
  pkg install -y "$p" || {
    echo "ERRO: não consegui instalar o pacote '$p'. Confira a internet e os espelhos e rode setup.sh de novo: o que já foi feito não se repete." >&2
    exit 1
  }
done

# Servicos via runit (termux-services). SVDIR nao vem definido em SSH sem terminal.
export SVDIR="$PREFIX/var/service"
. "$PREFIX/etc/profile.d/start-services.sh" 2>/dev/null; sleep 2
# SSH: porta 8022 (padrao do Termux). Login por senha NAO e alterado aqui.
sv-enable sshd  || echo "AVISO: sv-enable sshd falhou"
sv-enable crond || echo "AVISO: sv-enable crond falhou"
pgrep -x sshd >/dev/null || sshd

# Painel como servico runit (religa na hora se cair)
HERE="$(cd "$(dirname "$0")" && pwd)"
pkill -f "node $HOME/servidor/panel/server-box/server.js" 2>/dev/null || true  # set -e: sem processo antigo (aparelho novo) o pkill sai 1
for s in server-box alertas agentops sftp egress; do
  # copia por cima, sem rm: apagar o diretório faria o runsv perder o supervise/ de um serviço que já roda
  mkdir -p "$SVDIR/$s"
  cp -r "$HERE/sv/$s/." "$SVDIR/$s/"
  chmod +x "$SVDIR/$s/run" "$SVDIR/$s/log/run"
  sv-enable "$s" || echo "AVISO: sv-enable $s falhou"
done
# alertas precisa de ~/servidor/alertas.json com {"ntfy_topic": "..."}; sem ele o servico espera e tenta de novo
[ -f "$HOME/servidor/alertas.json" ] || echo "AVISO: crie ~/servidor/alertas.json para ativar os alertas (ver server/README.md)"

# SSH so com chave: aplica apenas se ja existe chave autorizada (senao trancaria o acesso)
if [ -s "$HOME/.ssh/authorized_keys" ]; then
  mkdir -p "$PREFIX/etc/ssh/sshd_config.d"
  cp "$HERE/sshd-servidor.conf" "$PREFIX/etc/ssh/sshd_config.d/10-servidor.conf"
  sshd -t && sv restart sshd 2>/dev/null
else
  echo "AVISO: sem ~/.ssh/authorized_keys - login por senha continua ligado"
fi

# Pastas do servidor
mkdir -p "$HOME/servidor/logs" "$HOME/.termux/boot"

# Cron: tira as linhas antigas do projeto e poe as do crontab.example (outros crons ficam; rodar de novo não duplica)
if [ -f "$HERE/crontab.example" ]; then
  ( crontab -l 2>/dev/null | grep -v 'servidor/watchdog.sh' | grep -v 'servidor/logs/clean.log' || true
    grep -v '^#' "$HERE/crontab.example" ) | crontab -
fi

echo "OK. Proximo passo: sh deploy.sh (copia painel, boot e watchdog) e abra o Termux:Boot uma vez."
