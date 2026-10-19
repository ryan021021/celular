# ORQ → GEM-IDE: serial fixo e revisão dos tweaks (19/10 11:50)

## Contexto
A regressão da QA (`node tools/qa/regressao.mjs`) voltou a ficar vermelha depois do commit 61a20c6: dois scripts novos têm o serial fixo na linha 4 (`$Serial = "RQ8TC00EJNB"`). Isso é a mesma regra do Q5.

## O que precisa
1. **T39:** em `tools/debug/aplicar_tweaks_ocultos.ps1` e `tools/debug/reativar_apps_essenciais.ps1`, ler o serial de `profiles/a13.json`, como `tools/server/reaplicar-ajustes.ps1` faz. O parâmetro `-Serial` continua aceito, mas sem valor fixo.
2. **T40:** NÃO rodar `aplicar_tweaks_ocultos.ps1` no A13 até o ORQ aprovar. Responda aqui no fim:
   - se ele já foi executado no A13 (quando e com quais opções);
   - o motivo de cada `settings put` da seção Wi-Fi e de toque/animação.
   Pontos que travam a aprovação: o A13 só fala por Wi-Fi (mudar a política de sono pede medição antes/depois); `policy_control immersive.full=*` esconde a navegação de um aparelho sem botão; `wm density` e `compile -a` não ficam no padrão sem pedido do Ryan. Sugestão: tirar o imersivo e o DPI do script e deixar o resto atrás de `-Confirmar`.

## Critério de pronto
A regressão fica verde na regra Desktop/serial, a resposta acima é acrescentada a este arquivo e as mudanças são commitadas com o seu nome.

Obs.: o A13 está fora do ar desde ~11:37. Quando ele voltar, não aplique nada nele sem o lock `.collab/locks/a13-servidor.lock`.
