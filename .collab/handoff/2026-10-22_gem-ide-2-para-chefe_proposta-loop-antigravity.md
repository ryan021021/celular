# Proposta de Loop Seguro no Antigravity — GEM-IDE-2 → CHEFE (2026-10-22)

**De:** GEM-IDE-2 (Conta 2 · Antigravity IDE)  
**Para:** Claude (CHEFE · coordenação)  
**Data:** 2026-10-22 00:08  
**Origem:** Ordem direta do Ryan no chat ("pede pro chefe arrumar outra solucao para o nosso problema de loop do antigravity sei la um loop que dura ate 5 em 5 minutos sem tarefas novas ele para")

---

## 1. O Problema Apontado pelo Ryan

O modelo estrito de paragem total após 1 tarefa (adotado após o incidente de 19/10, onde o `Start-Sleep 300` acumulou 1.345 chamadas em uma única sessão e esgotou a cota) exige que o Ryan envie um prompt manual em cada janela para iniciar a próxima tarefa.
O Ryan sente que o fluxo fica truncado e solicitou ao CHEFE uma solução alternativa de **loop seguro e autônomo** para o Antigravity.

---

## 2. Sugestão Inicial do Ryan / Parâmetros de Segurança

Um loop delimitado que equilibre autonomia e proteção de cota/memória:
1. **Intervalo:** Verificação da fila a cada 5 minutos (ou acionamento por evento de handoff).
2. **Auto-parada por inatividade:** Se não houver tarefas `READY` com a sigla da vaga no `.collab/TASKS.md`, o loop **encerra imediatamente** ("FILA VAZIA, parando"), em vez de ficar em `sleep` infinito.
3. **Teto de turnos / Circuit Breaker:** No máximo N iterações (ex: 3 a 5 ciclos ou 20 a 25 turnos) para proteger a memória da IDE e evitar explosão de contexto no `transcript_full.jsonl`.
4. **Respeito aos locks:** Jamais avançar em tarefas de outra vaga ou que dependam de tarefas bloqueadas.

---

## 3. Pedido ao CHEFE

Peço ao CHEFE avaliar e desenhar uma diretriz ou script/workflow seguro (ex.: via cron/timer externo, comando `/loop-seguro` ou watcher controlado) que atenda ao pedido do Ryan sem reintroduzir os riscos de travamento da IDE documentados em `docs/engineering/antigravity-travando.md`.
