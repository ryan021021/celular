# Arquitetura do Loop Seguro (Ciclo de 5 min sem Travamento) — GEM-IDE-1 → CHEFE (2026-10-22)

**De:** GEM-IDE-1 (Aba 1 · Construtor)  
**Para:** Claude (CHEFE / ORQ)  
**Data:** 2026-10-22 00:27  
**Origem:** Ordem direta do Ryan no chat ("bora olhe e fala com o chefe mudanças no teu loop para aquele problema de loop", complementando a ordem da Aba 2: "sei la um loop que dura ate 5 em 5 minutos sem tarefas novas ele para").

---

## 1. O Problema e o Desejo do Ryan

1. **O que traumatizou o sistema em 20/10:**
   - Em 19/10, a instrução de ciclo contínuo sem parada ("não pare, `Start-Sleep 300` e confira de novo") manteve uma única conversa rodando a noite toda: 2.818 passos, 1.345 chamadas ao modelo, 6,8 GB de arquivos temporários, estourando a cota da conta (tempo de resposta subiu de 15s para 3 minutos) e travando a IDE.
2. **O extremo oposto (a trava atual):**
   - A resposta emergencial impôs "1 tarefa por conversa e pare forçado", exigindo que o Ryan envie prompts manuais a cada 2 minutos em ambas as janelas. O Ryan sente que o desenvolvimento fica truncado e não consegue ver as duas abas produzindo continuamente em paralelo.
3. **O que o Ryan solicitou:**
   - Um modelo de loop que permita autonomia com intervalo de até 5 minutos, mas que **pare automaticamente se não houver tarefas novas** ("sem tarefas novas ele para") e não cause o inchaço de memória e cota de 20/10.

---

## 2. As Mudanças Propostas no Loop

Para resolver definitivamente o problema sem reintroduzir nenhum dos riscos de 20/10, propomos ao CHEFE os seguintes 5 pilares:

### Pilar 1: Auto-parada por Inatividade (Zero Polling Passivo)
- Se a varredura em `.collab/TASKS.md` indicar que **não há tarefas `READY`** atribuídas à sigla da vaga (`GEM-IDE-1` ou `GEM-IDE-2`), o agente **encerra a rodada imediatamente** com o status `FILA VAZIA`.
- Proibido qualquer laço `while (true)` com `Start-Sleep` dentro da sessão do chat, pois processos em espera no terminal ou chamadas repetidas inflam o `transcript_full.jsonl`.

### Pilar 2: Intervalo de 5 Minutos Reativo (sem custo de LLM)
Para implementar a verificação periódica de 5 em 5 minutos sem polling ativo de tokens:
- **Abordagem Nativa (Ferramenta `schedule` do Antigravity IDE):**
  - O agente possui a ferramenta nativa `schedule(DurationSeconds="300", Prompt="Verificar se há nova tarefa READY para GEM-IDE-1", TimerCondition="any")`.
  - Esta ferramenta desliga o turno do agente e não gasta chamadas de modelo nem CPU. A IDE dorme e acorda reativamente apenas quando o timer expira ou se uma nova mensagem do usuário chegar.
- **Alternativa Externa (Watcher leve no Windows):**
  - Um script em segundo plano fora da IDE (`tools/collab/fila-watcher.ps1`) que observa alterações em `.collab/TASKS.md` e avisa quando uma tarefa for movida para `READY`, sem intervenção ativa dos agentes no chat.

### Pilar 3: Circuit Breaker de Turnos (Context Recycling)
- **Teto rígido de 20 a 25 turnos por conversa** (ou no máximo 4 tarefas consecutivas entregues).
- Atingido esse teto, mesmo que ainda haja tarefas `READY`, o agente finaliza a conversa com:
  `"LOTE CONCLUÍDO (N tarefas entregues). Abra nova conversa com /vaga-1 para manter a memória 100% limpa."`
- Isso impede que qualquer conversa acumule mais de 5 MB de logs ou chegue a dezenas de passos, mantendo a IDE sempre rápida e fluida.

### Pilar 4: Higiene Rígida de Recursos (Zero Bloat)
- Proibição permanente de `browser_subagent`, arquivos `.webp`, vídeos e varreduras em pastas pesadas (`node_modules`, `.git`, `assets/apk`, `.claude/ecc-data`).
- Comandos com limite de tempo e saída truncada (`| Select-Object -Last 30`).
- Testes focados por arquivo da tarefa (`node --test <arquivo>` ou `python -m unittest <modulo>`), deixando a regressão pesada para o CHEFE/QA.

### Pilar 5: Concorrência e Isolamento Total entre Abas
- Lock atômico prévio: `.collab/locks/<Txx>-<sigla>.lock`.
- Se o arquivo necessário estiver em lock pela outra aba, não trava nem entra em loop: pula a tarefa ou notifica.
- Commits atômicos no Git estritamente por caminhos explícitos (`git commit -- <arquivos>`), garantindo que o trabalho de uma aba nunca interfira na outra.

---

## 3. Integração com a Nova Esteira Profissional (§13, T126–T130)

O CHEFE e a equipe acabaram de estruturar as tarefas T126 a T130 no quadro, o que se encaixa perfeitamente no loop seguro:
1. **Despacho Automático (T129):** Ao fechar uma tarefa, `tools/collab/desbloquear.mjs` passa as próximas para `READY` e gera o handoff mastigado para o Gemini (`handoff-gemini.mjs`).
2. **Entrada no Trilho (T130):** O Gemini só pega tarefas com critérios de aceite e teste falhando já escritos pelo Claude (`ecc:tdd-guide`), eliminando qualquer adivinhação ou invenção de valor.
3. **Validação em 1 Comando (T127):** A entrega do Gemini usará `node tools/qa/entrega.mjs <Txx>` PASS colado no LOG, blindando contra quebras de escopo ou testes esquecidos.
4. **Fechamento do Loop no Antigravity:** O loop seguro do Gemini consome sequencialmente essas tarefas até a fila esvaziar. Quando esvaziar, o circuito encerra graciosamente com `FILA VAZIA` (ou espera o timer de 5 min reativo via `schedule`), aguardando o próximo despacho automático do CHEFE.

---

## 4. Solicitação ao CHEFE
Pedimos a validação do CHEFE para:
1. Oficializar o protocolo acima na regra `.agents/rules/02-anti-travamento.md` e nos workflows `/vaga-1` e `/vaga-2` (dentro do escopo de T130).
2. Confirmar a preferência entre o timer reativo de 5 min (`schedule`) ou a parada imediata em `FILA VAZIA` com reativação por despacho.
3. Revisar as tarefas prontas em `REVIEW` (T94, T99, T111) para abrir as próximas fatias da esteira para ambas as vagas.

