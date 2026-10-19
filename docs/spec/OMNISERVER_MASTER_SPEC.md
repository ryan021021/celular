# OMNISERVER — ESPECIFICAÇÃO MESTRA DO PRODUTO E PROMPT DE EXECUÇÃO

**Versão do documento:** 1.0  
**Data:** 19 de outubro de 2026  
**Workspace atual:** `C:\Users\Ryanr\Desktop\celular`  
**Primeiro alvo de implantação:** Samsung Galaxy A13 SM-A135M, Android 14, Termux, sem root  
**Ambiente de desenvolvimento referido:** Antigravity IDE, Claude Code e agentes adicionais efetivamente disponíveis  
**Natureza:** especificação de produto, arquitetura, comportamento operacional, segurança, instalação, testes e critérios de publicação.

> **Instrução ao agente coordenador:** este documento substitui prompts anteriores como fonte principal de requisitos. Não o trate como licença para reescrever tudo. Inspecione o repositório real, preserve funcionalidades operacionais, converta os requisitos em trabalho rastreável, implemente incrementos verificáveis e prove o comportamento com testes. O texto descreve o destino do produto; não afirma que essas funcionalidades já existem.

---

# 0. OBJETIVO EXECUTIVO

Construir um produto self-hosted universal e modular que torne um computador compatível — inicialmente um Galaxy A13 com Termux — num ambiente de servidor gerenciável através de um navegador. O produto deve descobrir as capacidades reais do dispositivo, recomendar a melhor configuração, instalar componentes compatíveis com o mínimo de trabalho manual, operar rotinas seguras, administrar serviços e tarefas, integrar agentes de IA, oferecer gestão de ficheiros e workloads, suportar extensões verdadeiramente plug-and-play e evoluir com testes e releases controlados.

O objetivo não é produzir a maior quantidade de funcionalidades ou o painel mais vistoso. É produzir **funcionalidades que funcionam, que se explicam, que podem ser mantidas, que sobrevivem a falhas e que não destroem dados ou segurança**.

## Resultados esperados para o utilizador

Uma pessoa sem conhecimento profundo de Termux deve conseguir:

1. Descarregar ou obter um pacote de instalação confiável.
2. Executar um diagnóstico inicial que identifique dispositivo, sistema, arquitetura, privilégios, memória, armazenamento, rede e runtimes.
3. Ver o que é compatível, o que precisa de configuração e o que não pode funcionar naquele dispositivo.
4. Escolher um perfil recomendado ou aceitar uma configuração inicial segura.
5. Instalar a base do produto sem editar código, percorrer manualmente dezenas de comandos ou introduzir dados de configuração em vários ficheiros.
6. Abrir o painel no navegador e completar o onboarding.
7. Adicionar uma extensão pela interface, rever permissões, instalar, configurar e validar.
8. Gerir serviços, agentes, ficheiros, tarefas, memória, logs, backups e atualizações num local coerente.
9. Receber recomendações inteligentes com explicação, impacto estimado e possibilidade de pré-visualizar ou reverter.
10. Recuperar de erros com procedimentos claros e um estado de sistema verificável.

## Limite de honestidade

“Universal” significa **arquitetura comum, compatibilidade detectada, capacidades adaptáveis e instalação suportada em vários ambientes**. Não significa que todos os workloads executam em todos os dispositivos. O A13 sem root não deve ser tratado como um servidor Linux com permissões completas, cgroups, containers, systemd ou disponibilidade de datacenter. Capacidades que dependem de requisitos ausentes devem ser desativadas ou encaminhadas para um worker remoto opcional e compatível.

---

# 1. REGRAS INEGOCIÁVEIS PARA TODOS OS AGENTES

1. **Inspecionar antes de modificar.** Ler código, configuração, scripts, relatórios, serviços e testes existentes.
2. **Preservar o que funciona.** Nenhuma reescrita global só por preferência tecnológica.
3. **Um único plano de produto.** Este documento e os artefactos de decisão do projeto são a fonte de verdade; não criar prompts concorrentes que se contradigam.
4. **Provar em vez de alegar.** “Implementado” exige evidência de código e teste adequado; “funciona no A13” exige validação no A13.
5. **Nenhum mock apresentado como operação real.** Os dados demonstrativos têm de estar claramente marcados.
6. **Sem alterações destrutivas sem proteção.** Antes de migrations destrutivas, remoção de dados, mudanças de serviço ou atualizações críticas, verificar backup e procedimento de recuperação.
7. **Segurança desde o design.** Não adicionar autenticação, isolamento, TLS, assinatura ou sandbox apenas como rótulo; testar a garantia real.
8. **Sem acesso irrestrito por conveniência.** Plugins, agents e automações não herdam automaticamente acesso total ao sistema.
9. **Sem instalações cegas.** Validar arquitetura, runtime, origem, assinatura/integridade, espaço, portas e permissões antes de instalar.
10. **Sem assumir que mais agentes é melhor.** Paralelizar apenas tarefas independentes, dentro de limites claros e com integração revista.
11. **Sem dependência obrigatória do PC de desenvolvimento.** Depois da implantação, o A13 deve conseguir operar autonomamente dentro das limitações documentadas; o PC pode ser backup ou worker opcional.
12. **Sem promessas de disponibilidade impossível.** Android pode suspender ou terminar processos; explicar mitigação e estado real.
13. **Sem substituir testes por opinião do modelo.** Opiniões de agentes são hipóteses até serem confirmadas.
14. **Sem esconder incompletude.** Qualquer funcionalidade parcialmente implementada deve ter estado, limitações e plano.
15. **Trabalho em incrementos seguros.** Cada incremento mantém um caminho de arranque, rollback ou restauração conhecido.

---

# 2. FASE ZERO: AUDITORIA FORENSE DO PROJETO ATUAL

## 2.1 Inventário obrigatório

No início, examinar:

- Estado do Git, branches, alterações não commitadas e histórico relevante.
- Estrutura de diretórios e ficheiros reais.
- Entrypoints de aplicação, API, frontend, CLI e workers.
- Stack atual, versões, lockfiles, scripts de build e dependências transitivas.
- Configuração e secrets, sem imprimir valores secretos nos relatórios.
- Banco de dados, schema, migrations e backups.
- Todas as rotas HTTP, handlers, middlewares, autenticação, sessões e autorização.
- Painel atual e painel antigo, comparando funcionalidade e experiência.
- Serviços runit, comandos de gestão, logs, watchdog e tarefas agendadas.
- `server-box` alegadamente na porta 8080, `agentops` alegadamente na 8090, SSH alegadamente na 8022, proxy local alegadamente na 8091 e transferência de ficheiros alegadamente na 8023.
- Integração atual com Claude Code, loader de compatibilidade e autenticação.
- Estado real de Hermes, Tailscale, ntfy, backups e destinos remotos.
- Testes presentes, cobertura, suites inexistentes e comandos que falham.
- Código gerado por IA, TODOs, stubs, placeholders e endpoints não ligados a ações reais.
- Configuração de CORS, bind de rede, cookies, tokens e permissões de ficheiros.

Os nomes e as portas acima são apenas pontos de investigação vindos do relatório anterior. Confirmar valores atuais antes de os usar.

## 2.2 Verificar os relatórios existentes

Inspecionar, se existirem e forem relevantes:

