import test from "node:test";
import assert from "node:assert/strict";
import { parseTop, parseThermal, processName } from "./adb-coletor.mjs";

// Trechos reais do Galaxy A13 (19/10/2026, 01:50), lidos pelo cabo USB.
const TOP = `Tasks: 550 total,   1 running, 549 sleeping,   0 stopped,   0 zombie
800%cpu  14%user   0%nice  24%sys 759%idle   0%iow   0%irq   3%sirq   0%host
  PID USER         PR  NI VIRT  RES  SHR S[%CPU] %MEM     TIME+ ARGS
 1027 system       18  -2 2.4G 340M 174M S 99.0   9.1   1:32.64 system_server
Tasks: 550 total,   1 running, 549 sleeping,   0 stopped,   0 zombie
  Mem:  3795712K total,  3102356K used,   693356K free,     5516K buffers
800%cpu   6%user   0%nice  12%sys 782%idle   0%iow   0%irq   0%sirq   0%host
  PID USER         PR  NI VIRT  RES  SHR S[%CPU] %MEM     TIME+ ARGS
 8140 shell        20   0  11M 3.1M 1.9M R 14.0   0.0   0:00.30 top -b -n 2 -d 1 -m 12
  266 root         20   0    0    0    0 I  4.0   0.0   0:03.63 [kworker/u16:5-five_hook_wq]
 1027 system       18  -2 2.4G 340M 174M S  1.0   9.1   1:32.64 system_server
 7652 u0_a271      20   0 188M  43M  23M S  2.5   1.1   0:03.91 node /data/data/com.termux/files/home/servidor/panel/server-box/server.js --token-secreto
 7660 u0_a271      20   0 187M  41M  22M S  0.0   1.1   0:02.94 node /data/data/com.termux/files/home/servidor/panel/server-box/alerts.mjs`;

const THERMAL = `IsStatusOverride: false
Thermal Status: 0
Cached temperatures:
	Temperature{mValue=33.6, mType=0, mName=AP, mStatus=0}
Current temperatures from HAL:
	Temperature{mValue=28.3, mType=0, mName=AP, mStatus=0}
	Temperature{mValue=27.2, mType=2, mName=BAT, mStatus=0}
	Temperature{mValue=28.1, mType=5, mName=PA, mStatus=0}
	Temperature{mValue=29.3, mType=3, mName=SKIN, mStatus=0}
	Temperature{mValue=0.0, mType=2, mName=SUBBAT, mStatus=0}
	Temperature{mValue=0.0, mType=4, mName=USB, mStatus=0}
	Temperature{mValue=NaN, mType=1, mName=GPU, mStatus=0}
Current cooling devices from HAL:`;

test("top: usa o ÚLTIMO quadro (o primeiro mede desde o boot) e normaliza por núcleo", () => {
  const t = parseTop(TOP);
  assert.equal(t.cpuPct, 2.3, "(800 - 782) / 800 = 2,25% → 2,3");
  assert.deepEqual(t.topApps.map(a => a.name), ["[kworker/u16:5-five_hook_wq]", "node server.js", "system_server"]);
  assert.ok(!t.topApps.some(a => a.name === "top"), "o próprio top não conta");
  assert.ok(!t.topApps.some(a => a.cpuPct === 0), "processo parado não entra");
  assert.deepEqual(parseTop(""), { cpuPct: null, topApps: [] });
});

test("nome do processo: nunca leva argumentos (podem conter texto de tarefas ou segredos)", () => {
  assert.equal(processName("node /data/x/server.js --token-secreto abc"), "node server.js");
  assert.equal(processName("/system/bin/surfaceflinger --x"), "surfaceflinger");
  assert.equal(processName("[kworker/u16:5]"), "[kworker/u16:5]");
  assert.equal(processName("com.android.systemui"), "com.android.systemui");
  assert.equal(processName(""), null);
  const t = parseTop(TOP);
  assert.ok(!JSON.stringify(t).includes("token-secreto"));
});

test("thermal: só o bloco atual do HAL, maior valor por tipo, sem sensor ausente (0,0) nem NaN", () => {
  assert.deepEqual(parseThermal(THERMAL), { cpu: 28.3, battery: 27.2, skin: 29.3 });
  assert.deepEqual(parseThermal("sem nada"), {});
});
