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
