# Testes de aceitação — 19/10/2026

Legenda: ✅ CONCLUÍDO E TESTADO · ⚠️ IMPLEMENTADO, NÃO TESTADO · ⛔ BLOQUEADO · ⏳ NÃO VERIFICADO (depende de ação/aprovação)

| Critério da missão | Estado | Evidência |
|---|---|---|
| Claude Code instalado e versão comprovada | ✅ | `claude --version` = `2.1.303 (Claude Code)`; SHA-256 igual ao do npm; sessão interativa `Opus 5.5 · Claude Pro` |
| Agente executa tarefa e termina | ✅ | AgentOps, perfil `leitura`: leu `nota.txt` e respondeu "abaixo de 45 °C", 1 tentativa, `succeeded` |
| Hermes instalado e testado no A13 | ⛔ | Guia oficial: só aarch64 e "The Termux package does not work right now" |
| Hermes como alternativa (worker no PC) | ⚠️ | Protocolo testado em dry-run (tarefa `pc-hermes` buscada pelo PC, `succeeded` no A13); execução real não feita (gasta uso da conta) |
| Serviço recupera de falha simulada | ✅ | AgentOps `kill -9` → volta em ~1 s com a fila intacta; painel `kill -9` → ~1 s |
| Fila sobrevive a reinício | ✅ | teste automatizado + `kill -9` real |
| Tarefa cancelada não continua | ✅ | teste automatizado (processo abortado); remoto: heartbeat devolve `cancel` |
| Retries com limite | ✅ | teste automatizado (para em `maxAttempts`); erro de login não é repetido (1 tentativa) |
| Kill switch impede novas tarefas | ✅ | pela rede: tarefa ficou `queued` com `paused: true` |
| Painel exige autenticação | ✅ | `/api/*` 401 sem token; `/` redireciona ao login (antes do console v1; o console foi testado pela sessão A13 OS: 63/63) |
| Endpoints sensíveis recusam sem autorização | ✅ | AgentOps 401 sem token, 403 com token de worker em rota de admin |
| Comando livre por HTTP | ✅ recusado | tarefa com campo `command` → 400 |
| Path traversal / symlink no servidor de arquivos | ✅ | SFTP: `cd ..`, `../`, caminho absoluto e atalho para `~/servidor` não saem de `~/shared` |
| Segredos fora de logs e respostas | ✅ | token admin ausente de `events.jsonl` e do log; leitura do arquivo de tokens pelo agente negada e nada vazou |
| SSH só com chave | ✅ | `Permission denied (publickey)` com senha; `sshd -T` conferido |
| Serviços fora da internet (IPv6 público) | ✅ | 8022, 8023, 8080, 8090, 8091 fechadas pelo IPv6 global; LAN ok |
| Proxy de saída só para a Anthropic | ✅ | api.anthropic.com passa; example.com negado; inacessível pela rede |
| DNS com rollback | ⛔ | não instalado: portas 53/853 negadas sem root |
| Backup e restauração | ✅ | SHA-256 ok, 165 arquivos, painel clonado = produção |
| Deploy falhado volta à versão anterior | ✅ | 2 casos reais: push quebrado de propósito e commit `9b7902c` → ROLLBACK automático, painel no ar |
| Reboot recupera os serviços | ✅ | 01:28 (aprovado pelo Ryan): Android em 96 s, **os 7 serviços + painel + AgentOps em 98 s**; login do Claude Code preservado; fila intacta; ajustes Android mantidos; 0 processos Google; IPv6 público sem porta aberta |
| Carga moderada | ✅ | só leitura, do PC: /health 300/300 (p95 81 ms), /api/v1/overview 60/60 (p95 1,76 s, recoleta de métricas), AgentOps /api/state 150/150 (p95 42 ms); 0 erros, nenhum PID trocou, MemAvailable 1450 → 1439 MB, alerta normal, bateria 28,8 °C |
| Acesso de fora de casa (IPv6/Tailscale) | ⏳ | depende de um celular no 4G e do login do Tailscale |
