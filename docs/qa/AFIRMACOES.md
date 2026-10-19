# Checagem de afirmações (QA, T20)

Afirmação de documento conferida contra o aparelho ou contra evidência registrada. Medições da QA em 19/10 entre 06:48 e 06:55,
por ADB e SSH, só leitura, com o lock (`.collab/locks/a13-servidor.lock`, já solto).
Estado: **confirmada** (bate com a medição) · **falsa** (a medição contradiz) · **enganosa** (o número existe, mas induz a erro) ·
**sem prova** (ninguém mediu) · **documentada** (evidência no LOG ou em relatório, não medida de novo pela QA).

| Onde | Afirmação | Estado | Medido / evidência | Dono |
|---|---|---|---|---|
| `README.md:20` | Galaxy A13 "7.6 GB RAM / 100 GB SSD" | **enganosa** | `MemTotal 3795712 kB` (3,62 GiB) + `SwapTotal 4194300 kB` (4 GiB de "RAM Plus", que é armazenamento, não RAM); disco 109 GB de memória flash, não SSD. O `profiles/a13.json:11` já explica certo ("3.6 GB RAM + 4.0 GB Swap") | GEM-IDE |
| `README.md:66-71` | Node v26.4.0, Python 3.14.6, Git 2.56.0, cURL 8.23.0, OpenSSH 10.6p1 | **confirmada** | `node v26.4.0`, `Python 3.14.6`, `git version 2.56.0`, `curl 8.23.0`, `OpenSSH_10.6p1` | — |
| `docs/ARCHITECTURE.md:16` | "Node v24.18.0 (`nodejs-lts`)" | **falsa** | pacote instalado `nodejs 26.4.0-1` (dpkg); `$PREFIX/bin/node -v` = v26.4.0; egress, AgentOps, painel e alertas rodam esse binário (`/proc/<pid>/exe`) | quem mantém o ARCHITECTURE (BACK/ORQ) |
| `profiles/a13.json:29` | `"node": "v24.18.0"` | **falsa** | idem | GEM-IDE |
| `server/termux/setup.sh:7` | instala `nodejs-lts` | **diverge da produção** (achado Q8) | produção usa `nodejs` 26; no Termux os dois conflitam, então o `deploy.ps1 -Step Install` ou uma reconstrução trocaria a versão principal do Node | ORQ |
| `docs/ARCHITECTURE.md:13-15` | 3,62 GiB de RAM (MemTotal 3.886.809.088 B); swap de 4 GiB; 109 GB de disco com 102 GB livres | **confirmada** | 3795712 kB = 3.886.809.088 B; `df`: 109G, 102G livres | — |
| `docs/ARCHITECTURE.md:11` | SM-A135M, Android 14, userspace 32 bits (`armv8l`) | **confirmada** | `getprop`: SM-A135M e 14; `uname -m`: armv8l | — |
| `README.md:20` | A13 "ONLINE", SSH em `192.168.1.127:8022` | **confirmada** | SSH por chave nesse endereço respondeu às 06:5x | — |
| `README.md:3` | "servidores Linux de alto desempenho" | **sem prova** | nenhum teste de desempenho registrado; `known-limitations.md` lista o contrário (sem root, userspace 32 bits, 3,6 GiB). Sugestão: "servidor caseiro de baixo consumo" | GEM-IDE |
| `README.md:11` | scrcpy "60 FPS, sem crash de áudio" | **sem prova** | não medido pela QA nem registrado no LOG | GEM-IDE |
| `reports/2026-10-19/known-limitations.md:15` | servidor volta em ~73 s depois do reboot | **documentada** | LOG 19/10, reboot de validação das 00:08 | — |
| `reports/2026-10-18/executive-summary.md:16` | push quebrado volta sozinho (rollback) em 7 s | **documentada** | LOG 19/10, "Programa VPS, lote 1" | — |

## Fora do alcance desta checagem
- Afirmações de segurança (só chave no SSH, IPv6 fechado, tokens): foram conferidas pelas sessões que as fizeram e estão no LOG. A QA não repetiu o teste de rede pelo IPv6.
- `docs/OPERATIONS.md`, `docs/SECURITY_MODEL.md` e `docs/NETWORK_DNS_FILES.md` não foram lidos linha a linha nesta rodada.
