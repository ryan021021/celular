// node --test .claude/hooks/adb-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('./adb-guard.mjs', import.meta.url));
const TIMEOUT = 15000; // sem timeout um hook travado deixaria a regressão pendurada
const rodaCom = entrada => spawnSync('node', [guard], { input: entrada, encoding: 'utf8', timeout: TIMEOUT });
const rodaCmd = cmd => rodaCom(JSON.stringify({ tool_input: { command: cmd } }));
const roda = cmd => rodaCmd(cmd).status;

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

test('Q10: bloqueia scripts que mudam o aparelho só quando executados', () => {
  for (const c of ['powershell -NoProfile -File tools\\debug\\aplicar_tweaks_ocultos.ps1',
    '& .\\tools\\debug\\reativar_apps_essenciais.ps1 -Device a15', 'tools/rescue/desenhar_padrao.bat',
    'cd x; ./tools/debug/aplicar_tweaks_ocultos.ps1']) assert.equal(roda(c), 2, c);
  for (const c of ['git add tools/debug/aplicar_tweaks_ocultos.ps1', 'grep -n Serial tools/debug/reativar_apps_essenciais.ps1',
    'git log -- tools/rescue/desenhar_padrao.bat']) assert.equal(roda(c), 0, c);
});

test('OK do Ryan libera e entrada inválida falha aberta', () => {
  assert.equal(roda('adb reboot # OK-RYAN: teste autorizado'), 0);
  assert.equal(rodaCom('não é json').status, 0);
});

// Um caso por entrada de `perigos` (mata: sumir wipe/factory, hide|suspend, ou estreitar o rm -rf).
const PERIGOS = [
  ['adb shell pm uninstall --user 0 com.x', /pacote/],
  ['adb shell pm clear com.x', /pacote/],
  ['adb shell pm disable com.x', /pacote/],
  ['adb shell pm disable-user --user 0 com.x', /pacote/],
  ['adb shell pm hide com.x', /pacote/],
  ['adb shell pm suspend com.x', /pacote/],
  ['adb uninstall com.x', /desinstalar/],
  ['adb reboot', /reiniciar/],
  ['adb -s X reboot bootloader', /reiniciar/],
  ['adb -s X shell reboot', /reiniciar/],
  ['adb shell svc power reboot', /reiniciar/],
  ['fastboot devices', /fastboot/],
  ['adb shell "recovery --wipe_data"', /apagar dados/],
  ['adb shell wipe data', /apagar dados/],
  ['adb shell factory_reset', /apagar dados/],
  ['adb shell cmd package compile -m speed -a', /compilar/],
  ['adb shell wm density 280', /tela/],
  ['adb shell wm size 1080x2400', /tela/],
  ['adb shell settings put global policy_control immersive.full=*', /imersivo/],
  ['adb shell rm -rf /sdcard/Download', /apagar arquivos/],
  ['adb shell rm -rf /storage/emulated/0/DCIM', /apagar arquivos/],
  ['adb shell rm -rf /data/local/tmp', /apagar arquivos/],
  ['adb shell rm -fr /sdcard', /apagar arquivos/],
  ['adb shell rm -r /sdcard/x', /apagar arquivos/],
];

test('cada regra de perigo bloqueia com o motivo certo', () => {
  for (const [c, motivo] of PERIGOS) {
    const r = rodaCmd(c);
    assert.equal(r.status, 2, c);
    assert.match(r.stderr, /BLOQUEADO pelo adb-guard/, c);
    assert.match(r.stderr, motivo, c);
  }
});

test('o mesmo texto fora do adb/fastboot não bloqueia', () => {
  for (const c of ['rm -rf node_modules', 'git commit -m "wipe factory reboot"', 'echo pm uninstall', 'ls /sdcard'])
    assert.equal(roda(c), 0, c);
});

// Um caso por script de `scripts` (os 4) e por extensão.
const SCRIPTS = ['aplicar_tweaks_ocultos', 'reativar_apps_essenciais', 'resgatar_galaxy_a21s', 'desenhar_padrao'];

test('Q10: cada script que muda o aparelho bloqueia (ps1 e bat) com a mensagem própria', () => {
  for (const nome of SCRIPTS) for (const ext of ['ps1', 'bat']) {
    const r = rodaCmd(`powershell -NoProfile -File tools\\debug\\${nome}.${ext}`);
    assert.equal(r.status, 2, `${nome}.${ext}`);
    assert.match(r.stderr, /script que muda o aparelho/, `${nome}.${ext}`);
    assert.equal(roda(`git add tools/debug/${nome}.${ext}`), 0, `${nome}.${ext} só citado`);
    assert.equal(roda(`cat tools/debug/${nome}.${ext}`), 0, `${nome}.${ext} só lido`);
  }
});

test('OK do Ryan libera o script, mas marcador sem motivo e fora de lugar não libera', () => {
  assert.equal(roda('& .\\tools\\debug\\aplicar_tweaks_ocultos.ps1 # OK-RYAN: Ryan autorizou em chat'), 0);
  assert.equal(roda('adb reboot # OK-RYAN:'), 2);
  assert.equal(roda('adb reboot # OK-RYAN:   '), 2);
  assert.equal(roda('adb reboot # ok ryan'), 2);
});

test('entrada vazia, sem comando ou com tool_input ausente falha aberta (exit 0)', () => {
  for (const e of ['', '{}', '{"tool_input":{}}', '{"tool_input":{"command":null}}']) assert.equal(rodaCom(e).status, 0, e);
});