`C:\Users\Ryanr\Desktop\celular\reports\server_audit_2026-10-19\`

Validar afirmações do relatório contra o estado atual. Nunca assumir que um relatório anterior descreve uma instalação depois de alterações posteriores.

## 2.3 Classificação das descobertas

Cada subsistema deve ser rotulado com um dos estados:

- `VERIFIED_WORKING` — comportamento demonstrado por teste adequado.
- `IMPLEMENTED_UNVERIFIED` — existe código, mas falta evidência.
- `PARTIAL` — parte do fluxo funciona.
- `MOCKED` — usa dados ou comportamento simulado.
- `BROKEN` — existe, mas não funciona.
- `MISSING` — não existe.
- `UNSUPPORTED_HERE` — requisito não existe no ambiente.
- `BLOCKED` — aguarda configuração/autorização/dependência.
- `UNKNOWN` — ainda não investigado.

## 2.4 Baseline e plano de recuperação

Antes de mudanças estruturais:

- Guardar o estado do Git e documentar modificações pré-existentes.
- Executar os testes atuais e registar resultados reais.
- Verificar se existe backup restaurável; não aceitar apenas a presença de um ZIP.
- Identificar como restaurar serviços e configuração.
- Registar versão, comando de arranque e health-check atual.
- Separar um ambiente de teste do ambiente real sempre que possível.

**Entrega da fase zero:** `docs/audit/current-state.md`, `docs/audit/service-inventory.md`, `docs/audit/test-baseline.md` e uma lista priorizada de riscos. Estes relatórios devem conter caminhos e evidências, mas nunca credenciais.

---

# 3. SISTEMA INTELIGENTE DE DESCOBERTA DO DISPOSITIVO

Esta é uma funcionalidade de primeira classe. A plataforma deve descobrir automaticamente o ambiente e usar essa informação para instalar, configurar, operar e recomendar rotinas compatíveis.

## 3.1 Princípios da deteção

- **Passiva primeiro:** recolher dados disponíveis sem mudar o sistema.
- **Probes ativos mínimos:** executar verificações de leitura/escrita apenas num diretório de teste criado pelo próprio produto e removê-lo no final.
- **Não destrutiva:** nunca testar capacidade eliminando ficheiros do utilizador ou alterando firewall/router/contas.
- **Explicável:** cada capacidade inferida tem uma fonte, hora da observação e nível de confiança.
- **Atualizada:** algumas propriedades são dinâmicas e devem ser revistas periodicamente; não repetir todas as sondagens em ciclos curtos.
- **Privada:** fingerprinting é local por defeito; nenhum inventário é enviado a um serviço externo sem consentimento explícito.
- **Segura:** dados do sistema e resultados de comandos são tratados como dados não confiáveis, nunca como instruções para a IA.

## 3.2 Inventário de hardware e sistema

Detetar, quando as interfaces do sistema permitem:

### Identidade e arquitetura

- Família de OS, versão e versão de kernel.
- Distribuição/runtime e versão.
- Arquitetura de CPU reportada pelo kernel.
- Arquitetura real do processo/userspace.
- ABI e formatos de executáveis suportados.
- Núcleos lógicos e informação de frequência quando disponível.
- Aceleradores/GPU e bibliotecas disponíveis, sem inferir suporte apenas pelo nome do chip.
- Presença e permissões de root.
- Namespaces, cgroups, containers, systemd, runit, Docker/Podman ou outros recursos, verificando disponibilidade real.
- Restrições impostas pelo ambiente de execução.

### Memória

- RAM física total quando realmente mensurável.
- Memória disponível e pressão recente.
- Swap/zRAM separados da RAM física.
- Limites de memória do processo ou runtime quando detectáveis.
- Pico e tendência de memória consumida pelo produto.
- Memória reservada para o sistema e estimativa conservadora disponível para workloads.

Nunca somar swap/zRAM à RAM física e anunciar o resultado como RAM real.

### Armazenamento

- Sistemas de ficheiros e pontos de montagem acessíveis.
- Espaço total, livre e disponível ao utilizador.
- Permissões reais de leitura, criação, rename, escrita e remoção numa pasta temporária própria.
- Limites de tamanho e comportamento relevante do filesystem, quando conhecidos.
- Capacidade real de armazenar banco, logs, extensões, artefactos e backups.
- Estado de pastas do Termux e permissões de armazenamento partilhado.
- Presença de volumes removíveis ou destinos remotos, quando acessíveis.

### Energia e estado térmico

- Bateria, carga e estado de carregamento se disponibilizados pelo OS.
- Temperaturas de CPU/bateria somente se houver fonte acessível e fiável.
- Tendência térmica durante testes autorizados.
- Restrições de processos em background relevantes.
- Indícios de que a aplicação pode ser suspensa pelo Android.

Não inventar temperaturas ou níveis de stress. Se não for possível medir, mostrar “indisponível neste ambiente”.

### Rede

- Interfaces e endereços disponíveis.
- IPv4/IPv6.
- Rotas e conectividade básica quando permitido.
- DNS resolvível.
- Acesso a endereços externos de teste definidos e aprovados.
- Disponibilidade dos ports de serviço necessários.
- Bind local vs LAN vs interface privada.
- Estado do Tailscale ou outro overlay apenas através do cliente autorizado instalado.
- Proxy configurado e sua política efetiva, sem expor tokens.
- Estado de firewall apenas quando a informação é acessível.
- Riscos de exposição pública detectáveis.

Não efetuar varrimentos de rede não solicitados contra terceiros. Verificar portas locais e destinos explicitamente permitidos.

### Runtime e ferramentas

- Node, Python, Java e outros runtimes apenas quando relevantes.
- Versões, caminhos e arquiteturas dos executáveis.
- Disponibilidade de compiladores e package managers.
- Compatibilidade de drivers/dependências nativas.
- Bibliotecas dinâmicas disponíveis.
- Capacidade de iniciar e parar um processo de teste com timeout.
- Disponibilidade do supervisor de processos.
- Versões de adapters de agentes e respetivos requisitos.

### Serviços existentes

- Serviços instalados e estados reportados pelo supervisor real.
- Processo, PID, comando sem argumentos secretos, uptime e restart count quando acessíveis.
- Portas realmente em escuta.
- Dependências e falhas recentes.
- Identificação de conflito com serviços que o instalador pretende iniciar.

## 3.3 Modelo de dados de capacidades

Cada descoberta deve gerar um objeto tipado com, no mínimo:

- `capability_id`
- `value`
- `status`: `available`, `limited`, `unavailable`, `unknown`, `blocked`
- `source`: API do OS, comando, adapter, configuração ou resultado de probe
- `confidence`: `high`, `medium`, `low`
- `observed_at`
- `expires_at` ou política de refresh
- `evidence_summary` sem segredos
- `constraints`
- `required_permissions`
- `last_error`, se existir

Não transformar uma ausência de informação em `false`. “Não sei se suporta” é diferente de “não suporta”.

## 3.4 Perfil de compatibilidade

Gerar um perfil para a instalação, por exemplo:

- `android-termux-constrained`
- `linux-minimal`
- `linux-server`
- `desktop-development`
- `remote-worker`
- `unknown-restricted`

Os perfis são presets, não substituem a deteção por capacidades. A deteção individual ganha quando contradiz um preset.

## 3.5 Deteção de regressão no ambiente

Comparar o estado atual com o último estado conhecido:

- Runtime desapareceu ou mudou de versão.
- Userspace/ABI mudou.
- Espaço livre caiu abaixo do mínimo.
- Porta deixou de estar disponível.
- Serviço foi desativado.
- Tailscale desconectou.
- Uma extensão passou a ser incompatível.
- Bateria/temperatura impede uma rotina opcional.
- Configuração diverge da esperada.

Alertar apenas quando a diferença exige atenção. Evitar criar falsos alarmes a cada mudança de IP DHCP ou cada reinício normal.

## 3.6 Critérios de aceitação da deteção

- Deve distinguir RAM física de swap/zRAM.
- Deve distinguir arquitetura do kernel e userspace.
- Deve identificar dependências ausentes sem tentar instalá-las silenciosamente.
- Deve detetar conflitos de portas antes do setup.
- Deve identificar privilégios ausentes antes de oferecer a função.
- Deve indicar evidência e confiança para dados importantes.
- Deve funcionar sem ligação à internet para as verificações locais.
- Deve ter testes com saídas válidas, ausentes, malformadas, permissão negada e timeout.
- Deve degradar de forma segura se uma fonte de sensores não existir.

---

# 4. MOTOR INTELIGENTE DE RECOMENDAÇÕES E OTIMIZAÇÃO

A plataforma não deve apenas recolher métricas: deve usar sinais confiáveis para recomendar uma configuração melhor. Porém, a “inteligência” tem de ser controlada, explicável e testada; não deve significar dar liberdade ilimitada a um agente para modificar o sistema.

## 4.1 Modelo de decisão

Para cada recomendação, guardar:

- Problema/sinal observado.
- Evidência e período observado.
- Confiança da conclusão.
- Impacto esperado.
- Custo de CPU/memória/armazenamento/bateria.
- Risco de segurança ou perda de dados.
- Pré-requisitos.
- Plano de alteração.
- Resultado esperado mensurável.
- Passos de validação pós-alteração.
- Plano de reversão.
- Necessidade de aprovação do utilizador.

Exemplo aceitável: “A fila de tarefas mantém-se cheia e a memória livre cai durante execuções paralelas. Recomendo reduzir concorrência de 3 para 1 neste perfil; impacto esperado: menos throughput, menor risco de OOM. Aplicar primeiro em modo de simulação e comparar durante 30 minutos.”

Exemplo inaceitável: “Vou otimizar tudo” seguido de alterações não explicadas a packages, serviços ou limites do sistema.

## 4.2 Níveis de autonomia

### Nível 0 — Observar

Só recolhe estado e mostra relatório. Não modifica configurações.

### Nível 1 — Recomendar

Apresenta sugestões com evidência e impacto. Não executa alterações.

### Nível 2 — Executar ações reversíveis aprovadas

Pode aplicar ações de baixo risco que o utilizador permitiu antecipadamente, dentro de limites explícitos, com registo e rollback.

### Nível 3 — Rotinas agendadas dentro de política

Pode executar tarefas repetitivas permitidas (por exemplo, rotação de logs, verificação de backup ou restart de um serviço comprovadamente falhado), com rate limits, condições de segurança e auditoria.

### Nível 4 — Operações administrativas sensíveis

Mudanças de rede/exposição pública, concessão de privilégios, exclusão de dados, alteração de credenciais, instalações de código não confiável e upgrades de alto impacto exigem aprovação explícita no momento da ação. Não existe modo silencioso que elimine este requisito.

## 4.3 Modo de simulação

Antes de aplicar uma rotina de manutenção ou alteração de perfil, permitir `dry-run` que descreve:

- Mudanças que seriam feitas.
- Ficheiros afetados.
- Serviços que seriam reiniciados.
- Espaço/recursos esperados.
- Riscos conhecidos.
- Condições de abortar.

A implementação deve ter testes que verifiquem que `dry-run` não muda estado persistente nem executa ações externas.

## 4.4 Otimização medida

O motor de otimização deve:

1. Medir baseline.
2. Definir uma hipótese verificável.
3. Alterar uma variável ou um conjunto inseparável pequeno.
4. Repetir uma carga de teste comparável.
5. Comparar métricas e erros.
6. Confirmar que não houve regressões de segurança/funcionalidade.
7. Reverter se os critérios piorarem.
8. Guardar o resultado como decisão auditável.

Não fazer dezenas de mudanças ao mesmo tempo sem forma de perceber qual resultou.

## 4.5 Perfis adaptativos

Criar presets configuráveis como:

- **Minimal:** consumo baixo; apenas core, dashboard, diagnóstico e serviços essenciais.
- **Balanced:** tarefas moderadas e monitorização normal.
- **AI Worker:** concorrência e logs ajustados para runtimes de agentes compatíveis.
- **Hosting:** prioridades em serviços e workloads autorizados.
- **Development:** testes, hot reload e tooling; desativado no modo público/produção.
- **Low Battery / Thermal:** adiar tarefas não críticas, reduzir concorrência, pausar workloads elegíveis.
- **Storage Pressure:** interromper downloads/instalações grandes, alertar e executar apenas limpeza autorizada.
- **Remote Node:** recursos e funcionalidades adaptados ao nó remoto.

Nunca trocar de perfil ocultamente se isso puder alterar comportamento operacional. Mostrar motivo, diferença e oportunidade de aceitar ou automatizar sob política.

## 4.6 Anti-thrashing

Evitar alterar concorrência, prioridade ou estado de serviços constantemente por pequenas flutuações de métricas.

Usar:
- Janelas de observação.
- Histerese.
- Mínimo de tempo entre mudanças.
- Limites de frequência.
- Estado anterior para rollback.
- Condições de estabilidade antes de voltar a aumentar capacidade.

## 4.7 Recomendações com avaliação de qualidade

Manter uma suite de cenários para avaliar recomendações:

- Memória pressionada.
- Pouco armazenamento.
- Porta ocupada.
- Runtime incompatível.
- Agente offline.
- Tailscale desconectado.
- Aumento de temperatura.
- Backup atrasado.
- Serviço a reiniciar repetidamente.
- Muitas tarefas mas CPU livre.
- CPU ocupada e nenhuma fila.
- Sinal incompleto ou contraditório.

A recomendação deve ser correta, proporcional e não excessivamente alarmista. Incluir casos nos quais **não se deve recomendar nem executar nada**.

---

# 5. ROTINAS AUTOMÁTICAS E SELF-HEALING CONTROLADO

## 5.1 Catálogo de rotinas

O sistema pode oferecer rotinas integradas, cada uma com ID, versão, descrição, triggers, condições, ações permitidas, limites, logs, timeout, política de retry, pré-condições e rollback.

Rotinas iniciais candidatas:

- Health check de serviços.
- Identificação de serviço indisponível.
- Restart limitado de serviços recuperáveis.
- Deteção de crash loops.
- Verificação de atualizações disponíveis sem as instalar automaticamente.
- Verificação de integridade do banco.
- Verificação de backup mais recente.
- Teste programado de restauração em ambiente isolado.
- Limpeza de temporários do produto de acordo com política.
- Rotação e compressão de logs.
- Deteção de armazenamento baixo.
- Deteção de mudança no runtime.
- Validação de configuração após upgrade.
- Verificação de port conflicts.
- Verificação de conectividade privada.
- Revalidação de extensões após update do core.
- Inventário periódico de capabilities.
- Deteção de dependência vulnerável segundo fontes configuradas.
- Geração de relatório de saúde.
- Verificação de filas órfãs e tarefas sem heartbeat.
- Deteção de credenciais/provider expirados sem tentar obter credenciais de outras fontes.

## 5.2 Contrato de cada rotina

Cada rotina deve definir:

- Nome e ID estáveis.
- Versão.
- Dono do módulo.
- Trigger: manual, cron, evento ou condição.
- Frequência mínima e máxima.
- Condições de entrada.
- Ações permitidas.
- Dados que lê e dados que pode alterar.
- Nível de privilégio exigido.
- Timeout.
- Limite de retries.
- Backoff.
- Idempotência.
- Critério de sucesso.
- Critério de falha.
- Condição de abortar.
- Auditoria.
- Plano de recuperação.
- Política de aprovação.

Não permitir rotinas genéricas que aceitam uma string shell arbitrária vinda de um formulário ou de texto gerado pelo modelo.

## 5.3 Scheduler

Construir um scheduler robusto e leve, preferencialmente usando capacidades existentes da aplicação e do ambiente. Não introduzir um sistema distribuído pesado no A13 sem necessidade comprovada.

O scheduler deve tratar:

- Fuso horário e horário de verão.
- Reboots e tarefas perdidas.
- Execuções concorrentes da mesma rotina.
- Duplicação de eventos.
- Tarefas atrasadas.
- Rate limits.
- Pausa/retoma.
- Janelas de manutenção.
- Dependências.
- Prioridades.
- Tarefas críticas vs não críticas.
- Cancelamento e shutdown gracioso.

Definir explicitamente se uma tarefa atrasada é descartada, executada uma vez ou reposta. Nunca deixar essa escolha implícita.

## 5.4 Self-healing com limites

O self-healing pode reiniciar ou revalidar componentes, mas não deve entrar em loop infinito nem mascarar defeitos de origem.

Implementar circuit breaker ou equivalente:

- Máximo de reinícios numa janela de tempo.
- Backoff crescente.
- Estado `DEGRADED` após falhas repetidas.
- Alerta para operador.
- Preservação de logs de antes/depois.
- Não reiniciar dependências saudáveis desnecessariamente.
- Não apagar dados para “corrigir” um serviço.

## 5.5 Manutenção inteligente

O sistema pode sugerir horário de backup, updates e limpeza de acordo com utilização observada, mas não deve assumir que “idle” significa “seguro para alterar”. Antes de um update, verificar tarefas em execução, estado do backup, espaço livre, estabilidade de rede e compatibilidade.

As rotinas devem adaptar frequência ao valor da informação. Uma verificação pesada não deve correr a cada poucos segundos só porque pode.

---

# 6. INSTALAÇÃO RÁPIDA, GUIADA E RECUPERÁVEL

## 6.1 Objetivo da instalação

A experiência normal deve ter poucos passos, mas a engenharia por trás deve ser rigorosa. A rapidez não pode resultar de downloads não verificados, permissões excessivas ou comandos remotos opacos.

## 6.2 Fluxo ideal do utilizador

1. **Obter:** descarregar/obter um bootstrap verificável para a plataforma.
2. **Diagnosticar:** executar `omni doctor` ou equivalente, primeiro só de leitura.
3. **Rever:** apresentar sistema detetado, perfil recomendado, requisitos e limitações.
4. **Escolher:** instalação recomendada ou avançada.
5. **Preparar:** validar espaço, dependências, portas, paths e permissões.
6. **Planear:** mostrar componentes e mudanças planeadas.
7. **Instalar:** transferir pacotes verificados, preparar diretórios e inicializar estado.
8. **Configurar:** criar administrador, escolher acesso local/privado, definir armazenamento e política de backups.
9. **Validar:** health checks, autenticação, dashboard e services.
10. **Concluir:** mostrar URL real, estado de cada componente, comandos essenciais e procedimento de recuperação.

## 6.3 Instalação normal vs avançada

**Normal:** poucas decisões, perfil de recursos automático, core e módulos essenciais, integração opcional descoberta e configuração guiada.

**Avançada:** seleção de diretórios, portas, módulos, workers, políticas, retenção, providers e perfis especializados.

Não forçar novos utilizadores a editar JSON/YAML ou scripts para definir opções comuns. Expor configurações avançadas através de UI/CLI validadas.

## 6.4 Bootstrap e artefactos

- Usar pacotes de release versionados.
- Validar checksums e assinatura quando disponíveis.
- Verificar origem e compatibilidade.
- Não executar código remoto não verificado por pipe para shell.
- Não instalar dependências globais sem necessidade.
- Não sobrescrever configurações existentes sem migração explícita.
- Cachear pacotes se houver espaço e isso melhorar recovery.
- Suportar instalação offline por bundle quando viável.
- Identificar precisamente o passo que falhou.

## 6.5 Idempotência

A instalação e os comandos de repair devem ser seguros de repetir.

Rerun não pode:
- Duplicar serviço ou cron.
- Regerar segredo que invalida sessões sem aviso.
- Resetar a conta admin.
- Destruir base de dados.
- Substituir agente funcional por uma versão incompatível.
- Abrir ports adicionais silenciosamente.
- Apagar pastas do utilizador.

## 6.6 Fast path

Depois de completar a instalação, a rotina de arranque deve fazer só o necessário para iniciar: validar configuração essencial, verificar/migrar schema, iniciar core e supervisão e reportar estado. Não correr scans completos, downloads pesados ou benchmarks na inicialização normal.

Usar cache com TTL para resultados de descoberta não voláteis; revalidar aquilo cuja mudança pode comprometer segurança ou instalação. Separar `startup checks`, `full diagnostics` e `periodic scans`.

## 6.7 Instalação Termux

Criar bootstrap compatível com Termux, considerando os packages e paths realmente necessários. Confirmar arquitetura de userland e compatibilidade de binários antes de instalar runtimes.

Não presumir systemd. Integrar com runit onde já existe. Não substituir scripts de serviços existentes sem uma migração documentada.

Orientar o utilizador sobre permissões de armazenamento, start/stop, limitação de background do Android, bateria e eventual Termux:Boot. O produto não deve fingir que estes limites desaparecem.

## 6.8 Repair e uninstall

Criar fluxos separados:
- `install`: instalação inicial.
- `setup`: configuração de primeira execução.
- `repair`: reparar componentes sem apagar estado.
- `upgrade`: atualizar de forma verificada.
- `rollback`: voltar à versão/estado compatível anterior quando possível.
- `uninstall`: remover software preservando dados por defeito.

Antes de qualquer operação destrutiva, identificar os dados afetados, confirmar backup e pedir aprovação explícita.

---

# 7. ARQUITETURA COMPLETA DO PRODUTO

## 7.1 Contextos de domínio

Separar explicitamente os seguintes domínios:

1. **Identity & Access:** utilizadores, sessões, autenticação, roles e permissões.
2. **Installation & Configuration:** bootstrap, settings, secrets references e validação.
3. **Capability Registry:** capacidades detetadas e requisitos dos módulos.
4. **Module Lifecycle:** módulos integrados, estado, versões e dependências.
5. **Extension Platform:** manifests, catálogo, packages, permissions e updates.
6. **Task Engine:** fila persistente, scheduler, retries, cancellation e recovery.
7. **Agent Platform:** providers, adapters, agent sessions, workspaces e evaluation.
8. **Storage:** raízes, quotas, file operations e metadata.
9. **Knowledge & Memory:** namespaces, retrieval, provenance e retention.
10. **Runtime Management:** runit/Termux/OS adapters e processos geridos.
11. **Workloads & Hosting:** apps web, websites e game workloads compatíveis.
12. **Networking:** listeners, private access, remote nodes, proxy policy.
13. **Observability:** logs, metrics, traces de execução e health.
14. **Backup & Recovery:** snapshots consistentes, restore e verification.
15. **Automation:** rotinas, triggers, policy e approvals.
16. **Update & Release:** artefactos, migrations, channels e rollback.
17. **Developer Platform:** SDK, APIs, OpenAPI, package validation e conformance.

Cada domínio tem dono, interfaces, modelos de dados, permissões, testes e documentação. Evitar circular dependencies.

## 7.2 Esquema arquitetural lógico

```text
Browser / CLI / Optional API Clients
                |
         Authentication + Policy
                |
        Versioned API / Event Bus
                |
     Application Services / Domain Core
                |
  -------------------------------------------------
  |         |          |          |               |
