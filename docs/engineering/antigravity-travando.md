# Antigravity travando e agente em "working" para sempre (20/10)

## O que foi medido
A IDE carregava o histórico inteiro do agente em `~/.gemini/antigravity-ide`: **6,8 GB e 63 mil arquivos**.

| Pasta | Tamanho | Efeito |
|---|---|---|
| `brain` | 3,5 GB (16.939 arquivos) | artefatos de cada conversa; um `.webp` de teste tem 162 MB |
| `conversations` | 1,9 GB (341 bancos; 16 acima de 30 MB, o maior com 94 MB) | a IDE reabre e relê esses bancos |
| `scratch` | 941 MB (34.579 arquivos) | APKs e projetos de teste do agente |
| `browser_recordings` | 318 MB | gravações do navegador do agente |

Soma com o PC já no limite (3,3 GB livres de 15,7; duas janelas da IDE com 3,8 GB; Edge e sessões do Claude): a IDE fica sem folga, o servidor de linguagem demora a responder e o agente espera para sempre. Os logs da IDE não mostram erro; é falta de recurso, não defeito de código.

No repositório, `assets/apk` tem 237 MB de APKs que o vigia de arquivos e a busca da IDE varriam.

## O que foi feito
- `tools/optimize/antigravity-arquivar.ps1` (6 testes, 6 mutantes mortos): **move** (não apaga) o que está parado há mais de 7 dias para `~/.gemini/antigravity-ide-arquivo`. Simulação por padrão; recusa aplicar com a IDE aberta; uma conversa só vai se todos os seus arquivos estão parados. Na simulação de 20/10: 522 itens, 5,1 GB, mantendo as 25 conversas recentes.
- `.vscode/settings.json`: a IDE para de vigiar e buscar em `assets/apk`, `assets/screenshots`, `backups`, `node_modules` e `.claude/ecc-data`.

## Passo a passo do Ryan (uma vez, depois toda semana)
1. Feche **todas** as janelas do Antigravity.
2. Rode a simulação e confira o total:
   `powershell -File tools\optimize\antigravity-arquivar.ps1`
3. Se estiver certo, aplique:
   `powershell -File tools\optimize\antigravity-arquivar.ps1 -Aplicar`
