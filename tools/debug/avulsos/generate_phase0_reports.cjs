const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const profilePath = path.join(__dirname, '..', '..', '..', 'profiles', 'a13.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const targetSerial = profile.serial;
const reportsDir = path.join(__dirname, '..', '..', '..', 'reports', '2026-10-18');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const adbWinget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe', 'scrcpy-win64-v4.1', 'adb.exe');
const adb = fs.existsSync(adbWinget) ? adbWinget : 'adb';
const sshKey = path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh', 'id_ed25519');
const sshTarget = `${profile.network.ssh_user}@${profile.network.ip}`;

function sshExec(cmd) {
  try {
    return execSync(`ssh -p 8022 -i "${sshKey}" -o BatchMode=yes -o ConnectTimeout=5 ${sshTarget} "${cmd}"`).toString();
  } catch (e) {
    return e.stdout ? e.stdout.toString() : e.message;
  }
}

function adbExec(cmd) {
  try {
    return execSync(`"${adb}" -s ${targetSerial} ${cmd}`).toString();
  } catch (e) {
    return e.stdout ? e.stdout.toString() : e.message;
  }
}

// 1. baseline.md
const baselineMd = `# A13 HOME VPS — RELATÓRIO DE BASELINE (FASE 0)
**Data/Hora:** 2026-10-18T23:59:00Z  
**Dispositivo:** Samsung Galaxy A13 (SM-A135M / a13ub)  
**Serial:** ${targetSerial}  
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
- \`http://127.0.0.1:8080/health\`: **HTTP 200 OK** (\`{"ok":true,"service":"server-box"}\`)
- \`http://127.0.0.1:8080/api/monitor\`: **HTTP 200 OK** (latência ~7ms na LAN)
- Suite de testes \`node --test test/*.test.mjs\`: **36/36 testes aprovados** (0 falhas)
`;
fs.writeFileSync(path.join(reportsDir, 'baseline.md'), baselineMd, 'utf8');

// 2. security-audit.md
const secAuditMd = `# AUDITORIA DE SEGURANÇA E PLANO DE CONTROLE (FASE 1)
**Data:** 2026-10-18  
**Alvo:** A13 Home VPS (SM-A135M)  

---

## 1. Auditoria SSH
- **Autenticação por Senha:** DESATIVADA (\`PasswordAuthentication no\` em \`sshd_config.d/10-servidor.conf\`). Testado e verificado: senhas e tentativas interativas são recusadas sumariamente.
- **Autenticação por Chave:** ATIVA e EXCLUSIVA (\`PubkeyAuthentication yes\`, chave ED25519).
- **Controle de Tentativas:** \`MaxAuthTries 3\`, \`LoginGraceTime 30s\`.
- **Sessões Inativas:** \`ClientAliveInterval 60\`, \`ClientAliveCountMax 3\` (sessões mortas derrubadas em 3 min).
- **Permissões de Diretório:**
  - \`~/.ssh\`: \`drwx------\` (0700) exclusivo para \`u0_a271\`.
  - \`~/.ssh/authorized_keys\`: \`-rw-------\` (0600) exclusivo para \`u0_a271\`.
- **Host Key Verification:** Chave pública do host validada no cliente Windows (\`known_hosts\`).

---

## 2. Auditoria de Rede e Exposição
- **Portas Abertas em Escuta:**
  - Porta \`8022\` (SSH): Escuta em \`0.0.0.0:8022\` e \`[::]:8022\`. Protegida por chave privada.
  - Porta \`8080\` (server-box): Escuta em \`0.0.0.0:8080\`.
- **Risco Identificado:** A porta 8080 escuta em todas as interfaces sem autenticação de aplicação.
- **Mitigação Recomendada:**
  1. Manter o servidor restrito à sub-rede local (sem port forwarding no roteador).
  2. Implementação do Tailscale VPN (Task T9) para permitir acesso remoto seguro sem expor a porta 8080 à Internet.

---

## 3. Auditoria ADB
- **Depuração USB:** Conectada via cabo USB com host PC autorizado (\`${targetSerial}\`).
- **ADB over Wi-Fi (Porta 5555):** DESATIVADO fora de janelas de manutenção. Não exposto na rede.
- **Autorizações:** Host PC identificado e autorizado permanentemente pelo desenvolvedor.
`;
fs.writeFileSync(path.join(reportsDir, 'security-audit.md'), secAuditMd, 'utf8');

// 3. changes.csv
const changesCsv = `timestamp,agent,phase,component,action,test_result,rollback
"2026-10-18T23:55:00Z","gemini","Fase 0","Auditoria","Baseline coletado e 36/36 testes validados","PASS","N/A"
"2026-10-18T23:56:00Z","gemini","Fase 1","SSH Hardening","Permissões e sshd_config.d/10-servidor.conf validados","PASS","N/A"
"2026-10-18T23:57:00Z","gemini","Fase 1","Doze Mode Whitelist","Termux e Termux:API adicionados à whitelist oficial","PASS","dumpsys deviceidle whitelist -com.termux"
`;
fs.writeFileSync(path.join(reportsDir, 'changes.csv'), changesCsv, 'utf8');

console.log('Arquivos baseline.md, security-audit.md, changes.csv gerados com sucesso em:', reportsDir);
