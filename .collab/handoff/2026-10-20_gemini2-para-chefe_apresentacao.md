# Handoff: Apresentação do 2º Agente Gemini (GEMINI-2) ao Claude CHEFE

**De:** GEMINI-2 (Instância 2 da Antigravity IDE / Sessão Secundária Independente)  
**Para:** Claude (CHEFE · coordenação do time / ORQ)  
**Data:** 2026-10-20 01:15  
**Origem:** Ordem direta do Ryan no chat ("cara da um oi para o claude agora sao 2 gemini trabalhando ... e fala pro claude que voce e o 2 gemini")  

---

### 1. Mensagem de Apresentação e Alinhamento

Olá, **Claude (CHEFE / ORQ)**!

Apresento-me oficialmente como o **GEMINI-2**, operando na **Instância 2 do Antigravity IDE** sob perfil e dados completamente isolados (`C:\Users\Ryanr\.antigravity-conta2\data`).

A partir de agora, o time conta com **dois agentes Gemini** disponíveis para execução em paralelo:
- **GEMINI-1 (Janela 1):** Continua na sua frente de trabalho designada no loop contínuo.
- **GEMINI-2 (Janela 2 - Este Agente):** 100% ativo, com contexto limpo, focado em acelerar entregas, engenharia de software e testes nas zonas autorizadas.

---

### 2. Protocolo de Convivência e Subordinação Operacional

Confirmo a absorção total dos protocolos de [docs/COLABORACAO.md](file:///C:/Users/Ryanr/Desktop/celular/docs/COLABORACAO.md) e [GEMINI.md](file:///C:/Users/Ryanr/Desktop/celular/GEMINI.md):
1. **Liderança do Claude (CHEFE):** Reconheço o Claude como líder e comandante do projeto. Prioridades, aprovações e divisão de tarefas partem exclusivamente de você via `.collab/TASKS.md` e `.collab/handoff/`.
2. **Isolamento de Zonas & Concorrência:** Só edito arquivos dentro da minha zona autorizada (`tools/connect`, `tools/rescue`, `tools/debug`, `profiles/` ou worktrees dedicadas como `server/panel/server-box-gemini`). Nunca tocarei em arquivos de outros agentes sem handoff prévio.
3. **Respeito a Locks:** Nenhuma ação no A15 ou áreas críticas sem verificar `.collab/locks/`.
4. **Economia Rígida de Tokens (§9):** Leituras cirúrgicas, sem despejo de logs extensos, sem loops de espera ativa (`powershell Start-Sleep` só quando autorizado) e saídas compactas.
5. **Rastreabilidade no Git:** Commits com autoria explícita (`git -c user.name="gemini-2" commit -m "GEMINI-2: Txx ..."`).

---

### 3. Prontidão para Tarefas

Estou com a suíte de testes validada e pronto para assumir qualquer tarefa que o CHEFE desejar despachar em [.collab/TASKS.md](file:///C:/Users/Ryanr/Desktop/celular/.collab/TASKS.md) para desafogar a fila da equipe.

Um abraço e bom trabalho conjunto!
