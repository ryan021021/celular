# AgentOps — Serviço de Orquestração de Agentes

Serviço leve em Node.js (porta 8090) responsável por enfileirar, distribuir e auditar a execução de tarefas para agentes de IA locais (no celular via Claude Code) e remotos (no PC via worker).

## Autenticação e Perfis

O serviço opera com dois níveis de acesso via cabeçalho `Authorization: Bearer <token>`:
- **Admin** (`~/servidor/agentops.token`): controle total da fila (criar, listar, inspecionar, cancelar e repetir tarefas, pausar e retomar o executor).
- **Worker** (`~/servidor/agentops-workers.json`): restrito aos workers cadastrados para envio de heartbeat, reivindicação de tarefas (`claim`) e devolução de resultados.

As tarefas nunca executam comandos livres; elas referenciam obrigatoriamente um perfil homologado em `profiles.json` (ex.: `leitura`, `edicao`, `pc-claude`).

---

## Prioridade das Tarefas (`priority`)

O escalonamento da fila do AgentOps é orientado por prioridade estrita com desempate cronológico.

### 1. Escala e Valores Aceitos
- **Intervalo:** Número inteiro de `0` a `9` (`server/agentops/core.mjs:51`).
- **Validação:** Qualquer valor que não seja um inteiro entre 0 e 9 é rejeitado na submissão com HTTP 400 (`"prioridade deve ser inteiro de 0 a 9"`).
- **Padrão:** Se o campo `priority` for omitido na criação da tarefa via `POST /api/tasks`, o sistema atribui automaticamente prioridade **`5`** (`server/agentops/server.mjs:120`, `core.mjs:100`).

### 2. Ordem de Despacho e Execução
Tanto para agentes locais (`runner.tick()`) quanto para workers remotos (`runner.claim()`):
```javascript
// server/agentops/core.mjs:181 e 209
.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0]
```
- **Prioridade 9:** Máxima prioridade. É despachada e atendida antes de qualquer outra tarefa na fila.
- **Prioridade 5:** Prioridade média / padrão do sistema.
- **Prioridade 0:** Menor prioridade. Fica no fim da fila e só é executada quando não houver tarefas com prioridades maiores prontas para execução.

### 3. Critério de Desempate (FIFO)
Quando duas ou mais tarefas possuem a **mesma prioridade**, o desempate é feito por ordem cronológica de criação (`a.createdAt - b.createdAt`). A tarefa mais antiga é sempre despachada primeiro.

---

## Endpoints Principais

### Geral
- `GET /health`: Checagem de vida do serviço (`{ ok: true, service: "agentops" }`).

### Admin (`Authorization: Bearer <adminToken>`)
- `GET /api/state`: Estado consolidado dos contadores, agentes, workers e perfis.
- `GET /api/tasks?status=<status>&limit=<n>`: Listagem de tarefas na fila (máximo 100).
- `GET /api/tasks/:id`: Detalhes completos da tarefa (inclui `prompt` e `output`).
- `POST /api/tasks`: Criação de tarefa. Corpo JSON:
  ```json
  {
    "profile": "leitura",
    "prompt": "Verificar status do sistema",
    "priority": 8
  }
  ```
- `POST /api/tasks/:id/cancel`: Cancela uma tarefa pendente ou em execução.
- `POST /api/tasks/:id/retry`: Reenfileira tarefa falha ou cancelada.
- `POST /api/pause` / `POST /api/resume`: Pausa ou retoma o despachante de tarefas.

### Worker (`Authorization: Bearer <workerToken>`)
- `POST /api/worker/heartbeat`: Sinal de vida e capacidades suportadas pelo worker.
- `POST /api/worker/claim`: Reivindica a próxima tarefa disponível de maior prioridade.
- `POST /api/worker/result`: Entrega o resultado (`{ id, leaseId, ok, output?, error? }`).

## Versão do `state.json` (T73)
O arquivo carrega `schema_version` (hoje 1). Ao abrir, um arquivo sem versão (v0) é migrado para v1: o original fica ao lado como `state.json.v0-<ms>.bak` e a migração é registrada em `events.jsonl` (`state.migrated`). Arquivo já na v1 não é regravado. Arquivo ilegível, de formato impossível ou de versão mais nova que o código vira `state.json.corrompido-<ms>` e a fila começa vazia, sem apagar nada.
