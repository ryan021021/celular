# A13 HOME VPS — RELATÓRIO DE BASELINE (FASE 0)
**Data/Hora:** 2026-10-18T23:59:00Z  
**Dispositivo:** Samsung Galaxy A13 (SM-A135M / a13ub)  
**Serial:** RQ8TC00EJNB  
**Kernel:** Linux 4.19.198-28701120-abA135MUBSDDZB3 (armv8l 32-bit userspace)  
**SO:** Android 14 / One UI 6.1 (Security Patch 2024-06-01 / Build DDZB3)  
**Runtime:** Termux 0.118.0 + Termux:Boot + Termux:API  

---

## 1. Identificação de Runtimes e Pacotes
- **Node.js:** v24.18.0
- **npm:** 11.21.1
- **Python:** 3.14.6
- **Git:** 2.56.0
- **OpenSSH:** OpenSSH_10.6p1, OpenSSL 3.6.5

---

## 2. Métricas de Hardware e Subsistema
- **RAM Total:** 3.795.712 kB (~3,8 GB físicos)
- **RAM Disponível (MemAvailable):** 2.069.979 kB (~2,07 GB disponíveis)
- **ZRAM / Swap Livre:** 3.626.236 kB (swap total ~4 GB)
- **Armazenamento /data:** 117 GB total, 6.0 GB ocupado, 110 GB livre (95% livre)
- **Bateria:** 82%, status NOT_CHARGING (proteção de bateria Samsung em 80-82% ativa)
- **Temperatura:** 27,4 °C a 27,5 °C (regime térmico estável, sem throttling)
- **Uptime:** ~1 hora desde o último reboot planeado (load avg: 11.08 em núcleos Exynos 850)

---

## 3. Estado de Serviços e Supervisão Runit
- **sshd:** Ativo (PID 11753), escutando na porta 8022.
- **server-box:** Ativo (PID 16231), escutando na porta 8080.
- **crond:** Ativo (PID 16232), rodando watchdog a cada 5 min.
- **alertas:** Ativo (PID 15959), monitorando via ntfy em canal dedicado.
- **ssh-agent:** Down (não necessário para operação server atual).

---

## 4. Testes de Endpoints
- `http://127.0.0.1:8080/health`: **HTTP 200 OK** (`{"ok":true,"service":"server-box"}`)
- `http://127.0.0.1:8080/api/monitor`: **HTTP 200 OK** (latência ~7ms na LAN)
- Suite de testes `node --test test/*.test.mjs`: **36/36 testes aprovados** (0 falhas)
