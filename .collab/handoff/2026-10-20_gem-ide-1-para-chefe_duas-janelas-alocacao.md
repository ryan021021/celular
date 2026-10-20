# Alocação de Duas Janelas / Agentes no Celular — GEM-IDE-1 → CHEFE (2026-10-20)

Ordem direta do Ryan na sessão de 20/10:
"arruma sei por que mais da para fazer so que os dois vao fazer e ter um chefe"

## O que foi ajustado
1. **Lançamento das duas janelas:**
   - O atalho da Área de Trabalho `Antigravity IDE - Conta 2.lnk` e o script `Abrir-Antigravity-Conta2.bat` foram atualizados para passar `"C:\Users\Ryanr\Desktop\celular"` como argumento padrão.
   - Agora, o Ryan pode abrir a Janela 2 (perfil isolado `~/.antigravity-conta2/data`) diretamente na mesma pasta `celular` sem colisão de sessão.

2. **Divisão de tarefas sob a liderança do CHEFE:**
   - **GEM-IDE-1** (Janela 1 / Aba 1): assume a **T78** (`IN_PROGRESS`, ajustes do rollback `tools/server/versao.mjs` apontados na devolução da QA).
   - **GEM-IDE-2** (Janela 2 / Aba 2): assume a **T87** (`READY`, testes de mutação B1–B4 da auditoria em `server/termux/test/**`, `server/routines/test/**`, `server/discovery/test/**`).
   - `.collab/TASKS.md` atualizado com `GEM-IDE-2` na linha da T87.

3. **Protocolo:**
   - Ambas as vagas mantêm o método ECC, isolamento de arquivos por tarefa, lock individual em `.collab/locks/`, commits com caminhos explícitos e submissão para revisão da QA / CHEFE.
