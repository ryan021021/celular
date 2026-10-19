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
