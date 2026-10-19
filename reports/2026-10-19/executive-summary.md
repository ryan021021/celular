# Missão "A13 Server Rebuild" — relatório (sessão de 19/10/2026)

## 1. O que ficou realmente instalado
| Item | Estado | Onde |
|---|---|---|
| Claude Code 2.1.303 (binário oficial, sem modificação) | **CONCLUÍDO E TESTADO** (inicia; falta login) | A13 `~/opt/claude-code/`, comando `claude` |
| AgentOps (fila, perfis, kill switch, workers) | **CONCLUÍDO E TESTADO** | A13 serviço runit `agentops`, porta 8090 |
| Worker do PC (Claude Code / Hermes) | **IMPLEMENTADO**; protocolo testado em dry-run; execução real **não testada** (gasta uso das contas) | PC `tools/worker/worker.mjs` |
| Servidor de arquivos SFTP confinado | **CONCLUÍDO E TESTADO** | A13 serviço `sftp`, porta 8023, pasta `~/shared` |
| ripgrep 15.2.0, patchelf 0.19.2, rclone 1.75.2 | instalados do repositório oficial do Termux | A13 |
| Hermes Agent no A13 | **BLOQUEADO** (só aarch64; pacote Termux quebrado segundo o guia oficial) | — |
| Bloqueio de anúncios por DNS no A13 | **BLOQUEADO** (porta 53/853 negada sem root) | alternativas em `docs/NETWORK_DNS_FILES.md` |

## 2. Evidências
| Resultado | Comando / prova |
|---|---|
| Kernel 64 bits, Android 32 bits | `abilist64` vazio; binário ARM64 deu "required file not found" (falta carregador), não "formato inválido" |
| Claude Code roda | `claude --version` → `2.1.303 (Claude Code)`; SHA-256 igual ao do pacote npm |
| Claude Code integrado | tarefa real no perfil `leitura` → falhou em 1 tentativa com "Claude Code sem login no A13" |
| AgentOps | 15/15 testes no A13; pela rede: 401 sem token, 400 para tarefa com campo `command`, kill switch segura a fila, `kill -9` → volta em ~1 s com a fila intacta, token ausente dos logs |
| Worker do PC | dry-run: tarefa `pc-hermes` buscada pelo PC e marcada `succeeded` no A13; worker aparece `idle` |
| SFTP | 50 MB com SHA-256 igual; `cd ..`, `../`, caminho absoluto e atalho para `~/servidor` não saem de `~/shared`; chave de admin recusada; host key conferida pelo cabo USB |
| DNS | `bind` em 53/853 → `EACCES`; 5353 → OK |
| Backup | inclui agentops e sftp; restauração conferida (165 arquivos; painel clonado = produção) |

## 3. Falhas encontradas e corrigidas
- `patchelf` corrompeu o binário do Claude Code (segfault) → descartado; uso via carregador, binário intacto.
- Revisão independente da outra sessão Claude encontrou 5 defeitos e 3 riscos no AgentOps (execução dupla após reinício, resultado atrasado aceito, state.json corrompido sobrescrito, cancelamento não chegava ao worker, erro interno como 400, regras de leitura incompletas, repetição de edição, escrita amplificada) → todos corrigidos, 4 testes novos.
- `pkill -f`/`pgrep -f` derrubou a própria sessão SSH (padrão casava com o comando) → corrigido com `^node`.

## 4. Bloqueios que exigem você
1. **Login do Claude Code no A13**: `ssh -t -p 8022 u0_a271@192.168.1.127 claude` → `/login` → abrir o link no PC. Depois, rodar uma tarefa no perfil `leitura` e uma pedindo para ler `~/servidor/agentops-workers.json` (tem que ser negada).
2. **Ligar o worker do PC de verdade** (`node tools/worker/worker.mjs`): usa suas contas Claude/Hermes.
3. **Tailscale**: login na conta (o Gemini instalou o APK; tela de login aberta).
4. **DNS sem anúncios**: decidir entre DNS privado por aparelho, roteador ou Pi-hole no PC.
5. **Chave do backup**: copiar `%USERPROFILE%\.servidor-a13\backup.key` para fora do PC.

## 5. Riscos que continuam
- Isolamento dos agentes é lógico (regras do Claude Code), não sandbox de kernel; por isso nenhum perfil local libera Bash.
- O Gemini mexeu no A13 com o lock do Claude ativo (Tailscale, debloat); conflitos de lock seguem acontecendo.
- O Claude Code no A13 depende de um carregador externo; atualização é manual.
- Sem internet não há alerta.

## 6. Baseline × agora
| Métrica | Antes (18/10) | Agora |
|---|---|---|
| RAM disponível | 1,85 GB (antes do debloat do Google) / 2,03 GB (depois) | **1,57 GB** (mediana de 3 amostras, 00:31), com AgentOps (33 MB RSS) e SFTP/rclone (46 MB RSS) rodando; o resto da diferença é cache/variação após o boot, não medida em separado |
| Serviços supervisionados | 4 | 6 (+ agentops, sftp) |
| Portas na rede | 8022, 8080 | 8022, 8080, 8090 (token), 8023 (chave) |
| Agentes no A13 | 0 | Claude Code (falta login) |

## 7. Próxima tarefa de maior impacto
Fazer o login do Claude Code no A13 e rodar os dois testes de permissão. Com isso o AgentOps passa a executar tarefas reais, e as regras de bloqueio deixam de ser "não verificadas".
