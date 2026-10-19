const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, '..', '..', 'profiles', 'a13.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const targetSerial = profile.serial;
const adbWinget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe', 'scrcpy-win64-v4.1', 'adb.exe');
const adb = fs.existsSync(adbWinget) ? adbWinget : 'adb';
const sshKey = path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh', 'id_ed25519');
const sshTarget = `${profile.network.ssh_user}@${profile.network.ip}`;
const reportsDir = path.join(__dirname, '..', '..', 'reports', '2026-10-18');

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function adbExec(cmd) {
  try {
    return execSync(`"${adb}" -s ${targetSerial} ${cmd}`).toString();
  } catch (e) {
    return e.stdout ? e.stdout.toString() : e.message;
  }
}

function sshExec(cmd) {
  try {
    return execSync(`ssh -p 8022 -i "${sshKey}" -o BatchMode=yes -o ConnectTimeout=5 ${sshTarget} "${cmd}"`).toString();
  } catch (e) {
    return e.stdout ? e.stdout.toString() : e.message;
  }
}

console.log('=== COLETANDO ESTADO DE PRODUÇÃO DO A13 VIA SSH E ADB ===');

// 1. Services
const servicesStatus = sshExec('sv status /data/data/com.termux/files/usr/var/service/* 2>&1; echo "--- CRONTAB ---"; crontab -l 2>&1; echo "--- PROCESSOS ---"; ps -ef');
fs.writeFileSync(path.join(reportsDir, 'services.txt'), servicesStatus, 'utf8');

// 2. Network
const networkStatus = sshExec('ip addr; echo "--- ROUTES ---"; ip route; echo "--- LISTENING SOCKETS ---"; ss -tulpn 2>&1 || netstat -tulpn 2>&1');
fs.writeFileSync(path.join(reportsDir, 'network.txt'), networkStatus, 'utf8');

// 3. Runtimes & Git on A13
const runtimesStatus = sshExec('node -v; npm -v; python3 -v 2>&1 | head -n 1; git --version; ssh -V 2>&1; echo "--- GIT REPO A13 ---"; cd ~/servidor/panel/server-box 2>&1 && git status && git log -n 3 --oneline');

// 4. Panel Endpoints
const healthRes = sshExec('curl -s -i http://127.0.0.1:8080/health');
const monitorRes = sshExec('curl -s -i http://127.0.0.1:8080/api/monitor');

// 5. Battery and thermal via ADB
const batThermal = adbExec('shell dumpsys battery; echo "--- THERMAL ---"; dumpsys thermalservice');

console.log('--- RESUMO DE SERVIÇOS ---');
console.log(servicesStatus.slice(0, 500));
console.log('--- REDE E ESCUTA ---');
console.log(networkStatus.slice(0, 500));
console.log('--- RUNTIMES ---');
console.log(runtimesStatus);
console.log('--- /health ---');
console.log(healthRes);
console.log('--- /api/monitor (primeiras linhas) ---');
console.log(monitorRes.slice(0, 300));
