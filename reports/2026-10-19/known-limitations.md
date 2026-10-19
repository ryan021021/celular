# Limitações conhecidas — 19/10/2026

| Limitação | Por quê | Impacto | Contorno |
|---|---|---|---|
| Sem root | Aparelho de produção, sem desbloqueio | Sem chroot, namespaces, firewall, tuning de kernel/CPU/térmico | Isolamento lógico (regras do Claude Code) e serviços só em IPv4/LAN |
| Android 32 bits sobre kernel 64 bits | Configuração da Samsung para o A13 4G | Binários arm64 só rodam com carregador musl; Hermes (só aarch64) não roda | Claude Code via carregador; Hermes como worker no PC |
| Claude Code no A13 depende do carregador musl e do proxy `egress` | musl procura `/etc/resolv.conf` (inexistente) | Sem o proxy, o Claude Code não acha DNS; atualização é manual | Proxy local só com domínios da Anthropic; procedimento em AGENT_RUNTIME_MATRIX |
| Agentes locais sem Bash | Sem sandbox de kernel, Bash daria acesso a tudo do usuário do Termux | Perfis locais só leem/editam a própria pasta | Trabalho pesado vai para o worker do PC |
| Assinatura Pro dividida | Limites de 5 h e semanais são os mesmos do uso pessoal | Agentes podem consumir o limite do Ryan | API key só para agentes, com teto de gasto, se o uso crescer |
| DNS sem anúncios no A13 | Portas 53/853 negadas sem root (EACCES) | Não dá para ser o DNS da rede | DNS privado por aparelho, roteador ou Pi-hole no PC |
| SFTP preso ao IPv4 do Wi-Fi | Em Go, 0.0.0.0 também abre o IPv6 público | Se o IP mudar, o SFTP precisa de restart; não responde pelo Tailscale | Reservar IP no roteador |
| Sem internet, sem alerta | ntfy depende da internet | Queda do Wi-Fi não é avisada | — |
| Tela quebrada com toque fantasma | Hardware | Toques aleatórios podem clicar em coisas; tela pode ficar acesa após boot | `adb shell input keyevent KEYCODE_SLEEP` |
| Bateria 24/7 no carregador | Uso como servidor | Desgaste; risco se estufar | Proteção de bateria em 80% |
| Uptime não garantido | Android pode matar processos e o aparelho pode reiniciar | Serviço caseiro, sem SLA | runit + Termux:Boot (volta em ~73 s) + alertas |
| `/proc/uptime`, `/proc/loadavg`, `/proc/net/tcp` bloqueados | SELinux do Android | Algumas métricas do painel vêm por caminhos alternativos | — |
| Coordenação entre agentes | 3 sessões Claude + Gemini no mesmo projeto | Conflitos de lock já ocorreram (debloat, Tailscale, checkout do painel) | Lock antes de qualquer comando no A13; handoffs só acrescentando |