Capability  Task      Extension  Storage &       Observability
Registry    Engine    Manager    Knowledge       & Audit
  |         |          |          |               |
  -------------------------------------------------
                |
         Adapter Interfaces
                |
 Termux/runit | Agent CLIs | Remote Nodes | Storage | Hosting
                |
        OS / Hardware / External Providers
```

Este desenho é lógico. Não implica que cada caixa deva ser um processo separado no A13.

## 7.3 API contracts

Antes de paralelizar, definir contratos versionados para:
- Capability provider.
- Runtime/service adapter.
- Agent provider.
- Task executor.
- Extension lifecycle.
- Storage backend.
- Notification provider.
- Remote node.
- Backup provider.
- Health check.

Definir input/output, erros, timeouts, cancelamento, idempotência, permissões e compatibilidade. Criar contract tests executáveis.

## 7.4 Estrutura de pastas candidata

Não aplicar sem inspecionar o repositório atual. Alvo possível:

```text
apps/
  web/
  api/
  cli/
  worker/
packages/
  contracts/
  config/
  capability-registry/
  database/
  security/
  observability/
  task-engine/
  agent-sdk/
  extension-sdk/
  extension-runtime/
  storage/
  automation/
  ui/
integrations/
  termux/
  runit/
  claude-code/
  hermes/
  tailscale/
  ssh-sftp/
  notifications/
  remote-nodes/
extensions/
  examples/
deploy/
  termux/
  linux/
  windows/
  runit/
docs/
  architecture/
  user-guide/
  developer-guide/
  security/
  operations/
  decisions/
  testing/
reports/
tests/
  unit/
  integration/
  contracts/
  security/
  e2e/
  compatibility/
  performance/
  resilience/
  fixtures/
