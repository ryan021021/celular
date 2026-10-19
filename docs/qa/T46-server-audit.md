# T46 · Conferência de `reports/server_audit_2026-10-19/` (QA, 19/10/2026)

Pasta não rastreada pelo git, autor não registrado. Conferi pelo repositório e pelos logs do PC; o A13 está fora do ar, então nada foi medido ao vivo. Estados: **CONFERE** (evidência no repositório), **FALSA/IMPRECISA**, **NÃO VERIFICÁVEL** (precisa do A13).

| # | Afirmação | Estado | Evidência |
|---|---|---|---|
| 1 | Backup semanal "valida a restauração de 235 ficheiros" (SUMMARY §3.8, EVID-024) | **FALSA** | `backups/backup-agendado.log:5`: "restauracao conferida: 206 arquivos" |
| 2 | "CPU a 29,9 °C, longe do limite de estrangulamento de 36,0 °C" (SUMMARY §2, PERFORMANCE) | **IMPRECISA** | 36,0 °C é o limiar da PELE (EVID-013 diz isso); a CPU (AP) não tem esse limiar. Comparação de grandezas diferentes; "83% do limiar" idem |
| 3 | Veredito "estável e altamente resiliente" | **NÃO SUSTENTADA** | Medição única de 10 min; o relatório admite 3 limitações críticas (sem root, DHCP dinâmico, sem acesso externo); o A13 ficou offline ~2 h depois (T40) |
| 4 | Claude Code no A13 via `ld-musl-aarch64.so.1` | CONFERE | `server/agentops/adapters.mjs:79-81` |
| 5 | Proxy de saída só para domínios da Anthropic | CONFERE | `server/termux/egress-proxy.mjs:10` (`anthropic.com,claude.ai,claude.com`; "evilanthropic.com" não casa, linha 16) |
| 6 | sshd só chave pública, sem senha, keepalive | CONFERE | `server/termux/sshd-servidor.conf:3-9` (config do repositório; o arquivo em uso no A13 não foi relido) |
| 7 | Sintaxe "15/15 Node, 18/18 Bash, 9/9 PowerShell" (EVID-035) | CONFERE, desatualizada | bate com `regressao-2026-10-19-0641.md`; hoje é 20/18/12 |
| 8 | Uptime do server-box ">3,3 horas" | CONFERE | 12.016 s = 3,3 h (EVID-019 dá segundos) |
| 9 | Hermes "bloqueado no A13 por userspace 32 bits" | IMPRECISA | EVID-020 só mostra `hermes: command not found`; o bloqueio documentado é segurança (Q2, T22), não 32 bits |
| 10 | `alerts.mjs` com gatilho de bateria (passo 8) | CONFERE que o arquivo existe | `server/panel/server-box/alerts.mjs`; o gatilho é proposta, não existe |
| 11 | Medidas do A13 (RAM 3,62 GiB, 102 GB livres, temperaturas, bateria 100%/ProtectBattery 80%, portas, 7 serviços, Tailscale sem tun0, sem root) | NÃO VERIFICÁVEL agora | os mesmos valores de RAM/Node já foram medidos pela QA (AFIRMACOES.md); o resto depende do A13 voltar |
| 12 | Medidas do PC (i3-1115G4, 15,7 GiB RAM, disco C: 21,9 GB livres) | NÃO VERIFICADA | não conferi; baixo risco |

## Pedidos
- Corrigir 1 e 2 no relatório (ou marcar o relatório como rascunho). Quem escreveu: registrar autor e hora no LOG.
- Quando o A13 voltar: reler 11 com o lock, uma vez, e fechar a T46.
