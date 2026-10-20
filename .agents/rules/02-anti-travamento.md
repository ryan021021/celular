---
trigger: always_on
---

# Não travar a IDE (o agente ficou em "working" para sempre em 20/10)

1. **Uma conversa por tarefa.** Terminou a tarefa ou passou de uns 30 turnos: diga "TAREFA ENTREGUE, abra conversa nova" e pare. O estado vive em `.collab/`, não na conversa.
2. **Sem tarefa READY com a sua sigla:** responda "FILA VAZIA" e pare. Proibido loop, `sleep`, `Start-Sleep`, `watch`, polling ou "vou verificar de novo".
3. **Comando com limite.** Tudo que pode passar de 1 minuto roda com limite de tempo e saída curta (`| Select-Object -Last 30` ou `| tail -n 30`). Nunca deixe processo rodando em segundo plano.
4. **Sem regressão inteira aqui.** `node tools/qa/regressao.mjs` (cerca de 3 minutos) não roda no agente; rode só `node --test <arquivo>` da tarefa. A regressão fica com o CHEFE.
5. **Sem navegador do agente, sem gravação, sem arquivo grande.** Nada de `.webp`, vídeo, APK ou captura dentro do repositório.
6. **Leitura econômica.** Leia arquivo por trecho (`TASKS.md` só as linhas da sua sigla). Não liste nem busque em `assets/apk`, `backups`, `node_modules`, `.git`, `.claude/ecc-data`.
7. **Comando que travou ou deu timeout:** não repita. Escreva no handoff (`.collab/handoff/AAAA-MM-DD_<sigla>-para-chefe_<assunto>.md`) e pare.
8. **Pesquisa na web, modo leve.** Skills `enterprise-deep-search*` (e qualquer "deep research") travaram a IDE em 20/10: abrem o navegador do agente e dezenas de páginas. Aqui elas rodam assim: no máximo 3 `search_web` e 3 `read_url_content`, **sem `browser_subagent`**, sem gravar arquivo, resposta em até 10 linhas com as fontes. Precisa de mais: pergunte ao Ryan antes.
9. **ADB:** um comando por vez, sempre com `-s <serial>` lido de `adb devices` (nunca serial fixo). Sem `adb logcat` sem `-d`. Comando destrutivo só com "sim" do Ryan na conversa.
