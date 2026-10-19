# Rede, DNS e arquivos

## Servidor de arquivos (SFTP) — funcionando
- Pasta: `~/shared` no A13 (permissão 700). Nada fora dela é acessível.
- Endereço: `sftp://u0_a271@192.168.1.127:8023`, só com a chave `~/.ssh/a13_arquivos` do PC.
- Host key (conferida pelo cabo USB): `SHA256:om3wgAEdl+6Cl98zgtLM7qU92754Jvvgf/vFQ2FkKww`.
- Serviço runit `sftp` (rclone 1.75.2); log em `~/servidor/logs/sftp/current`.
- Escuta só no IPv4 do Wi-Fi (descoberto ao iniciar). Se o IP do A13 mudar, reinicie o serviço (`sv restart sftp`); por isso vale reservar o IP no roteador. Pelo Tailscale o SFTP não responde até ser incluído.

| De onde | Como conectar |
|---|---|
| Windows (terminal) | `sftp -i %USERPROFILE%\.ssh\a13_arquivos -P 8023 u0_a271@192.168.1.127` |
| Windows (WinSCP/FileZilla) | Protocolo SFTP, porta 8023, chave privada `a13_arquivos` (converter para .ppk no WinSCP) |
| Linux/macOS | `sftp -i ~/.ssh/a13_arquivos -P 8023 u0_a271@192.168.1.127` |
| Android | App com SFTP (ex.: Material Files, Solid Explorer) importando a chave |

Testado: listar, baixar, enviar, nomes com espaço/acentos, 50 MB com SHA-256 igual; `cd ..`, `../` e caminho absoluto não saem da pasta; atalho para `~/servidor` não aparece; chave de admin é recusada.
Limites: 103 GB livres no aparelho; não há cota por pasta (Android sem root). Arquivos em `~/shared` **não** entram no backup cifrado (podem ser grandes): copie o que importa.

## Bloqueio de anúncios por DNS — bloqueado no A13
Teste real no aparelho: escutar nas portas 53 e 853 dá `EACCES` (Android sem root não deixa apps usarem portas abaixo de 1024). As portas 5353/5354 funcionam, mas roteadores, Windows e o "DNS privado" do Android só falam com a porta 53/853. Portanto o A13 **não** pode ser o DNS da rede sem root.

Alternativas que funcionam (nenhuma aplicada; mexer no DNS do roteador é decisão do Ryan):
| Opção | Onde | Observação |
|---|---|---|
| DNS privado do Android com um provedor de bloqueio (ex.: AdGuard DNS, NextDNS) | Em cada celular | Sem instalar nada; testar num aparelho primeiro |
| DNS do roteador apontando para um provedor de bloqueio | Roteador | Vale para a casa toda; anotar o DNS antigo para voltar |
| Pi-hole / AdGuard Home no PC (Windows via WSL ou Docker) | PC | O PC precisa ficar ligado; se desligar, a rede perde DNS — sempre ter DNS secundário |

Bloqueio por DNS não pega anúncios servidos pelo mesmo domínio do conteúdo (ex.: parte dos anúncios de vídeo).

## IPv6
O A13 recebe IPv6 público do provedor. Todos os serviços escutam só em IPv4 (verificado em 19/10: 8022, 8023, 8080, 8090 e 8091 fechadas pelo IPv6 global). Ainda não foi testado de fora da casa (precisa de um celular no 4G).

## Acesso remoto
Tailscale: em andamento pelo Gemini (T9: APK instalado, tela de login aberta). Precisa do login do Ryan na conta Tailscale.
