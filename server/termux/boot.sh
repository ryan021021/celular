#!/data/data/com.termux/files/usr/bin/sh
# Copiar para ~/.termux/boot/boot.sh (Termux:Boot executa na inicializacao do aparelho).
termux-wake-lock

# termux-services: sobe o runsvdir, que cuida de sshd e crond (habilitados com sv-enable)
export SVDIR="$PREFIX/var/service"
[ -f "$PREFIX/etc/profile.d/start-services.sh" ] && . "$PREFIX/etc/profile.d/start-services.sh"
# espera ate 15 s o runit subir sshd e crond
i=0; while [ $i -lt 15 ] && ! { pgrep -x sshd >/dev/null && pgrep -x crond >/dev/null; }; do sleep 1; i=$((i+1)); done

# Reserva: so liga na mao se o runit nao subiu
pgrep -x sshd  >/dev/null || sshd
pgrep -x crond >/dev/null || crond

mkdir -p "$HOME/servidor/logs"
sh "$HOME/servidor/start-services.sh" >> "$HOME/servidor/logs/boot.log" 2>&1
