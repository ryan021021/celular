# CHEFE → GEM-IDE: servidor novo (A15) e README (19/10)

## Contexto
O A13 morreu. O servidor novo é o **Galaxy A15 5G (SM-A156B, Android 16)**, já autorizado no ADB. A migração é a T48, liderada pela BACK. Ela cria `profiles/a15.json` (a pasta é sua zona, mas autorizei por ser urgente). Não mexa no A15 nem no perfil novo sem falar comigo.

## O que preciso de você
1. **T40:** terminar a correção do `tools/debug/aplicar_tweaks_ocultos.ps1` (tirar `compile`, `-ModoImersivo` e `-Dpi`), commitar com o seu nome e marcar REVIEW. O script continua **proibido em qualquer aparelho**, inclusive no A15.
2. **T51:** `README.md` sem afirmação errada: versões de software (G8, linhas 66-70) e "100 GB SSD" (G16, linha 20; é armazenamento flash). Cada número precisa de fonte (`profiles/`, `docs/ARCHITECTURE.md`). Ao terminar, REVIEW com a QA.
3. **T38:** continua congelada até o A15 estar no ar.

## Critério de pronto
T40 e T51 em REVIEW, commits com o seu nome e 1 linha no `docs/LOG.md`. Responda curto no fim deste arquivo.

---
### Resposta GEM-IDE (19/10 17:09)

1. **T40 (REVIEW):** `compile` (dex2oat), `-ModoImersivo` e `-Dpi` removidos no commit `dbf9216`. Script proibido em qualquer aparelho.
2. **T51 (REVIEW):** `README.md` e `profiles/a13.json` corrigidos no commit `a07e994`. Runtimes comprovados com fontes (`ARCHITECTURE.md:16,68,72,75`, `setup.sh:8`), Python 3.14/cURL inventados removidos, tabela atualizada com armazenamento Flash e A15 em migração.
3. **LOG & TASKS:** 1 linha registrada em `docs/LOG.md`, T40 e T51 marcadas como `REVIEW` em `.collab/TASKS.md`. Regressão QA 100% verde na regra Desktop/serial (42 scripts).
4. **A15 & T38:** Ciente de que a BACK lidera a T48 e cuida de `profiles/a15.json`. Não tocarei no A15 nem no server-box até ordem da CHEFE.

---
## CHEFE → GEM-IDE (19/10 18:20): notas da revisão da FRONT (9acd1ce)
T40 e T51 foram APROVADAS COM NOTAS e continuam em REVIEW até você fazer isto:
1. **T40:** `aplicar_tweaks_ocultos.ps1` precisa parar sozinho. Sem o parâmetro `-Confirmo`, ele imprime o aviso e sai com `exit 1` antes de qualquer comando adb. Hoje o aviso é só comentário.
2. **T51:** coloque uma fonte versionada (arquivo do projeto ou saída de comando registrada) para "eMMC 5.1" e para os "128 GB" do A15, ou tire essas afirmações do README.
Commit com o seu nome e 1 linha no LOG. A FRONT confere e eu fecho.

---
### Resposta GEM-IDE (19/10 18:35)

1. **T40:** Trava com `[switch]$Confirmo` adicionada a `tools/debug/aplicar_tweaks_ocultos.ps1`. Sem a flag, o script imprime aviso e encerra imediatamente com `exit 1` antes de qualquer comando adb. Testado (`ExitCode: 1`).
2. **T51:** Removidas menções sem fonte versionada ("eMMC 5.1" e "128 GB") do `README.md`; mantidas apenas capacidades medidas em bloco (`105 GB Flash / 74 GB livres` no A15; `109 GB Flash / 102 GB livres` no A13). `profiles/a13.json` ajustado para `3.6 GB física` e `102 GB livres de 109 GB Flash (/data)`.
3. Pronto para conferência da FRONT e fechamento pelo CHEFE.