scripts/
```

Só criar diretórios que correspondam a código ou entregáveis reais. Não declarar arquitetura concluída por ter criado pastas vazias.

---

# 8. SISTEMA DE PLUGINS E INSTALAÇÃO DE UM CLIQUE

## 8.1 Requisitos principais

Construir um sistema real de extensões com:
- SDK estável e documentado.
- Manifest schema versionado.
- Catálogo local e, opcionalmente, catálogos remotos.
- Pesquisa, categorias, tags, filtros por plataforma, arquitetura e core API.
- Publisher/source provenance.
- Integridade dos pacotes e assinatura quando disponível.
- Resolução de dependências e conflitos.
- Preview de ações e permissões.
- Instalação, configuração, ativação, desativação, upgrade e remoção.
- Lifecycle hooks.
- Health checks, logs, métricas e errors.
- Migrações de dados da extensão.
- Rollback ou disable seguro quando update falhar.
- Importação local/offline.
- Verificação do pacote antes de executar.
- Conformance tests para desenvolvedores.

## 8.2 Manifest obrigatório

Campos mínimos:

- `id` imutável e namespaced.
- `name`, `description`, `publisher`, `version`.
- `manifest_schema_version`.
- `core_api_compatibility`.
- `platforms`, `architectures`, requisitos de runtime.
- `dependencies` e constraints.
- `permissions_requested` e `capabilities`.
- `entrypoints`/`worker`.
- `configuration_schema`.
- `health_check`.
- `resource_requirements`.
- `data_ownership` e política de remoção.
- `upgrade_migrations`.
- `package_digest`, origem e metadados de assinatura.
- `license`, documentação e links de suporte.

Validar schema antes de executar código da extensão. Rejeitar IDs ambíguos, paths de entrypoint fora do pacote, dependências circulares, versões incompatíveis e permissões desconhecidas.

## 8.3 Fluxo transacional de instalação

1. Resolver extensão e versão.
2. Mostrar publisher, origem, versão e compatibilidade.
3. Verificar digest/assinatura segundo a política configurada.
4. Descarregar para uma área temporária.
5. Limitar tamanho, número de ficheiros e expansão de archive.
6. Verificar o package e os entrypoints.
7. Resolver dependências e conflitos.
8. Mostrar as permissões solicitadas e impacto.
9. Obter aprovação necessária.
10. Preparar data directory isolado.
11. Instalar numa pasta versionada/staging.
12. Validar configuração e migrations.
13. Executar health/conformance checks sem dar privilégios desnecessários.
14. Ativar a versão atómica e atualizar registry.
15. Confirmar o estado final.
16. Limpar temporários ou reverter se falhar.

O gestor não pode apresentar “Installed” quando o health check falhou. O estado poderá ser `INSTALLED_DEGRADED` ou `INSTALL_FAILED`.

## 8.4 Segurança e isolamento

- Não executar code community dentro do processo privilegiado do core por defeito.
- Usar processo/sandbox quando a plataforma suporta isolamento real.
- Aplicar controlo de recursos e filesystem na fronteira de execução, não só no UI.
- Limitar network e acesso a secrets por capability.
- Não assumir que uma assinatura prova que o código é benigno.
- Registar versão, origem, digest e permissões aprovadas.
- Permitir revogação e desativação de extensões comprometidas.
- Se no Termux sem root não for possível uma sandbox forte, reduzir as capacidades disponíveis e explicar a limitação.

## 8.5 UX da marketplace

Cada página de extensão deve mostrar:
- O que faz.
- Estado atual.
- Compatibilidade e dependências.
- Permissões pedidas e razão para cada uma.
- Publisher e origem.
- Versão instalada e versão disponível.
- Data/origem do pacote.
- Recursos previstos, se conhecidos.
- Dados criados e o que acontece na remoção.
- Logs, health, ações e instruções de suporte.

Permitir “Instalar”, “Configurar”, “Ver permissões”, “Atualizar”, “Desativar”, “Reparar” e “Remover” conforme o estado. As ações devem chamar APIs reais.

## 8.6 Extensão de referência

Entregar uma extensão mínima real que prove o lifecycle inteiro. Incluir manifest, configuração, health check, logs, ação funcional, testes, package e documentação. Testar instalação no UI/CLI, update, disable, enable, uninstall e recuperação de falha.

---

# 9. PLATAFORMA DE AGENTES DE IA E EXECUÇÃO CONTÍNUA

## 9.1 Abstração de providers

Distinguir:
- Provider (empresa/serviço/modelo).
- Runtime/CLI executável.
- Sessão autenticada.
- Agente interativo preso a IDE.
- Worker de execução de tarefas.
- Remote node.

Não tratar esses modelos como equivalentes.

## 9.2 Interface de adapter

Um adapter pode expor operações equivalentes a:

- `discover()`
- `validateEnvironment()`
- `getCapabilities()`
- `getAuthenticationStatus()`
- `healthCheck()`
- `executeTask()`
- `requestCancellation()`
- `getTaskStatus()`
- `collectArtifacts()`
- `dispose()`

Os contratos devem definir timeout, outputs, erros, logs, cancelamento, permissões, workspace e comportamento após disconnect.

## 9.3 Claude Code

Inspecionar a instalação real, versão, comandos suportados, arquitetura, loader, autenticação, modo interativo/não interativo e diretórios permitidos.

Preservar a configuração que funciona. Usar somente interfaces suportadas e acessos autorizados. Não contornar autenticação, limites de plano, segurança ou licença. Não extrair credenciais de processos ou cookies de IDE.

Se a execução unattended for suportada pela versão instalada, validá-la end-to-end. Se uma ação depender de interação humana, apresentar `NEEDS_INTERACTION`, em vez de inventar autonomia.

## 9.4 Hermes e futuros providers

Verificar compatibilidade de runtime e binários no A13. Se não funcionar localmente, oferecer opção de remote node quando configurável, ou marcar como incompatível. Um provider quebrado não pode impedir o core de arrancar.

## 9.5 Task engine durável

Implementar estados:

`QUEUED`, `CLAIMED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `RETRY_WAIT`, `CANCEL_REQUESTED`, `CANCELLED`, `WAITING_APPROVAL`, `BLOCKED`, `RECOVERY_REQUIRED`.

Cada tarefa deve ter:
- ID estável.
- Creator/owner e namespace.
- Workspace/path autorizado.
- Tipo e adapter.
- Input normalizado e ref de contexto.
- Estado e timestamps.
- Attempts e retry policy.
- Timeout e limites.
- Heartbeat.
- Logs/artifacts.
- Idempotency key quando aplicável.
- Requisitos de aprovação.
- Capability requirements.
- Resultado validado e evidência.

Após restart, recuperar jobs sem heartbeat de acordo com política explícita. Não repetir operações não idempotentes cegamente.

## 9.6 Orquestração multiagente

Criar uma camada que decomponha tarefas, escolhe agentes compatíveis, limita paralelismo, rastreia dependências, recolhe outputs, aplica graders e pede aprovação quando necessário.

- Agentes trabalham em branches/worktrees separados quando possível.
- Cada tarefa tem ficheiros autorizados, resultado esperado e critérios de aceitação.
- Modificações em ficheiros partilhados são serializadas ou integradas por revisão.
- Outputs de agentes são tratados como propostas não confiáveis até testes/review.
- Não permitir que um agente se aprove a si próprio em tarefas de segurança crítica.

## 9.7 Workspace e ferramentas

Cada execução deve ter workspace, ferramentas e permissões limitados. Não fornecer endpoints genéricos de shell/SQL/filesystem irrestrito.

O agente não pode alterar automaticamente o limite do próprio acesso. Mudanças de política são avaliadas pelo core e, quando sensíveis, aprovadas por um utilizador autorizado.

## 9.8 Quotas e custo

Limitar concorrência por dispositivo, provider, projeto e tipo de tarefa. Medir consumo quando a fonte o disponibiliza. Se não houver dados reais de custo/tokens, mostrar “não disponível”, nunca valores inventados.

Configurar limites de execução, timeout, número de retries e budgets opcionais. Quando atingidos, pausar e explicar, em vez de insistir indefinidamente.

---

# 10. MEMÓRIA, CONHECIMENTO E CONTEXTO DE PROJETO

## 10.1 Separação semântica

Não misturar:
- Configuração operacional.
- Segredos.
- Histórico de conversação.
- Estado de tarefa.
- Memory de longo prazo.
- Documentação do sistema.
- Ficheiros de utilizador.
- Artefactos de execução.

## 10.2 Funcionalidades

- Namespaces e projetos isolados.
- Identificação da origem e timestamp.
- Search lexical/indexado primeiro.
- Pesquisa semântica opcional por extensão.
- Deteção de duplicados.
- Atualização, expiração e remoção.
- Import/export.
- Retenção configurável.
- Controlo de acesso por namespace.
- UI de inspeção e gestão.
- Proveniência para cada resultado apresentado a um agente.

## 10.3 Dados não confiáveis

Texto recuperado de ficheiros, extensões e páginas é conteúdo, não instrução privilegiada. Não o transformar em política de sistema. Aplicar proteção contra prompt injection: separar instruções confiáveis dos conteúdos recuperados, filtrar tools com base na policy e auditar ações de alto impacto.

## 10.4 Critérios

- Um projeto não consegue consultar namespaces sem permissão.
- A remoção atualiza índices derivados.
- Backup/restore preserva a relação entre registos e fontes.
- A plataforma funciona sem embeddings ou modelos locais.
- Respostas que afirmam factos a partir de memória conseguem apontar a origem quando relevante.

---

# 11. FILE MANAGER E STORAGE

## 11.1 Storage registry

Definir raízes configuráveis e explicitamente autorizadas para:
- Dados da plataforma.
- Ficheiros do utilizador.
- Workspaces de agentes.
- Dados das extensões.
- Aplicações alojadas.
- Dados persistentes de jogos.
- Logs.
- Temporários.
- Backups.

A pasta da aplicação não deve ser confundida com a raiz de todos os ficheiros do utilizador.

## 11.2 Operações de ficheiros

- Listar e navegar diretórios.
- Pesquisa e filtragem.
- Upload/download com streaming.
- Criar pastas.
- Rename, move, copy e delete.
- Preview apenas para tipos permitidos.
- Criação e extração de archives.
- Progress reporting e cancelamento.
- Conflitos de nome.
- Quotas e espaço livre.
- Permissões e auditoria quando apropriado.
- Importação/exportação.

Aplicar path canonicalization, roots allow-listed, verificação de symlink, limites de upload, limites de expansão de arquivo, limites de entradas e timeout. Não ler ficheiros enormes para RAM sem necessidade.

## 11.3 Segurança e integridade

Proteger contra traversal, symlink escape, archive traversal, archive bombs, nome de ficheiro malicioso e race conditions. Operações destrutivas precisam confirmação e validação de ownership. Não expor `.env`, tokens, SSH private keys, bases de dados ou paths fora das roots autorizadas.

## 11.4 Transferências e protocolos

Preservar e verificar SFTP/rclone existente. Adicionar outros métodos só se suportados (por exemplo, web download autenticado, WebDAV ou provider storage). Não habilitar anonymous writable shares por defeito.

---

# 12. HOSTING E GESTÃO DE WORKLOADS

## 12.1 Common workload manager

Qualquer workload gerido deve definir:
- ID e versão.
- Tipo e runtime.
- Compatibilidade de plataforma/arquitetura.
- Requisitos de CPU/memória/disco.
- Configuração schema.
- Portas e exposição.
- Diretórios persistentes.
- Start/stop/restart.
- Health check.
- Logs.
- Timeout e políticas de restart.
- Backup/restore.
- Upgrade e rollback.
- Remoção e retenção de dados.

