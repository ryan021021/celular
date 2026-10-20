# Quadro de agentes (T90, 20/10)

Uma página só: quem é cada agente, qual agente do ECC ele segue e quem confere quem. O protocolo completo continua em `docs/COLABORACAO.md` (§9 economia, §10 especialistas, §12 ECC). Este quadro é conferido por `tools/qa/agentes.mjs` na regressão: agente novo em `.claude/agents/` sem linha aqui, ou comando citado aqui que não existe, derruba a regressão.

## Nome
`SIGLA · papel · ecc:agente`. A sigla manda no protocolo (lock, TASKS, commit `SIGLA: Txx …`); o `ecc:agente` é o método padrão daquele papel. Subagente do projeto usa o nome do ECC quando há par (`code-reviewer`, `tdd-guide`…); sem par, nome próprio em português (`verificador`, `termux-infra`, `android-adb`). O custo vem primeiro: o nosso agente (barato, em português, preso ao protocolo) é o padrão; o `ecc:*` entra só na coluna "Escala quando" do §12.

## Sessões do Claude
| Sigla | Título da sessão | Modelo | ECC padrão | Apoio do projeto | Zona |
|---|---|---|---|---|---|
| CHEFE | CHEFE · coordenação · ecc:planner | Opus | `ecc:planner` (`ecc:architect` se mexe em arquitetura) | `code-reviewer`, `security-reviewer` | `tools/optimize`, `docs/`, estrutura do `TASKS.md`, `CLAUDE.md` |
| ORQ | ORQ · infra e economia · ecc:harness-optimizer | Sonnet | `ecc:harness-optimizer` | `termux-infra`, `verificador` | hooks, custo, ambiente das sessões |
| BACK | BACK · servidor A15 · ecc:tdd-guide | Sonnet | `ecc:tdd-guide` | `tdd-guide`, `silent-failure-hunter`, `termux-infra` | `server/termux`, `tools/server` |
| FRONT | FRONT · console do painel · ecc:e2e-runner | Haiku | `ecc:e2e-runner` | `code-simplifier`, `verificador` | `server-box`, console do painel |
| QA | QA · revisão e testes · ecc:pr-test-analyzer | Opus | `ecc:pr-test-analyzer` | `silent-failure-hunter`, `security-reviewer` | `tools/qa`, veredito das tarefas críticas |

## Subagentes
Vivem em `.claude/agents/`; só a sessão que os chama gasta o contexto deles. Modelo fixo no arquivo.

| Agente | Modelo | Par no ECC | Papel | Escala para o ECC quando |
|---|---|---|---|---|
| `code-explorer` | haiku | `ecc:code-explorer` | achar onde está algo, só leitura | nunca |
| `verificador` | haiku | skill `verification-loop` | roda a regressão e devolve só o resumo e as falhas | nunca |
| `code-reviewer` | sonnet | `ecc:code-reviewer` | revisão cruzada pelo diff, só leitura | diff com mais de ~300 linhas de JS, ou reprovou 2 vezes |
| `security-reviewer` | sonnet | `ecc:security-reviewer` | auth, rede, segredos, antes de deploy, só leitura | token, sshd, egress, painel exposto; scan semanal |
| `silent-failure-hunter` | sonnet | `ecc:silent-failure-hunter` | erro engolido, fallback falso, teste fraco, só leitura | script de serviço, deploy, backup, rede |
| `tdd-guide` | sonnet | `ecc:tdd-guide` | teste que falha primeiro, correção mínima, prova por mutação | tarefa de 3+ arquivos |
| `code-simplifier` | haiku | `ecc:code-simplifier` | limpar o código da tarefa sem mudar o comportamento | só com pedido do CHEFE |
| `termux-infra` | sonnet | — | servidor no Termux (runit, sshd, deploy, backup, egress) | — |
| `android-adb` | sonnet | — | Android/ADB, perfis, aparelho novo | — |

Regra de ferramentas (conferida pelo validador): agente de leitura nunca tem `Edit`/`Write` em `tools`; os três revisores ainda carregam `disallowedTools: Write, Edit, NotebookEdit`.

## Gemini (Antigravity, 2 abas)
O ECC não roda no Antigravity: ali valem só as regras de `.agents/rules/` (a `01-metodo-ecc.md` é o mesmo método em versão curta) e os handoffs. Não copie o ECC para `.agents/` nem `.gemini/`.

| Sigla | Papel | Método ECC | Começa com |
|---|---|---|---|
| GEM-IDE-1 | construtor: código e tooling do celular, volume com receita pronta | `tdd-guide` (teste vermelho, verde, mutante) | `/vaga-1` |
| GEM-IDE-2 | testador e auditor: testes com especificação fechada, mutação, varredura de segredos, só leitura quando auditar | `pr-test-analyzer` (o teste falha quando o código quebra?) | `/vaga-2` |

O Ryan pode trocar os papéis. GEM-IDE-2 só pega tarefa do celular quando o CHEFE despacha. Entrega com `/entregar`; travou ou lento, `/diagnostico`. Nunca duas vagas na mesma tarefa nem nos mesmos arquivos.

## Quem confere quem
- Ninguém revisa o próprio trabalho. Executor entrega em REVIEW; `verificador` roda os testes e o `code-reviewer` lê o diff (`/fechar-tarefa`).
- Vaga do Gemini não revisa vaga. Quem confere o Gemini é a trava (`escopo.mjs`) mais o `/fechar-tarefa` do CHEFE ou a QA.
- Tarefa crítica (aparelho, `profiles/`, `server/termux`, deploy, auth, rede, segredos) passa pela QA antes de DONE.
- Início de turno: `/rotina <SIGLA>`. O CHEFE distribui com `/despachar`.
