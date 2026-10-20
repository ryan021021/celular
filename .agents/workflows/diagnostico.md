---
description: O agente descobre sozinho por que está lento ou travando (só lê; quem muda configuração é o Ryan)
---

Objetivo: dizer ao Ryan, em português simples, **por que** o agente está lento ou travado e **o que ele clica** para resolver. Você só lê e explica. Não mude configuração, não mova nem apague arquivo, não feche processo, não rode nada em ciclo.

1. Rode **uma vez**, com limite de 2 minutos:
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools/optimize/antigravity-diagnostico.ps1`
   Se não terminar em 2 minutos ou der erro, mostre ao Ryan as últimas 10 linhas e pule para o passo 4.
2. Para cada linha `ALERTA:`, explique em 1 linha o que significa e o que o Ryan faz:

   | ALERTA fala de | Causa | O que o Ryan faz |
   |---|---|---|
   | `s por resposta` / cota | o modelo demora; quase sempre é o limite de uso da conta | trocar o modelo no seletor do painel do agente (ex.: Claude) ou esperar renovar; conversa nova |
   | `passos` | conversa grande demais | conversa nova, uma tarefa por conversa |
   | `execucao automatica` (turbo) | o agente roda comandos sem pedir | painel do agente → Terminal: **pedir revisão** |
   | `fora do workspace` | o agente pode mexer fora de `celular` | painel do agente → desligar acesso fora do workspace |
   | `JS no navegador` | o navegador do agente roda script sem pedir | painel do agente → navegador: **pedir revisão** |
   | `superpowers` | plugin entra no contexto de toda conversa | fechar a IDE e mover a pasta para `~/.gemini/config/plugins-desligados` (o CHEFE faz, se o Ryan pedir) |
   | `MCP pesado` | a IDE sobe esse servidor antes de liberar o agente | `"disabled": true` no `mcp_config.json` citado (o CHEFE faz, se o Ryan pedir) |
   | `checkpoint` | esta versão da IDE não reconhece o modelo escolhido | trocar o modelo ou atualizar o Antigravity |

3. Sem nenhum ALERTA e ainda lento? Confira só isto e diga o que achou:
   - a janela está com a pasta `celular` aberta (File → Open Folder)? Sem pasta, as regras de `.agents/` não valem;
   - `RAM livre` abaixo de 2 GB? Peça ao Ryan para fechar janelas que não usa (só pedir; você não fecha nada);
   - mais de 2 janelas do Antigravity? Deve haver no máximo 2 (uma por vaga).
4. Se achou algo que a tabela não cobre, escreva `.collab/handoff/AAAA-MM-DD_<sigla minúscula>-para-chefe_diagnostico.md` com as linhas `ALERTA` e o resumo do script, mais a sua leitura em até 5 linhas.
5. Responda ao Ryan com uma lista numerada curta: problema → o que clicar. Termine com "DIAGNÓSTICO FEITO" e **pare**. Não rode o script de novo para conferir: o Ryan muda, abre conversa nova e roda `/diagnostico` outra vez se quiser.