## 12.2 Web hosting

Suportar primeiro workloads leves e compatíveis, como static sites e aplicações HTTP simples, mediante um adapter adequado. Controlar portas, roots, environment variables, logs, dados persistentes e health. Não expor cada app à internet automaticamente.

## 12.3 Game hosting

Criar profiles com requisitos por jogo. Não anunciar compatibilidade sem instalação e startup testados no ambiente alvo. No A13, workloads com requisitos de RAM/arquitetura incompatíveis ficam indisponíveis ou podem ser associados a remote node compatível.

## 12.4 DNS/ad blocking

Integrar ferramentas compatíveis de forma opcional. Distinguir filtro local, por aplicação e rede inteira. Verificar DNS, interfaces, portas e configuração do router. Não afirmar ad-blocking de toda a rede sem validação.

## 12.5 Public exposure

Private-by-default. A abertura de portas públicas, DNS público, reverse proxy externo ou port forwarding exige configuração e consentimento explícitos, preflight de segurança e documentação. Não fazer estas mudanças automaticamente.

---

# 13. DASHBOARD, UX E CONSOLE PROFISSIONAL

## 13.1 Princípios de UI

- Preservar o painel antigo útil.
- Reaproveitar a stack atual se estiver a funcionar.
- Usar design tokens e componentes reutilizáveis.
- Evitar reescrita de frontend sem benefício demonstrável.
- Mobile-first para acesso ao A13, mas com layouts de desktop eficientes.
- Acessibilidade: teclado, focus states, contraste, labels e mensagens de erro.
- Loading, empty, success, degraded, failed, disconnected e permission-denied states.
- Formulários com validação e feedback real.
- Não representar dados indisponíveis como zero.
- Não deixar ações sem handler ou endpoints inexistentes.

## 13.2 Overview real

Mostrar valores provenientes de interfaces verdadeiras:
- Health geral.
- Sistema, arquitetura e runtime.
- CPU, RAM física, memória disponível e swap separados quando mensuráveis.
- Storage.
- Temperatura/bateria quando disponíveis.
- Uptime e restart history.
- Serviços.
- Agent providers e autenticação.
- Queue e tarefas.
- Estado de extensões.
- Backup e updates.
- Alertas, eventos de segurança e rede privada.

Cada medição deve exibir hora da última atualização quando relevante. Explicar indisponibilidade de sensores.

## 13.3 Navegação base

- Overview.
- Device & Intelligence.
- Install / Setup.
- Agents & Providers.
- Tasks & Automations.
- Memory & Knowledge.
- Files & Storage.
- Services.
- Hosting & Workloads.
- Extensions & Marketplace.
- Monitoring.
- Logs & Alerts.
- Network & Remote Nodes.
- Backups & Restore.
- Users & Security.
- Updates & Releases.
- Console.
- Settings.
- Diagnostics.
- Developer Tools.

A navegação pode adaptar-se a capacidades, mas nunca ocultar silenciosamente um recurso configurado. Mostrar itens indisponíveis com explicação quando o utilizador precisar saber que faltam dependências.

## 13.4 Console

Separar CLI do produto, operações de serviços, saída de tarefas, output de agents e shell interativo opcional. O shell interativo fica bloqueado até existir policy de acesso, sessão expirada, autorização e auditoria. Nunca criar endpoint HTTP de shell arbitrário sem controlo.

## 13.5 API/UI contract

Criar testes e lista de cobertura para cada ação da UI: rota, payload, autorização, tratamento de erro, estado loading, resultado real e comportamento quando offline. Não manter botão “Start” se a API não tem operação real.

---

# 14. NETWORKING E ACESSO REMOTO

## 14.1 Estados claros

Para Tailscale ou provider similar, distinguir:
- Não instalado.
- Instalado sem autenticação.
- Autenticado mas desconectado.
- Conectado sem rota esperada.
- Conectado e validado.

Não criar URLs/hostnames por inferência. Mostrar endereço recebido do cliente real, com hora da verificação.

## 14.2 TLS e sessões

Usar TLS quando a arquitetura e o provider o permitem. Não chamar “HTTPS seguro” a uma ligação HTTP simples. Evitar tokens em URLs, aplicar sessão segura, expiração, logout/revogação e proteção CSRF apropriada.

## 14.3 Proxy e egress

Inspecionar o egress proxy existente. Não o expandir para proxy geral sem análise. Definir allow-list de destinos quando necessário, timeout, limites e logs sem credenciais. Bloquear SSRF e acesso a metadados/endereços privados não autorizados.

## 14.4 IP dinâmico

IP local não é identidade nem segredo. Não hardcodear IP DHCP. Oferecer recomendação de DHCP reservation como ajuda, sem alterar router automaticamente.

---

# 15. SEGURANÇA E MODELO DE CONFIANÇA

## 15.1 Baseline de segurança

Construir threat model cobrindo:
- Authentication bypass e brute force.
- Session fixation/theft e CSRF.
- XSS e injection.
- Privilege escalation.
- Path traversal e symlinks.
- SSRF.
- Command injection.
- Extensões maliciosas.
- Supply chain/dependencies comprometidas.
- Secret leakage.
- Archive bombs e resource exhaustion.
- Exposição pública involuntária.
- Abuse de tools de agents.
- Backup roubado ou irrecuperável.
- Upgrade malicioso ou incompatível.
- Corrupção de banco.
- Cross-tenant/project access.

## 15.2 Controls

- Autenticação segura e sessões revogáveis.
- Roles e autorização por recurso/ação.
- Validação no backend.
- CSRF se usado cookie de sessão.
- CORS/origin restritos.
- Rate limiting e body-size limits.
- Logging estruturado com redaction.
- Secrets fora do frontend, git e logs.
- Controlo de filesystem por allow-list.
- Aprovação para ações críticas.
- Dependências avaliadas e atualizadas com processo.
- Artefactos verificados.
- Auditoria das alterações administrativas.
- Secure defaults e private access.

Usar OWASP ASVS 5.0 como base de verificação aplicável, sem alegar conformidade total antes de mapear e testar os requisitos relevantes.

## 15.3 Roles e capacidades

Modelo inicial:
- `VIEWER`: leitura de recursos autorizados.
- `OPERATOR`: operações quotidianas allow-listed.
- `ADMIN`: configuração e gestão administrativa.
- `WORKER`: identidade técnica de execução restrita.
- `EXTENSION`: identidade técnica limitada às capabilities aprovadas.

Os nomes não substituem autorização real. Cada endpoint e operação sensível precisa uma verificação explícita.

## 15.4 Threat modeling contínuo

Para cada feature nova, perguntar:
1. Qual ativo protege?
2. Quem pode abusar?
3. Qual é a entrada não confiável?
4. Qual privilégio é necessário?
5. Qual é o impacto de falha?
6. Como detetar a falha?
7. Como reverter ou conter?

Atualizar threat model quando muda o acesso remoto, o sistema de plugins, o gestor de shell, os adapters de agentes ou o mecanismo de update.

---

# 16. MOTOR DE RELEASES E QUALIDADE DE ENGENHARIA

**Este capítulo é bloqueador de release.** A disciplina pretendida é inspirada em princípios de engenharia publicados publicamente por equipas de tecnologia: testes em camadas, avaliação sistemática de agentes, builds reproduzíveis quando viáveis, releases pequenos, rollout gradual, revisão independente e segurança integrada no ciclo. Não afirmar acesso a processos internos de Google, Anthropic ou Apple; aplicar práticas verificáveis a este projeto.

## 16.1 Desenvolvimento orientado por requisitos e testes

Cada requisito deve receber um ID, por exemplo `DET-001`, `AUTO-014`, `INS-007`, `PLUG-021`, `SEC-018`, `AGENT-033`.

Cada ID deve mapear para:
- Local de implementação.
- Teste(s) que verificam o requisito.
- Dono do módulo.
- Estado.
- Evidência.
- Risco.

Não aceitar “feito” baseado numa descrição de agente. A aceitação precisa de evidência reexecutável.

## 16.2 Pirâmide e tamanhos dos testes

Separar os testes por custo e dependências:

### Small / unit
- Sem rede externa.
- Sem serviços reais.
- Mocks só para dependências externas; não mockar a lógica que o teste pretende validar.
- Executáveis frequentemente.
- Determinísticos.
- Testar validação, policy, parsing, migrations lógicas, estados e funções puras.

### Medium / integration
- Database temporária.
- Filesystem temporário.
- Processo local real quando necessário.
- APIs internas reais.
- Adapters substituíveis por fake controlado só quando o alvo externo não deve ser chamado.
- Testar contratos entre módulos, auth, task engine, extensão e storage.

### Large / end-to-end / system
- Instância isolada do produto.
- Browser/UI real quando aplicável.
- Serviços locais reais.
- Fluxo de instalação, utilização, restart, upgrade e restore.
- Rede apenas para destinos explicitamente permitidos.
- Fixtures limpas e teardown garantido.

Classificar os testes por tamanho e tempo. Um teste de unit que depende da internet é mal classificado. Um teste de segurança não deve depender de um mock do controlo de acesso que pretende testar.

## 16.3 Testes determinísticos

- Fixar clock/time source quando possível.
- Controlar random seed em property/fuzz tests reproduzíveis.
- Isolar paths e portas.
- Evitar sleeps fixos; preferir events, polling com deadline e condition checks.
- Limpar estado depois do teste.
- Capturar logs em falhas.
- Não partilhar banco ou pastas mutáveis entre testes paralelos sem isolamento.
- Marcar testes flaky, investigar a causa e impedir que flaky tests se transformem em falso verde.

## 16.4 Testes funcionais

Para cada módulo: happy path, validação inválida, permission denied, dependência indisponível, timeout, cancelamento, falha parcial, retry, restart e upgrade.

## 16.5 Testes de API e contrato

- Schema e campos obrigatórios.
- Tipos e limites.
- Erros e status codes.
- AuthN/AuthZ.
- Idempotência.
- Pagination e filtros.
- Compatibilidade de versões.
- Rejeição de inputs desconhecidos perigosos.
- Limites de body e timeout.
- Event stream reconnection.

Executar contract tests entre core, providers, extensions e remote nodes.

## 16.6 Testes de segurança

Criar testes negativos automáticos para:
- Utilizador não autenticado.
- Utilizador sem permissão.
- Sessão expirada/revogada.
- CSRF/origin inválido.
- Path traversal em várias codificações.
- Symlink escape.
- Archive path traversal.
- Excessive archive expansion.
- SQL/command injection.
- SSRF para alvos bloqueados.
- Upload oversized.
- Rate-limit exhaustion.
- CORS indevido.
- Secret leakage em logs/diagnósticos.
- Extension capability escalation.
- Update com package adulterado.
- Reutilização de token após logout.

Usar scanners de dependências, SAST e testes dinâmicos compatíveis com a stack. As ferramentas ajudam, não substituem revisão nem cobertura dos casos.

