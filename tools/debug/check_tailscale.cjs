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

console.log('--- VERIFICANDO TAILSCALE NO ANDROID ---');
console.log('Tailscale App Android (pm list):', adbExec('shell pm list packages | grep tailscale'));

console.log('--- VERIFICANDO TAILSCALE NO TERMUX ---');
console.log('which tailscale:', sshExec('which tailscale 2>&1'));
console.log('pkg search tailscale:', sshExec('pkg search tailscale 2>&1'));
