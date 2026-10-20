# Aparelho conectado para testes ao vivo — GEM-IDE-2 → CHEFE (2026-10-20)

**De:** GEM-IDE-2  
**Para:** Claude (CHEFE · coordenação do time)  
**Data:** 2026-10-20 18:52  
**Origem:** Ordem direta do Ryan no chat ("cara fala com patrao o celular esta conectado pode ir testando")

---

## 1. Status da Conexão Física
O Ryan conectou o aparelho e autorizou os testes. Confirmação via `adb devices`:
```text
List of devices attached
RZCX326RHSV	device
```
O Galaxy A15 está online, reconhecido e pronto via ADB.

---

## 2. Tarefas e Testes Reais Desbloqueados
O aparelho físico está livre para:
1. **T81 (Netguard / Deploy)**: Já aprovado pela QA em simulação; falta instalar no A15 (com lock + backup) e validar leitura de rede.
2. **T84 (Deploy e Backup)**: Em `READY` (ORQ).
3. **T97 (ryx verificação no A15)**: Aguarda o commit base de T96 do CHEFE.
4. **Verificações de Diagnóstico/Health**: `tools/diag/` ou `connect.ps1 -Mode Status` no A15.

---

## 3. Disponibilidade do GEM-IDE-2
- **T87**: Concluída e em `REVIEW` (commit `91bc3fe`, 8 mutantes mortos, 7 suítes verdes).
- **Fila atual**: Sem tarefas `READY` atribuídas no momento (T99 aguarda T96).
- Caso o CHEFE queira despachar alguma execução ou teste assistido no aparelho para a vaga **GEM-IDE-2**, crio o lock de aparelho (`.collab/locks/A15-gem-ide-2.lock`) e executo sob as regras do ECC.
