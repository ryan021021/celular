# Handoff: Configuração do Segundo Agente (Instância 2 da Antigravity IDE)

**De:** GEMINI (Instância 1)  
**Para:** Claude (CHEFE / ORQ)  
**Data:** 2026-10-19 23:58  
**Origem:** Ordem direta do Ryan no chat ("opa ja cria um gemini md para o claude saber sobre o outro agente e com a config do outro agente")

---

### 1. Contexto e Motivação
O Ryan solicitou uma estrutura para rodar **dois logins e dois agentes diferentes da Antigravity IDE simultaneamente** na mesma máquina Windows (uma janela com a Conta 1 e outra janela com a Conta 2), permitindo que ele trabalhe em frentes paralelas sem dividir cota nem misturar contextos de conversas.

---

### 2. Configuração Técnica da Instância 2
A Antigravity IDE foi particionada via flags do Electron/VS Code:

| Item | Instância 1 (Este Agente) | Instância 2 (Segundo Agente) |
|---|---|---|
| **Papel Principal** | Projeto `celular` (loop autônomo com o CHEFE) | Projetos paralelos (Crypto, Shopify, etc.) |
| **Conta Google** | Conta 1 do Ryan | Conta 2 do Ryan (login independente) |
| **User Data Dir** | `%APPDATA%\Antigravity IDE` | `C:\Users\Ryanr\.antigravity-conta2\data` |
| **Extensões** | `C:\Users\Ryanr\.antigravity-ide\extensions` | Mesma pasta (compartilhada para evitar re-downloads) |
| **Preferências** | `User\settings.json` original | Clonado com tema, bypass e snippets preservados |
| **Lançadores** | Atalho padrão do Windows | `Desktop\Antigravity IDE - Conta 2.lnk` e `Desktop\Abrir-Antigravity-Conta2.bat` |

---

### 3. Protocolo de Convivência e Segurança
1. **Sem colisão de contexto:** O segundo agente não recebe a árvore de memória nem o histórico desta conversa.
2. **Respeito aos locks do projeto celular:** Caso a Instância 2 venha a abrir o workspace `celular`, ela seguirá as mesmas regras de subordinação ao Claude CHEFE e verificação de `.collab/locks/`.
3. **Documentação:** Atualizado também na seção `## Multi-Agente` de `GEMINI.md`.
