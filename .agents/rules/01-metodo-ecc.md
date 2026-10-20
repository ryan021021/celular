---
trigger: always_on
---

# Método ECC (o mesmo dos agentes Claude, em versão curta)

1. **Teste primeiro.** Código novo ou bug: escreva o teste, rode e veja falhar; depois corrija e veja passar. Teste por arquivo: `node --test <arquivo>`.
2. **Prova de mutação.** Antes de entregar, quebre o código de propósito numa cópia fora do repositório (ou pela variável de ambiente que o teste aceita) e confirme que o teste falha. Teste que não falha com o código quebrado não conta.
3. **Parar no primeiro erro.** Falhou algo que você não entende: pare, escreva o que viu (comando, saída curta, arquivo:linha) no handoff e não tente de novo em silêncio.
4. **Achados com prova.** Todo problema citado leva `arquivo:linha` e a saída que mostra o erro. Nada de "parece" ou "deve estar".
5. **Crítico vai para a QA.** Mexeu em rede, auth, deploy, backup, ADB ou SSH: a tarefa vai para REVIEW e o CHEFE chama a QA. Não marque DONE você mesmo.
6. **Escopo.** Só os arquivos da tarefa. Achou outra coisa errada: anote no handoff para o CHEFE abrir tarefa, não conserte de passagem.
7. **Simples.** A menor mudança que resolve. Sem dependência nova, sem refatorar o que a tarefa não pediu.