## 16.7 Fuzzing e property-based tests

Priorizar parsers, manifests, configuração, routing, file path resolution, archive handling, serializers e API inputs.

- Guardar seed e minimized reproducer de falhas.
- Definir limites de tempo e memória.
- Separar fuzzing curto no CI de campanhas prolongadas agendadas.
- Converter bugs encontrados em regression tests.

## 16.8 Fault injection / chaos controlado

Num ambiente isolado, simular:
- Processo worker morto.
- API indisponível.
- Database ocupado ou read-only.
- Falha de disco/espaço simulado.
- Rede desconectada.
- DNS failure.
- Timeout do provider de agente.
- Tailscale ausente.
- Extensão que crasha.
- Upgrade interrompido.
- Serviço com crash loop.
- Reinício durante job.

Confirmar que o estado é coerente, erros são visíveis e a recuperação respeita a política. Não executar chaos tests destrutivos na instalação de produção.

## 16.9 Performance e resource testing

Medir baseline e acompanhar regressões para:
- Tempo de cold start e warm start.
- Uso de RAM após startup e depois de workload prolongado.
- CPU idle e durante load.
- Latência das rotas principais.
- Tempo da pesquisa do file manager.
- Upload/download streaming.
- Queue throughput.
- Tempo de recovery.
- Tempo de instalação/upgrade.
- Crescimento de logs e database.
- Consumo sob várias conexões.

No A13, a prioridade é estabilidade e uso de memória, não benchmark artificial de pico. Definir limites realistas após medir baseline. Não inventar números antes da medição.

## 16.10 Soak / endurance testing

Executar teste prolongado em perfil representativo, se o ambiente permitir, para descobrir:
- Memory leaks.
- File descriptor leaks.
- Restart loops.
- Crescimento ilimitado de logs/DB.
- Degradação de latência.
- Queue starvation.
- Degradação térmica.
- Jobs presos.
- Falha ao retomar rede.

Registar duração real, carga, ambiente e incidentes. Não afirmar teste de 24h se o teste correu 30 minutos.

## 16.11 Testes de upgrade/rollback/migração

- N-1 para versão nova.
- Instalação limpa.
- Dados representativos existentes.
- Configuração antiga.
- Extensões instaladas.
- Interrupção em pontos controlados do upgrade.
- Falha de migration.
- Restore depois de upgrade quebrado.
- Rollback de código e comportamento de schema.

Nunca prometer rollback do database se uma migration não for reversível. Preferir forward migration/restore testado em vez de rollback fictício.

## 16.12 Tests de instalação

Testar em ambiente limpo:
- Primeiro install.
- Repeated install.
- Falta de dependência.
- Arquitetura incompatível.
- Porta ocupada.
- Espaço insuficiente.
- Download interrompido.
- Digest inválido.
- Permissão negada.
- Falha em meio à instalação.
- Recovery e retry.
- Uninstall com preservação de dados.

## 16.13 Agent evaluations (evals)

Para cada comportamento de agente, definir um conjunto de tarefas com entradas, ambiente, tools permitidas, resultado esperado e grader objetivo.

Guardar:
- Task definition version.
- Model/provider e runtime version.
- Prompt/config version.
- Tool set.
- Trial/transcript sanitizado.
- Estado final real do ambiente.
- Checks e score.
- Tokens/custo/latência quando disponíveis.

Avaliar o estado real, não só a mensagem final do agente. Ex.: um agente que afirma “backup concluído” só passa se o artefacto existir, a integridade for válida e o restore-test relevante passar.

Executar múltiplas tentativas para tarefas não determinísticas. Manter casos positivos e negativos. O agente deve saber quando não agir; medir também ações desnecessárias, permissões excessivas e erros de autonomia.

Começar com um dataset pequeno de casos reais, incluir cada bug reportado e expandir por risco. Não usar apenas benchmarks genéricos que não representam o produto.

## 16.14 Testes do sistema inteligente

Criar evals para:
- Reconhecimento correto do perfil.
- Distinção RAM física/zRAM.
- Distinção kernel/userspace ABI.
- Recomendação sob memória baixa.
- Não recomendar upgrade incompatível.
- Deteção de porta ocupada.
- Deteção de runtime inexistente.
- Deteção de sinal desconhecido.
- Rejeição de hipótese sem evidência.
- Não executar ação destrutiva sem consentimento.
- Não reagir excessivamente a variação temporária.
- Escolher rotina menos onerosa adequada.
- Explicar motivo e plano de rollback.

## 16.15 Testes de usabilidade

Testar com um utilizador que não conhece o repositório ou as pastas internas. Verificar se consegue:
- Instalar.
- Entender estados do dispositivo.
- Encontrar uma extensão.
- Rever permissões.
- Configurar e remover a extensão.
- Ver um serviço falhado e descobrir ação segura.
- Criar backup e validar restore.
- Configurar acesso privado.

Registar passos ambíguos, necessidade de editar ficheiros, erros de linguagem e ações com nomes incompreensíveis. A instalação “fácil” não está demonstrada se requer uma explicação manual longa do autor.

---

# 17. PIPELINE CI, GATES E APROVAÇÃO DE RELEASE

## 17.1 Pipeline por alteração

Pipeline recomendada:

1. Formatting/lint.
2. Type checking.
3. Unit tests.
4. Package/build integrity.
5. Contract tests.
6. Integration tests afetados.
7. Security tests rápidos.
8. Dependency and secret scanning.
9. Frontend build and route checks.
10. Artifact metadata/SBOM when supported.

## 17.2 Pipeline de integração principal

Além dos passos rápidos:
- Todas as unit tests relevantes.
- Todas as contract tests.
- Integração database/task/extension/API.
- UI end-to-end prioritária.
- Verificação de migrations.
- Security regressions.
- Compatibilidade do pacote de release.

## 17.3 Release candidate

Antes de publicar uma release candidate:
- Clean install.
- Upgrade from previous supported version.
- Backup and restore test.
- Full regression suite.
- Security review independente.
- Compatibility matrix.
- Resource/endurance tests apropriados à severidade.
- Verificação dos artefactos e instruções.
- Review de erros e known issues.

## 17.4 Release gate obrigatório

**Bloquear release** se qualquer condição se verificar:
- Teste obrigatório falhou ou não foi executado sem justificação aceite.
- Vulnerabilidade crítica ou alta sem mitigação/aprovação documentada.
- Backup/restore está quebrado quando dados persistentes podem ser afetados.
- Migration não foi testada contra estado representativo.
- Autenticação ou autorização pode ser contornada.
- A versão apresenta sucesso falso em operação crítica.
- Installer pode destruir dados ao repetir execução.
- Pacote ou origem não passa verificação de integridade configurada.
- Extension install pode executar código incompatível sem inspeção/permissions.
- Não existe forma de recuperar um estado quebrado que o release pode produzir.
- Requisitos de aceitação críticos não têm evidência.

Não ocultar um bloqueador para aumentar a taxa de releases.

## 17.5 Staged rollout

Sempre que a distribuição permite:
- Developer build.
- Internal test build.
- Release candidate.
- Preview/early adopter.
- Stable.

Usar rollout gradual ou canary quando viável: aplicar a mudança num âmbito pequeno, observar health/error signals, aumentar exposição apenas se estável e reverter rapidamente se os sinais piorarem.

Para uma instalação local, canary pode significar testar numa instância clonada, num perfil de teste ou numa cópia dos dados antes de aplicar à instância principal.

## 17.6 Reproducibilidade e provenance

- Lock dependencies.
- Registar versões e parâmetros do build.
- Evitar downloads não versionados durante build.
- Gerar release manifest.
- Hash de artefactos.
- Assinatura quando houver infraestrutura segura para gerir chaves.
- SBOM quando ferramentas e formato forem adequados.
- Guardar logs do build.

Não afirmar build reproduzível sem comparar artefactos de builds independentes.

## 17.7 Processo de revisão inspirado em boas práticas públicas

Aplicar princípios verificáveis, não alegações sobre processos internos de qualquer empresa:
- Testes em múltiplas escalas e rápido feedback, como descrito publicamente em materiais de engenharia do Google.
- Evals com tarefas e graders objetivos para sistemas agentic, como discutido nos artigos de engenharia publicados pela Anthropic.
- Segurança integrada no design, assinatura/integridade de código e revisão independente, de acordo com orientações publicadas por Apple e frameworks de segurança.
- Desenvolvimento seguro segundo NIST SSDF.
- Verificação de controlos de aplicação usando OWASP ASVS, no nível aplicável ao risco.
- Releases pequenos e canary/rollout gradual segundo as orientações de release engineering do Google SRE.

O produto não é “igual ao Google/Anthropic/Apple” porque usa uma checklist; ele só pode afirmar que adota as práticas concretas que realmente implementou e testou.

---

# 18. MATRIZ DE COMPATIBILIDADE E DEVICE LAB

## 18.1 Plataformas-alvo

Manter uma matriz central de compatibilidade, por exemplo:
- A13 Android/Termux sem root.
- Android/Termux noutros perfis suportados.
- Linux ARM64.
- Linux x86_64.
- Windows para desenvolvimento ou deployment quando suportado.
- Remote node para workloads específicos.

Não assinalar compatibilidade universal antes de testar pelo menos os caminhos críticos de instalação, startup, API, storage e update naquela família de ambiente.

## 18.2 Teste por plataforma

Para cada perfil, registar:
- Hardware/runtime real.
- Instalação limpa.
- Arranque e stop.
- Paths e permissões.
- Storage behavior.
- Ports/network binding.
- Database driver.
- Runtime/ABI.
- Adapter health.
- Backup/restore.
- Atualização.
- Funcionalidades não disponíveis.

## 18.3 Ambiente de testes do A13

Quando o dispositivo estiver ligado e acessível, usar o mecanismo autorizado existente (por exemplo, SSH/ADB conforme já configurado) para executar health/testes de forma controlada. Não presumir que a conexão existe.

Não executar benchmarks que aqueçam ou esgotem a bateria sem uma janela e limites adequados. Testes de stress devem ter timeout e condições de aborto.

## 18.4 Matriz funcional por capability

Cada feature deve definir `requires_capabilities`, `optional_capabilities` e alternativa.

O instalador e a UI consultam essa matriz. Uma nova versão de runtime não deve habilitar uma função se o probe de execução falhou.

---

# 19. ESTRATÉGIA DE PERFORMANCE E EFICIÊNCIA

## 19.1 Estabelecer baseline

Antes da otimização, medir:
- Tamanho do bundle.
- Tempo de cold start.
- Memória idle e sob carga.
- Uso de CPU do polling/monitoring.
- Quantidade e frequência dos processos.
- Latência API principal.
- Tempo de abertura da UI.
- Volume de logs por unidade de tempo.
- Tempo de inventário completo.
- Espaço de banco e temporários.

## 19.2 Evitar trabalho desnecessário

