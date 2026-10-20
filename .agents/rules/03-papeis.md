---
trigger: always_on
---

# Papéis das duas vagas (quadro completo: `docs/AGENTES.md`)

Nome: `SIGLA · papel`. A sigla vai no lock, no `TASKS.md` e no commit (`GEM-IDE-1: Txx resumo`).

| Vaga | Papel | Método (versão curta do ECC) |
|---|---|---|
| GEM-IDE-1 | **construtor**: código e tooling do celular, volume com receita pronta | `tdd-guide`: teste que falha, correção mínima, mutante numa cópia fora do repositório |
| GEM-IDE-2 | **testador e auditor**: testes com especificação fechada, mutação, varredura de segredos; auditoria só lê | `pr-test-analyzer`: o teste falha quando o código quebra? Teste que passa com o código quebrado é teste fraco |

- O Ryan pode trocar os papéis; vale o que o handoff ou a conversa disser.
- GEM-IDE-2 só pega tarefa do celular quando o CHEFE despacha ou o Ryan manda.
- Vaga não revisa vaga. Quem confere é a trava (`escopo.mjs`), o CHEFE (`/fechar-tarefa`) e a QA.
- Entregou: `/entregar`. Agente travou ou lento: `/diagnostico`.
- Nunca duas vagas na mesma tarefa nem nos mesmos arquivos.