4. Abra a IDE de novo, abrindo só a pasta `celular` (não a Desktop inteira).
5. Para desfazer algo: mova a pasta de volta de `~/.gemini/antigravity-ide-arquivo\<conversations|brain|browser_recordings>` para `~/.gemini/antigravity-ide\`.

Se o agente ficar "working" por mais de 5 minutos sem saída nova: clique **Stop**, abra uma conversa nova e mande o agente ler o handoff (o estado vive em `.collab/`, não na conversa).

## Regras de uso que evitam repetir (valem para GEM-IDE-1 e GEM-IDE-2)
- Uma conversa por tarefa. Terminou a tarefa ou passou de cerca de 30 turnos: conversa nova.
- Sem tarefa READY com a sua sigla: responder "FILA VAZIA" e parar. Nada de loop, `sleep` ou polling.
- Comando que pode passar de 1 minuto: com limite de tempo, saída filtrada (`| tail -n 30`). A regressão inteira (`regressao.mjs`, ~3 min) não roda dentro do agente; teste por arquivo: `node --test <arquivo>`.
- Sem navegador do agente nem gravação; sem gerar `.webp`, vídeo ou APK dentro do repositório (fica fora, em `scratch`).
- No máximo 2 janelas da IDE (uma por vaga), cada uma só na pasta `celular`.
- Parar no primeiro erro e escrever o que viu no handoff, em vez de tentar de novo em silêncio.

## MCPs do Antigravity (20/10)
**O que os logs mostraram:** a IDE carrega todos os servidores MCP antes de liberar o agente ("eagerly loading all tools"). A configuração ativa (`~/.gemini/config/mcp_config.json`) subia tudo com `npx -y ...@latest` (consulta a rede a cada abertura) e incluía o `chrome-devtools-mcp`, que abre um Chrome e não conseguiu ser encerrado no recarregamento (`did not return within 100ms after SIGKILL`). Na configuração da IDE (`~/.gemini/antigravity-ide/mcp_config.json`) o `context7` apontava para um arquivo inexistente e havia dois servidores do Hermes (`hermes-agent`, `hermes-mcp-gateway`, D11: Hermes fica desligado) e o `code-review-graph` (índice do projeto inteiro).

**O que foi feito (só nesses 2 arquivos; nenhum projeto foi tocado; cópia `.bak-20261020` ao lado de cada um):**
- `config/mcp_config.json`: versões fixas (`context7@4.4.4`, `sequential-thinking@2.0.0`, `chrome-devtools-mcp@1.11.0`) e `chrome-devtools-mcp` com `"disabled": true`.
- `antigravity-ide/mcp_config.json`: `context7`, `hermes-agent`, `hermes-mcp-gateway` e `code-review-graph` com `"disabled": true` (o `context7` continua ativo pela outra configuração).

**Reativar um servidor:** mude `"disabled": true` para `false` (ou apague a linha) e recarregue a IDE. **Desfazer tudo:** `Copy-Item <arquivo>.bak-20261020 <arquivo> -Force`. Vale depois de fechar e abrir a IDE; para confirmar, o log deve parar de citar `chrome-devtools-mcp` e `hermes`.

**Segunda rodada (20/10, ainda em "working"):** o log da sessão nova mostrou `failed to get checkpoint config: unknown model key MODEL_PLACEHOLDER_M36` em todo pedido (o modelo escolhido no painel do agente não é reconhecido por esta versão; o checkpoint/resumo da conversa falha) e o plugin `superpowers` com hook de início **síncrono** via `bash` rodando a cada abertura e compactação, além de leitura de caminho inventado (`superpowers/references/...`). Em `~/.gemini/config/config.json` (cópia `.bak-20261020`): `superpowers` e `chrome-devtools-plugin` com `"enabled": false`. **Ryan:** no painel do agente, trocar o modelo por outro da lista (ou atualizar o Antigravity) e abrir conversa nova. As 8 regras globais em `~/.gemini/config/rules` não abrem (frontmatter YAML inválido, ex.: `line 5: found character that cannot start any token`) e são ignoradas pela IDE; são de outros projetos e não foram tocadas.

**Terceira rodada (20/10, sessão `20261020T131927`):** sumiram do log `superpowers`, `chrome-devtools`, `hermes` e as leituras inválidas; `MODEL_PLACEHOLDER_M36` só aparece na abertura, antes da troca de modelo. Restava o `context7` morrendo ao subir (`failed to stop mcp instance: context7: exit status 1`), o que quebra o recarregamento dos MCPs; foi desligado também em `~/.gemini/config/mcp_config.json` (cópia `.bak-20261020b`). Fica ativo só o `sequential-thinking`.

## Quarta rodada (20/10, ainda lento): a causa raiz
**Medido nos `transcript_full.jsonl` (`brain/<id>/.system_generated/logs/`), tempo entre o pedido ao modelo e o passo seguinte:**

| Conversa | Quando | Chamadas | Média por resposta |
|---|---|---|---|
| `30643f42` | 19/10 noite | 85 | 15 s |
| `a3ecfb0a` (o ciclo) | 19/10 11h–20h UTC | ~750 | 8–28 s |
| `a3ecfb0a` | 19/10 21h → 20/10 04h UTC | ~580 | 40–106 s |
| `a3ecfb0a` | 20/10 12h–13h UTC | 11 | 167–324 s |
| `8bd11420` ("opa" + uma busca) | 20/10 13h | 6 | 183 s |

**Causa:** a ordem do CHEFE na rodada 3 do handoff `2026-10-19_chefe-para-gemini_LOOP-de-tarefas.md` ("não pare, `Start-Sleep 300` e confira de novo") deixou **uma conversa só** rodando sem parar: 2.818 passos, 1.345 chamadas ao modelo, 6 compactações, 33,7 MB, até 274 chamadas numa hora. Ela ainda rodava hoje em paralelo com as conversas novas. A resposta do modelo foi de ~15 s para ~3 min **também na conversa nova e minúscula**, então o gargalo não é o tamanho da conversa: é a conta/servidor (limite de uso) somado a dois agentes chamando ao mesmo tempo. CPU e RAM do PC não explicam (CPU média baixa; o pico era o Defender).

**Agravantes achados:** execução automática em modo turbo (`autoExecutionPolicy` ON, JS do navegador TURBO, acesso a arquivo fora do workspace ALLOW): o agente rodou sozinho `Stop-Process` (python, 20/10) e `schtasks /DISABLE` (Hermes, 19/10). A skill global `/enterprise-deep-search` (13 KB, "24 fases") multiplica as chamadas. O navegador do agente (porta 9222, ~1,2 GB) sobe com a IDE.

**Feito:** ciclo cancelado (`.collab/gemini-loop.stop` + seção CANCELADO no handoff); `/despachar` não manda mais ciclo; `.agents/rules/02-anti-travamento.md` proíbe loop, polling e deep search pesado; `antigravity-arquivar.ps1 -Zerar` move **todo** o histórico (com a IDE fechada, nunca apaga).

**Ryan, para zerar:** feche a IDE → `powershell -File tools\optimize\antigravity-arquivar.ps1 -Zerar` (confere) → `... -Zerar -Aplicar` → abra só a pasta `celular`. No painel do agente: Terminal em "pedir revisão" (não turbo) e acesso fora do workspace desligado. Se continuar ~3 min por resposta numa conversa nova, é o limite da conta: troque de modelo ou espere renovar.

**Regra para nunca repetir:** nenhum agente recebe ordem de ciclo, `sleep` ou "não pare". Uma tarefa por conversa e parar.

## Quinta rodada (20/10 14h, depois do `-Zerar`)
- Zerado: 70 itens, 598 MB, 0 falhas. Conversa nova com "opa": 49–65 s por resposta e para depois do primeiro passo.
- O modelo é o mesmo de ontem à noite (**Gemini 3.8 Flash (High)**, 15 s em média em 19/10): não é defeito do modelo, é o **limite de uso da conta** depois de ~1.300 chamadas do ciclo. Flash (Medium) também ficou lento hoje (46–133 s).
- O `superpowers` continuava entrando pelo `GEMINI.md` do próprio plugin (`@./skills/using-superpowers/SKILL.md`, ~20 mil caracteres, manda "invocar skill antes de responder"); o `enabled: false` no `config.json` não vale para ele. Pasta movida para `~/.gemini/config/plugins-desligados/superpowers` (desfazer: mover de volta).
- A IDE abriu **sem pasta** ("no active workspace"), então as regras de `.agents/` não entram: abrir sempre `celular` (File → Open Folder).
- **Saída:** trocar o modelo no painel para outro de cota diferente (ex.: Claude Opus 4.6 (Thinking), que já aparece na lista) ou esperar o limite do Gemini renovar.