- Cachear discovery com TTL e invalidação clara.
- Separar startup checks de full diagnostics.
- Preferir eventos a polling quando viável.
- Agrupar polls de dashboard e desacelerar quando a tab está inativa.
- Paginar logs e ficheiros.
- Streaming para grandes objetos.
- Lazy-load de páginas e integrações pesadas.
- Não iniciar serviços opcionais até necessários.
- Adiar manutenção pesada em condições desfavoráveis.
- Limitar filas e paralelismo.
- Evitar múltiplas cópias de grandes artefactos.

## 19.3 Medição antes/depois

Cada otimização deve trazer baseline, alteração, cenário comparável, resultados, erros e decisão. Uma melhoria de velocidade que aumenta crash rate, fragiliza segurança ou perde dados não é melhoria.

---

# 20. OBSERVABILIDADE, DIAGNÓSTICOS E SUPPORTABILITY

## 20.1 Logs estruturados

Incluir campos consistentes quando aplicável:
- Timestamp UTC.
- Severity.
- Component/module.
- Instance ID não sensível.
- Correlation ID.
- Task/extension/service ID.
- Event code.
- Resultado e duração.
- Mensagem segura.

Nunca registar password, token, cookie, private key, prompt sensível completo por defeito ou conteúdos arbitrários de ficheiros.

## 20.2 Health e readiness

Distinguir:
- Process alive.
- Service healthy.
- API ready.
- Database accessible.
- Worker ready.
- Provider authenticated.
- Remote node reachable.
- End-to-end task verified.

Não usar um único `OK` para todas essas condições.

## 20.3 Relatório de diagnóstico

`omni doctor` deve produzir relatório redigido com:
- Versões.
- Arquitetura/kernel/userspace.
- Capacidades e confidence.
- Configuração não secreta.
- Serviços e port conflicts.
- Health checks.
- Migrations.
- Disk/memory.
- Erros recentes sanitizados.
- Extensões/provider status.

Permitir revisão antes de partilhar externamente; export nunca inclui secrets.

---

# 21. MODELO DE DADOS, MIGRATIONS E CICLO DE VIDA

Inspecionar primeiro o DB atual. Se SQLite for usado, validar o driver no userspace real e documentar comportamento do journal/WAL. Não copiar um DB ativo sem snapshot/mecanismo consistente.

Entidades candidatas quando justificadas pelo modelo real:
- Instance/config versions.
- Users/roles/sessions.
- Modules/capabilities.
- Extensions/versions/permissions/installations.
- Providers/adapters.
- Agents/sessions/workspaces.
- Tasks/attempts/dependencies/artifacts.
- Automation routines/schedules/runs.
- Memory records/namespaces/provenance.
- Storage roots/file operations.
- Workloads/services.
- Remote nodes.
- Notifications/alerts.
- Audit events.
- Backups/restore runs.

Cada migration deve ser versionada, testada, observável e segura em caso de interrupção. Manter backups e rollback/forward recovery quando possível. Não criar tabelas só para parecer abrangente.

Definir retention para logs, task history, temporary data e event history. A limpeza tem de ser limitada, previsível e registada.

---

# 22. DOCUMENTAÇÃO COMO PARTE DO PRODUTO

Documentação obrigatória sincronizada com código real:

- `README.md`: visão, requisitos, instalação rápida, links para o resto.
- `docs/architecture/overview.md`: arquitetura e data flow.
- `docs/architecture/decisions/`: ADRs para escolhas relevantes.
- `docs/installation/termux.md`.
- `docs/installation/linux.md` quando suportado.
- `docs/installation/windows.md` quando suportado.
- `docs/user-guide/first-run.md`.
- `docs/user-guide/dashboard.md`.
- `docs/user-guide/plugins.md`.
- `docs/user-guide/device-intelligence.md`.
- `docs/user-guide/automation.md`.
- `docs/user-guide/backup-restore.md`.
- `docs/developer-guide/extension-sdk.md`.
- `docs/developer-guide/adapter-sdk.md`.
- `docs/developer-guide/api.md`.
- `docs/security/threat-model.md`.
- `docs/security/plugin-trust.md`.
- `docs/operations/runbook.md`.
- `docs/operations/recovery.md`.
- `docs/testing/test-strategy.md`.
- `docs/testing/release-gates.md`.
- `docs/compatibility/matrix.md`.

Não criar documentos duplicados com orientações diferentes. Um único documento deve ser a fonte de verdade para cada tema.

---

# 23. GOVERNANÇA DO TRABALHO MULTIAGENTE

## 23.1 Roles

**Coordenador/Principal Architect:** inventário, backlog, contratos, ownership, prioridade, integração e aprovação final.

**Device Intelligence & Runtime:** probes, capability registry, perfis, Termux e rotina de manutenção.

**Installer & Release:** bootstrap, setup, pacote, migration, rollback e release pipeline.

**Plugins & Integrations:** SDK, manifest, marketplace, adapter e lifecycle.

**AI/Task Engine:** providers, queues, jobs, eval harness, memory integration e workspace policies.

**Frontend/Product UX:** painel, wizard, dashboard, console e API integration.

**Security/QA:** threat model, testes negativos, test matrix, recovery e revisão independente.

Consolidar papéis se não houver agentes suficientes. Nunca fingir que foi realizada revisão independente quando o mesmo agente escreveu e aprovou tudo.

## 23.2 Protocolo antes de delegar

- Fazer mapa de dependências.
- Definir contratos partilhados antes de tarefas paralelas.
- Delimitar os ficheiros e interfaces que cada agente pode alterar.
- Definir acceptance criteria e testes por tarefa.
- Evitar dois agentes a reescrever o mesmo módulo.
- Usar branches/worktrees se disponíveis.
- Pedir relatório de ficheiros alterados, decisões, testes e riscos.
- Integrar por review.
- Executar tests integrados depois do merge.

## 23.3 Gestão de contexto

Manter artefactos pequenos e autoritativos:
- `docs/architecture/current-state.md`
- `docs/architecture/decisions/`
- `docs/planning/backlog.md`
- `docs/planning/ownership.md`
- `docs/testing/release-dashboard.md`
- `docs/operations/known-issues.md`
- `docs/planning/continuation.md`

Não obrigar todos os agentes a reler o repository inteiro a cada tarefa. Passar contexto relevante e paths exatos. Atualizar a fonte de verdade quando decisões mudam.

---

# 24. BACKLOG DE IMPLEMENTAÇÃO PRIORIZADO

As prioridades devem ser revistas depois da auditoria; não são autorização para saltar a fase zero.

## P0 — Evitar perda de dados e falhas críticas

- Baseline, backup/restore verificado.
- Serviço e arranque atuais preservados.
- Auth, sessão e API sem bypass conhecido.
- Diagnóstico de estado atual.
- Remover alegações mockadas perigosas.
- Testes mínimos de smoke.

## P1 — Fundação confiável

- Config validation.
- Capability registry inicial.
- Health/readiness consistente.
- Logging e redaction.
- DB migrations.
- CLI diagnostic.
- Test harness e test matrix.

## P2 — Instalação e recuperação

- Installer idempotente.
- Wizard first-run.
- Preflight de compatibilidade.
- Repair/update/rollback.
- Testes de instalação limpa, repetida e falhada.

## P3 — Plugins reais

- Manifest schema.
- Registry local.
- Permission model.
- Dependency checker.
- Lifecycle transacional.
- Example plugin.
- Plugin end-to-end tests.

## P4 — Sistema inteligente

- Hardware/runtime detection detalhada.
- Perfil recomendado e explicável.
- Observação e baseline.
- Rotinas de saúde seguras.
- Dry-run e rollback.
- Evals de recomendações.

## P5 — Task engine/agents

- Durable queue.
- Agent adapters.
- Concurrency/resource policy.
- Cancellation/recovery.
- Agent eval harness.

## P6 — File manager e memória

- File safety tests.
- Streaming.
- Roots/quota.
- Project-aware memory.
- Backup integration.

## P7 — Painel integrado

- Preservar design útil.
- API wiring.
- Device intelligence UI.
- Installer wizard.
- Extension marketplace.
- Services/tasks/files/agents panels.

## P8 — Workloads e remote nodes

- Web/static hosting compatível.
- Profiles de game hosting validados.
- DNS/ad-block integrations opcionais.
- Secure remote worker protocol.

## P9 — Release hardening

- Full regression.
- Security review.
- Upgrade/rollback.
- Soak tests.
- Compatibilidade A13 real.
- Documentação de release.

Nunca marcar uma fase completa por ter criado as pastas ou interfaces; usar os critérios de aceitação associados.

---

# 25. MATRIZ DE TESTES MESTRA

Cada família de testes deve ter owner, trigger, timeout, ambiente, artefactos, severidade de falha e frequência.

| ID | Família | Exemplos obrigatórios | Gate |
|---|---|---|---|
| T-001 | Lint/format | Todos os ficheiros alterados | PR/integração |
| T-002 | Type/build | Core, UI, CLI, workers | PR/integração |
| T-003 | Unit | Policies, states, parsers | Cada alteração |
| T-004 | DB/migrations | Clean DB, upgrade, interrupted migration | PR/release |
| T-005 | API contract | Auth, schemas, pagination, errors | PR/release |
| T-006 | Extension contract | Manifest, lifecycle, permissions | PR/release |
| T-007 | Installer clean | Fresh install em ambiente isolado | Release candidate |
| T-008 | Installer idempotence | Instalar duas vezes sem duplicação | Release candidate |
| T-009 | Installer recovery | Interrupções e retry | Release candidate |
| T-010 | Auth/security | Unauthenticated/unauthorized/expired session | PR/release |
| T-011 | Filesystem | Traversal, symlink, archive bomb | PR/release |
| T-012 | Agent adapter | Version/auth/capability/timeout | Por adapter |
| T-013 | Agent eval | Tarefas com graders determinísticos e trials repetidos | Por alteração agent |
| T-014 | Task lifecycle | Retry, cancel, timeout, restart recovery | PR/release |
| T-015 | Automation safety | Dry-run, permissions, loops, rate limits | PR/release |
| T-016 | Device detection | Missing/malformed/probe-denied/timeouts | PR/compatibility |
| T-017 | Recommendations | Correct action/no-action/rollback | PR/release |
| T-018 | Dashboard E2E | Main pages e real backend interactions | Integration/release |
| T-019 | Resource/perf | Startup, RSS, CPU, queue, file transfer | Scheduled/release |
| T-020 | Endurance/soak | Leaks, queue growth, crash loops | Pre-release |
| T-021 | Fault injection | DB/network/worker/provider failures | Pre-release |
| T-022 | Backup/restore | Restore em alvo isolado e verificar conteúdo | Release |
| T-023 | Upgrade/rollback | N-1, migrations, failed update | Release |
| T-024 | Platform compatibility | A13/Termux e cada platform declarada | Release per target |
| T-025 | Accessibility/usability | Keyboard/mobile/first install | Release |
| T-026 | Supply chain | Dependency/license/secrets/package integrity | PR/release |
| T-027 | Network exposure | Bind, CORS, Tailscale state, no public listeners | Release |
| T-028 | Log redaction | Tokens/passwords/path-sensitive data | PR/release |
| T-029 | Regression | Todos os bugs anteriores convertidos em tests | Every build |
| T-030 | Documentation smoke | Comandos de docs ainda válidos | Release |

