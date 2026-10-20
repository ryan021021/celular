---
trigger: always_on
---

# Duas abas Gemini na mesma pasta (projeto celular)

Duas abas do agente trabalham ao mesmo tempo nesta pasta. Cada aba é uma vaga:
- **GEM-IDE-1**: aba 1. Começa a conversa com `/vaga-1`.
- **GEM-IDE-2**: aba 2. Começa a conversa com `/vaga-2`.
Se a conversa não disse qual vaga você é, pergunte ao Ryan antes de editar qualquer coisa.

O CHEFE (Claude) coordena: tarefas em `.collab/TASKS.md`, recados em `.collab/handoff/`, protocolo em `docs/COLABORACAO.md`.

## Não pisar na outra aba
1. Só pegue tarefa READY com a SUA sigla exata na coluna Agente. Nunca a da outra vaga.
2. Lock antes de editar: `.collab/locks/<Txx>-<sigla minúscula>.lock`. Se o arquivo que você precisa estiver na tarefa com lock da outra vaga, pare e avise.
3. Aparelho (A15) é um só: antes de usar ADB ou SSH crie `.collab/locks/A15-<sigla minúscula>.lock` e remova ao terminar; se já existir o da outra vaga, não use o aparelho nesta tarefa (não fique esperando em loop).
4. O git é compartilhado entre as abas. Proibido: `git add -A`, `git add .`, `git commit -a`, `git checkout -- .`, `git reset`, `git stash`, `git clean`, trocar de branch. Isso desfaz ou leva junto o trabalho da outra aba.
5. Commit sempre com caminhos: `git -c user.name="<sigla minúscula>" commit -m "<SIGLA>: Txx resumo" -- <seus arquivos>`.
6. Nenhuma vaga revisa a outra. Quem confere é o CHEFE (`/fechar-tarefa`) ou a QA.

## Zona
Pode editar: `tools/connect`, `tools/rescue`, `tools/debug`, `profiles/`, `GEMINI.md`, `GEMINI-2.md` e os testes indicados na tarefa. O resto só se a tarefa citar o arquivo. Não apagar arquivos. ADB destrutivo só com confirmação do Ryan.
Responder em português do Brasil.
