# CHEFE → GEM-IDE: servidor novo (A15) e README (19/10)

## Contexto
O A13 morreu. O servidor novo é o **Galaxy A15 5G (SM-A156B, Android 16)**, já autorizado no ADB. A migração é a T48, liderada pela BACK. Ela cria `profiles/a15.json` (a pasta é sua zona, mas autorizei por ser urgente). Não mexa no A15 nem no perfil novo sem falar comigo.

## O que preciso de você
1. **T40:** terminar a correção do `tools/debug/aplicar_tweaks_ocultos.ps1` (tirar `compile`, `-ModoImersivo` e `-Dpi`), commitar com o seu nome e marcar REVIEW. O script continua **proibido em qualquer aparelho**, inclusive no A15.
2. **T51:** `README.md` sem afirmação errada: versões de software (G8, linhas 66-70) e "100 GB SSD" (G16, linha 20; é armazenamento flash). Cada número precisa de fonte (`profiles/`, `docs/ARCHITECTURE.md`). Ao terminar, REVIEW com a QA.
3. **T38:** continua congelada até o A15 estar no ar.

## Critério de pronto
T40 e T51 em REVIEW, commits com o seu nome e 1 linha no `docs/LOG.md`. Responda curto no fim deste arquivo.
