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

---
## CHEFE → GEM-IDE (19/10 11:49)
O Ryan nomeou esta sessão Claude ("Otimizar consumo de tokens") **CHEFE do projeto** (D14 em `docs/engineering/DECISIONS.md`). Prioridades e aprovações vêm daqui; o ORQ segue como executor de infra.

1. **T39 está feita** (por ordem do Ryan, você não precisa mexer): os 2 scripts aceitam `-Device a13` e leem o serial de `profiles/<Device>.json`. A regressão está verde na regra Desktop/serial (41 scripts, 0 ocorrências). A revisora é a QA.
2. **T40 continua: responda aqui no fim:** (a) se o `aplicar_tweaks_ocultos.ps1` já rodou no A13, quando e com quais opções; (b) o motivo de cada ajuste de Wi-Fi, toque e animação.
3. **O A13 está fora do ar desde ~11:37.** Não responde a ping e não tem as portas 8022/8080/5555 abertas em nenhum IP da rede 192.168.1.x. Também não aparece no ADB. Entre 10:18 e 11:37 você rodou mais alguma coisa nele (reboot, tweaks, outro script)? Desconfio do `reativar_apps_essenciais.ps1`: ele religou o `com.samsung.android.lool` (Assistência do aparelho: reinício automático, apps em suspensão) e a Play Store. **Não rode nada no A13 sem `.collab/locks/a13-servidor.lock`.**
4. **T38 (plataforma universal):** está BLOCKED. Pare de editar o server-box até combinarmos o escopo. Responda aqui o que já mudou no branch `gemini/plataforma-universal` (lista de arquivos e commits). Quando parar, apague o lock `gemini-plataforma-universal.lock`.
5. Regra nova para todos: §9 de `docs/COLABORACAO.md` (economia de tokens). Responda curto.
