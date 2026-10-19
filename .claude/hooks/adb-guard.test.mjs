// node --test .claude/hooks/adb-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('./adb-guard.mjs', import.meta.url));
const roda = cmd => spawnSync('node', [guard], { input: JSON.stringify({ tool_input: { command: cmd } }) }).status;

test('deixa passar leitura e instalação', () => {
  for (const c of ['adb devices', 'adb -s X shell getprop ro.product.model', 'adb -s X install app.apk',
    'adb shell settings put global stay_on_while_plugged_in 0', 'adb shell "logcat -d | grep -i reboot"',
    'adb shell pm list packages', 'git status', 'echo reboot']) assert.equal(roda(c), 0, c);
});

test('bloqueia destrutivos', () => {
  for (const c of ['adb shell pm uninstall --user 0 com.x', 'adb reboot', 'adb -s X shell reboot',
    '& $adb -s $s shell svc power reboot', 'adb shell cmd package compile -m speed -f com.android.systemui',
    'adb shell wm density 280', 'adb uninstall com.x', 'adb shell pm disable-user --user 0 com.x',
    'adb shell rm -rf /sdcard/Download', 'adb shell settings put global policy_control immersive.full=*',
    'fastboot flash boot x.img', 'adb.exe shell pm clear com.termux']) assert.equal(roda(c), 2, c);
});

test('OK do Ryan libera e entrada inválida falha aberta', () => {
  assert.equal(roda('adb reboot # OK-RYAN: teste autorizado'), 0);
  assert.equal(spawnSync('node', [guard], { input: 'não é json' }).status, 0);
});
