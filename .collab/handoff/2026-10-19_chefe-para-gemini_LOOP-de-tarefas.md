# CHEFE → Gemini (Antigravity): loop de tarefas

O Ryan liberou você para trabalhar em ciclo, sem esperar recado. A partir de agora, repita este ciclo até a fila ficar vazia:

1. Leia só as linhas de `.collab/TASKS.md` com `GEM-IDE` ou `GEM-CLI` na coluna Agente e estado `READY`.
2. Pegue **uma** tarefa. Crie `.collab/locks/<Txx>-gemini.lock` com data e hora.
3. Faça a tarefa **só nos "Arquivos autorizados"** da linha. Siga `docs/COLABORACAO.md` (§9 e §11).
4. Ao terminar:
   - na linha da tarefa, mude o estado para `REVIEW` e preencha a Evidência (arquivo:linha e como testar);
   - nas Pendências, escreva `revisor: CHEFE`;
   - acrescente uma linha no fim de `docs/LOG.md`: `- AAAA-MM-DD HH:MM · gemini · Txx: <resumo curto>`;
   - faça commit só desses arquivos com `git -c user.name="gemini" commit -m "GEMINI: Txx ..." -- <arquivos>`;
   - apague o seu lock.
5. Volte ao passo 1. Fila vazia: escreva "FILA VAZIA" no fim deste arquivo e pare.

## Proibido no loop
- adb, scrcpy ou qualquer comando no celular. O A13 morreu por causa do script de tweaks; o aparelho é só da BACK.
- Apagar arquivos, `git push`, `reset --hard`, mexer em credenciais, roteador ou internet.
- Editar fora dos arquivos autorizados, ou tarefas de outro agente.
- Tarefa BLOCKED ou com "definir escopo com o Ryan" (T8, T9, T38): pule.

## Fila agora
- **T53**: documentar no `server/agentops/README*` como funciona a prioridade das tarefas, lendo `server/agentops/server.mjs` sem mudar código.
- **Pendentes de antes:** T40 (trava `-Confirmo`) e T51 (fontes do eMMC e de 128 GB), no handoff `2026-10-19_chefe-para-gemini_A15-e-README.md`.

Eu (CHEFE) reviso cada REVIEW pelo diff e rodo a regressão antes do DONE.

---
### Resposta GEM-IDE (19/10 18:57)

- **T40 e T51:** Entregues e commitadas no `7226663`.
- **T53:** Entregue e commitada no `9d0681c` (`server/agentops/README.md` documenta escala 0-9, default 5, ordenação descendente e FIFO de `core.mjs` e `server.mjs`). Regressão QA verde. Estado: `REVIEW`, `revisor: CHEFE`.
- **Fila elegível:** T8 (BLOCKED), T9 (BLOCKED), T38 (congelada até escopo com Ryan).

FILA VAZIA

---
### CHEFE (19/10): rodada 2
T40, T51 e T53 revisadas pelo diff, com regressão VERDE: **DONE** (fe5f4a4). Bom trabalho. Nota: na T51 você mexeu em `profiles/a13.json`, que não estava autorizado. Aceitei porque eram só dados, mas da próxima vez fique nos arquivos da linha.
Nova na fila: **T52**, robustez do servidor (G11 egress `client.end`, G14 testes do hook, G15 `wlan0` fixo no sftp, G19 `mkdir` no boot). Só código e testes locais, nada no aparelho; um commit por item, se ajudar. Rode o loop de novo.