Esta tabela deve ser expandida quando um bug, incidente ou requisito novo o justificar.

---

# 26. CENÁRIOS END-TO-END OBRIGATÓRIOS

## E2E-01 — Instalação limpa

Um ambiente de teste limpo executa o bootstrap, valida dependências, conclui setup, inicia serviços e autentica no painel. Resultado final é verificado pela API/UI real.

## E2E-02 — Reinstalação

Executar instalador novamente. Confirmar ausência de duplicação de serviços, port changes inesperadas, reset de credenciais e corrupção do banco.

## E2E-03 — Detecção inteligente

Fornecer inputs de fixtures representando A13, Linux ARM64, Linux x86_64, runtime ausente, permissão negada e sinal desconhecido. Comparar capabilities esperadas e recomendações.

## E2E-04 — Recomendação não destrutiva

Simular memória baixa. O sistema deve recomendar limite de concorrência com evidência e rollback. Em modo read-only/dry-run não pode modificar configuração.

## E2E-05 — Rotina de serviço

Parar um serviço de teste de forma controlada. Verificar deteção, política de retry, restart limitado, auditoria e alerta. Confirmar que crash loop termina em estado degraded e não reinicia indefinidamente.

## E2E-06 — Plugin real

Descobrir, inspecionar, aprovar, instalar, configurar, executar, atualizar, desativar e remover a extensão de referência através da interface suportada.

## E2E-07 — Plugin malicioso/incompatível

Submeter manifest inválido, package adulterado, dependência ausente e pedido de permissão não aprovada. Confirmar bloqueio e logs úteis.

## E2E-08 — Agent task

Enviar tarefa a provider real suportado, observar progresso, validar artifacts/estado final, cancelar noutra execução e testar timeout.

## E2E-09 — Restart durante tarefa

Reiniciar worker/core numa instância de teste. Verificar recuperação sem resultado falso nem duplicação de operações não idempotentes.

## E2E-10 — Segurança de ficheiros

Tentar traversal, symlink escape, archive traversal e upload acima do limite. Todos devem ser rejeitados sem acesso lateral.

## E2E-11 — Backup e restore

Criar backup, validar digest e restaurar numa instância isolada. Verificar contagem e hashes de ficheiros selecionados, schema, configuração não secreta e usabilidade da aplicação.

## E2E-12 — Upgrade e falha

Atualizar da versão anterior suportada. Injectar falha num ambiente de teste e provar restore/recovery documentado.

## E2E-13 — Acesso privado

Quando a rede real estiver disponível, completar autenticação de Tailscale, validar hostname/endereço real e confirmar que o painel ainda exige sessão válida.

## E2E-14 — Hardware incompatível

Simular ou usar binário incompatível. O sistema deve desativar feature, explicar requisito e manter core saudável.

## E2E-15 — Primeiro utilizador

Uma pessoa que não conhece paths do projeto instala, entra no painel, encontra extensão, interpreta um alerta e identifica como obter ajuda sem editar código.

---

# 27. RELEASE CHECKLIST E DEFINIÇÃO DE PRONTO

Uma release não passa para `STABLE` até todos os gates críticos serem satisfeitos ou existir uma exceção explícita, documentada, aprovada e sem violação de segurança/data integrity.

## Produto

- [ ] Requisitos e riscos atualizados.
- [ ] Compatibilidade declarada por plataforma.
- [ ] UI sem ações críticas fake.
- [ ] Instalação normal documentada e testada.
- [ ] Erros e limitações explicados.
- [ ] Dados preservados em upgrade/remove conforme policy.

## Engenharia

- [ ] Lint/typing/build passaram.
- [ ] Unit tests passaram.
- [ ] Contract/integration tests passaram.
- [ ] Migrations validadas.
- [ ] Regressions anteriores cobertas.
- [ ] Artefactos versionados e verificáveis.

## Segurança

- [ ] AuthN/AuthZ revistos.
- [ ] Endpoints de alto impacto cobertos por testes negativos.
- [ ] Dependências e secrets analisados.
- [ ] Plugins e agents respeitam policy.
- [ ] Logs/diagnósticos sem secrets.
- [ ] Exposição de rede verificada.
- [ ] Revisão independente dos riscos de maior impacto.

## Operação

- [ ] Clean install passou.
- [ ] Repeat install passou.
- [ ] Upgrade passou.
- [ ] Backup/restore passou.
- [ ] Health checks passaram.
- [ ] Restart recovery passou.
- [ ] Resource limits estão definidos e medidos.
- [ ] Runbooks estão atualizados.

## Release

- [ ] Changelog e release notes.
- [ ] Known issues list.
- [ ] Test report com comandos/resultados.
- [ ] Artifact digests/provenance.
- [ ] Rollback procedure verificado quando disponível.
- [ ] Release candidate foi avaliada antes de stable.

---

# 28. FORMATO OBRIGATÓRIO DOS RELATÓRIOS DOS AGENTES

Cada agente devolve:

1. Papel/tarefa e requisitos IDs.
2. Estado anterior e observações reais.
3. Ficheiros alterados.
4. Interfaces/contratos afetados.
5. Implementação concretamente concluída.
6. Testes executados — comando exato e resultado.
7. Testes não executados e motivo.
8. Evidência do comportamento.
9. Riscos de regressão.
10. Limitações e passos manuais ainda necessários.
11. Dependências para integração.
12. Confirmação de que não alterou ficheiros fora do ownership sem coordenação.

O coordenador não aceita “completed” sem testes/evidência, nem “all tests pass” sem lista dos comandos e resultados disponíveis.

---

# 29. PROMPT OPERACIONAL FINAL PARA O COORDENADOR

És o principal engenheiro responsável por levar o projeto existente a este standard.

1. Lê este ficheiro inteiro.
2. Audita o repositório e os relatórios disponíveis.
3. Gera o inventário inicial e o baseline de testes.
4. Identifica os maiores riscos de regressão, segurança e perda de dados.
5. Converte os requisitos em tickets pequenos, com IDs e critérios de aceitação.
6. Define contratos/interfaces antes de delegar tarefas paralelas.
7. Usa apenas os agentes e ferramentas realmente disponíveis e autorizados.
8. Atribui responsabilidades sem overlap descontrolado.
9. Começa pelo P0/P1 e implementa incrementos reais.
10. Inclui a inteligência de descoberta, o sistema de rotinas, o instalador e o sistema de extensões no desenho desde o início; não os acrescentes como scripts isolados no final.
11. Cria os testes para cada feature antes ou durante a implementação, não apenas depois.
12. Revê de forma independente mudanças de maior risco.
13. Testa no ambiente adequado e distingue simulação, desktop e A13 real.
14. Integra contribuições, resolve conflitos e executa regressões.
15. Só publica componentes depois dos release gates aplicáveis.
16. Mantém o sistema capaz de arrancar em cada incremento seguro.
17. Atualiza a documentação e o estado do backlog.
18. Produz relatório transparente em português.

Não inventes capabilities, endpoints, dados de hardware, métricas, URLs, resultados, autenticação ou disponibilidade de agentes.

Não reinstales ferramentas apenas para parecer ativo. Não substituas tecnologia funcional sem prova de ganho. Não abras ports, alteres router, apagues dados ou concedas privilégios sem aprovação explícita.

Se não conseguires verificar uma feature, marca-a como `IMPLEMENTED_UNVERIFIED`, `BLOCKED` ou `UNKNOWN` e explica o teste necessário.

Se uma funcionalidade for impossível no A13, conserva a interface de gestão apenas se ela comunicar honestamente o estado e tiver um plano suportado de remote node — nunca um botão falso.

**Missão:** construir um produto universal e útil, com instalação realmente simples e comportamento inteligente baseado em evidência; uma plataforma que saiba o que o dispositivo suporta, escolha rotinas proporcionais, explique suas decisões, consiga recuperar de falhas e só publique uma versão quando testes apropriados sustentarem a confiança.

---

# 30. REFERÊNCIAS PÚBLICAS PARA A DISCIPLINA DE ENGENHARIA

Estas fontes são referências de práticas públicas, não alegações de que o projeto reproduz processos internos de qualquer empresa. Consultar a versão aplicável quando atualizar a estratégia de segurança e testes.

1. **Google Testing Blog — Test Sizes:** classificação de testes por dependências, isolamento e duração.  
   https://testing.googleblog.com/2010/12/test-sizes.html
2. **Google SRE Workbook — Canarying Releases:** releases pequenos, avaliação gradual, automação e redução do impacto de regressões.  
   https://sre.google/workbook/canarying-releases/
3. **Anthropic Engineering — Demystifying evals for AI agents (9 janeiro 2026):** tarefas com critérios de sucesso, graders, trials, estado real, traces e avaliação de regressões em agentes.  
   https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
4. **Anthropic Engineering — Harness design for long-running applications:** decomposição em tarefas manejáveis, artefactos de handoff e avaliação independente.  
   https://www.anthropic.com/engineering/harness-design-long-running-apps
5. **NIST SP 800-218 — Secure Software Development Framework (SSDF):** práticas de desenvolvimento seguro integradas ao ciclo de vida. A versão 1.2 foi publicada como draft inicial em dezembro de 2025; verificar o estado atual antes de a tratar como final.  
   https://csrc.nist.gov/pubs/sp/800/218/final  
   https://csrc.nist.gov/pubs/sp/800/218/r1/ipd
6. **OWASP Application Security Verification Standard (ASVS):** requisitos técnicos verificáveis para controlos de segurança de aplicações; a página do projeto indica a versão estável 5.0.0.  
   https://owasp.org/projects/asvs
7. **Apple Developer — Security:** princípios publicados sobre identidade/autorização, proteção de dados, conexões seguras, integridade de código e uso de APIs criptográficas estabelecidas em vez de implementar criptografia própria.  
   https://developer.apple.com/documentation/security
8. **Apple Developer — Security Development Checklists:** revisão independente e reavaliação de segurança após alterações.  
   https://developer.apple.com/library/archive/documentation/Security/Conceptual/SecureCodingGuide/SecurityDevelopmentChecklists/SecurityDevelopmentChecklists.html

---

# FIM DA ESPECIFICAÇÃO MESTRA

**Regra final:** esta especificação é o contrato de direção e qualidade do produto. O código real, os resultados dos testes e o comportamento observado continuam a ser a fonte de verdade sobre o estado da implementação. A ambição é elevada; as afirmações de conclusão têm de permanecer proporcionais às evidências.
