# Handoff: Criação de GEMINI-2.md e formalização técnica do GEM-IDE-2

**De:** GEM-IDE-1 (Instância 1 da Antigravity IDE)  
**Para:** Claude (CHEFE / ORQ)  
**Data:** 2026-10-20 02:05  
**Origem:** Ordem direta do Ryan ("cria um gemini md para o claude saber sobre o outro agente e com a config do outro agente")

---

### Contexto & O que foi feito

Conforme a Decisão D18 e a ordem direta do Ryan, formalizamos a documentação de instruções e configuração técnica exclusiva para o segundo agente da IDE em [GEMINI-2.md](file:///c:/Users/Ryanr/Desktop/celular/GEMINI-2.md).

1. **Novo arquivo de instruções:** `GEMINI-2.md` criado na raiz do repositório, no mesmo padrão de `GEMINI.md` e `CLAUDE.md`.
2. **Atualização de [AGENTS.md](file:///c:/Users/Ryanr/Desktop/celular/AGENTS.md):** Aponta agora para os 3 manuais correspondentes:
   - `GEMINI.md` → **GEM-IDE-1** (foco no `celular`)
   - `GEMINI-2.md` → **GEM-IDE-2** (segundo agente / Conta 2)
   - `CLAUDE.md` → **CHEFE** (coordenação)
3. **Atualização de [GEMINI.md](file:///c:/Users/Ryanr/Desktop/celular/GEMINI.md):** Seção Multi-Agente atualizada com link para `GEMINI-2.md`.

---

### Ficha Técnica de Configuração do GEM-IDE-2

- **Sigla Oficial:** `GEM-IDE-2`
- **Diretório de Sessão/Auth:** `C:\Users\Ryanr\.antigravity-conta2\data` (totalmente desacoplado, sem colisão de login nem de tokens).
- **Atalhos / Launch:** `C:\Users\Ryanr\Desktop\Abrir-Antigravity-Conta2.bat` e `Antigravity IDE - Conta 2.lnk`.
- **Extensões Compartilhadas:** `C:\Users\Ryanr\.antigravity-ide\extensions`.
- **Padrão de Commit:** `git -c user.name="gem-ide-2" commit -m "GEM-IDE-2: Txx ..." -- <arquivos>`
- **Padrão de Lock:** `.collab/locks/<Txx>-gem-ide-2.lock`
- **Padrão de Handoff:** `.collab/handoff/AAAA-MM-DD_gem-ide-2-para-chefe_<assunto>.md`
- **Escopo Operacional:** Foco principal em outras frentes (Crypto, Shopify/E-commerce, etc.). No projeto `celular`, atua sob demanda explícita quando houver tarefa `READY` atribuída a ele no `TASKS.md` ou ordem do Ryan. Subordinação total ao CHEFE com revisão por QA/CHEFE.
