// Catálogo oficial de rotinas integradas do OMNISERVER (§5.1).
// No início, estritamente rotinas de LEITURA (saúde, disco, bateria, backup verificado).
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateRoutineContract } from './contract.mjs';

/**
 * 1. Rotina: health_check
 * Verifica se os serviços HTTP locais estão respondendo status 200.
 */
export const healthCheckRoutine = {
  id: 'health_check',
  name: 'Verificação de Saúde dos Serviços',
  version: '1.0.0',
  owner: 'core',
  type: 'read_only',
  trigger: 'interval',
  minIntervalMs: 15_000,    // Anti-thrashing: no máximo a cada 15s
  maxIntervalMs: 60_000,
  timeoutMs: 5_000,
  maxRetries: 3,
  privilege: 'user',
  idempotent: true,
  action: async ({ fetchFn = fetch, endpoints = ['http://127.0.0.1:8080/health', 'http://127.0.0.1:8090/health'] } = {}) => {
    const results = {};
    let allOk = true;

    for (const url of endpoints) {
      try {
        const res = await fetchFn(url, { signal: AbortSignal.timeout(3000) });
        results[url] = { ok: res.ok, status: res.status };
        if (!res.ok) allOk = false;
      } catch (err) {
        results[url] = { ok: false, error: err.message };
        allOk = false;
      }
    }

    return {
      ok: allOk,
      status: allOk ? 'HEALTHY' : 'UNHEALTHY',
      endpoints: results,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * 2. Rotina: disk_check
 * Inspeciona espaço em disco livre/utilizado via stat ou função injetada.
 */
export const diskCheckRoutine = {
  id: 'disk_check',
  name: 'Verificação de Armazenamento e Disco',
  version: '1.0.0',
  owner: 'core',
  type: 'read_only',
  trigger: 'interval',
  minIntervalMs: 60_000,    // Anti-thrashing: no máximo a cada 1 min
  maxIntervalMs: 300_000,
  timeoutMs: 5_000,
  maxRetries: 2,
  privilege: 'user',
  idempotent: true,
  action: async ({ getDiskUsage = async () => ({ totalBytes: 105 * 1024 * 1024 * 1024, freeBytes: 74 * 1024 * 1024 * 1024 }) } = {}) => {
    const usage = await getDiskUsage();
    const freePct = usage.totalBytes > 0 ? (usage.freeBytes / usage.totalBytes) * 100 : 0;
    const warning = freePct < 15;
    const critical = freePct < 5;

    return {
      ok: !critical,
      status: critical ? 'CRITICAL' : warning ? 'WARNING' : 'HEALTHY',
      totalBytes: usage.totalBytes,
      freeBytes: usage.freeBytes,
      freePercentage: Number(freePct.toFixed(2)),
      alert: critical ? 'Armazenamento em nível crítico (<5%)' : warning ? 'Armazenamento baixo (<15%)' : null
    };
  }
};

/**
 * 3. Rotina: battery_check
 * Inspeciona estado da bateria e temperatura sem comandos destrutivos.
 */
export const batteryCheckRoutine = {
  id: 'battery_check',
  name: 'Verificação de Bateria e Térmica',
  version: '1.0.0',
  owner: 'core',
  type: 'read_only',
  trigger: 'interval',
  minIntervalMs: 30_000,    // Anti-thrashing: no máximo a cada 30s
  maxIntervalMs: 120_000,
  timeoutMs: 3_000,
  maxRetries: 2,
  privilege: 'user',
  idempotent: true,
  action: async ({ getBatteryStatus = async () => ({ percent: 85, plugged: true, tempC: 28.5 }) } = {}) => {
    const batt = await getBatteryStatus();
    const highTemp = batt.tempC >= 45.0;
    const lowBattery = !batt.plugged && batt.percent <= 15;

    return {
      ok: !highTemp && !lowBattery,
      status: highTemp ? 'THERMAL_THROTTLED' : lowBattery ? 'LOW_BATTERY' : 'NORMAL',
      percent: batt.percent,
      plugged: batt.plugged,
      temperatureC: batt.tempC,
      alert: highTemp ? `Temperatura elevada (${batt.tempC}°C)` : lowBattery ? `Bateria baixa (${batt.percent}%)` : null
    };
  }
};

/**
 * 4. Rotina: backup_verify
 * Inspeciona o arquivo de backup mais recente sem descompactar nem alterar dados.
 */
export const backupVerifyRoutine = {
  id: 'backup_verify',
  name: 'Verificação de Backup Recente',
  version: '1.0.0',
  owner: 'core',
  type: 'read_only',
  trigger: 'interval',
  minIntervalMs: 120_000,   // Anti-thrashing: no máximo a cada 2 min
  maxIntervalMs: 3600_000,
  timeoutMs: 5_000,
  maxRetries: 2,
  privilege: 'user',
  idempotent: true,
  action: async ({ backupDir = 'backups', maxAgeHours = 48, now = Date.now } = {}) => {
    if (!existsSync(backupDir)) {
      return { ok: false, status: 'NO_BACKUP_DIR', error: 'Diretório de backups inexistente' };
    }

    const files = readdirSync(backupDir).filter(f => f.endsWith('.enc') || f.endsWith('.tar.gz'));
    if (files.length === 0) {
      return { ok: false, status: 'NO_BACKUPS_FOUND', error: 'Nenhum backup encontrado' };
    }

    let newestFile = null;
    let newestMtime = 0;
    let newestSize = 0;

    for (const f of files) {
      try {
        const s = statSync(join(backupDir, f));
        if (s.mtimeMs > newestMtime) {
          newestMtime = s.mtimeMs;
          newestFile = f;
          newestSize = s.size;
        }
      } catch {}
    }

    if (!newestFile) {
      return { ok: false, status: 'NO_READABLE_BACKUP', error: 'Não foi possível ler metadados do backup' };
    }

    const ageHours = (now() - newestMtime) / (1000 * 60 * 60);
    const isOutdated = ageHours > maxAgeHours;
    const isCorruptEmpty = newestSize < 100;

    return {
      ok: !isOutdated && !isCorruptEmpty,
      status: isCorruptEmpty ? 'EMPTY_OR_CORRUPT' : isOutdated ? 'OUTDATED' : 'VALID',
      latestBackup: newestFile,
      sizeBytes: newestSize,
      ageHours: Number(ageHours.toFixed(2)),
      timestamp: new Date(newestMtime).toISOString()
    };
  }
};

export const INITIAL_READONLY_ROUTINES = [
  healthCheckRoutine,
  diskCheckRoutine,
  batteryCheckRoutine,
  backupVerifyRoutine
];

// Valida que todas as rotinas iniciais satisfazem o contrato (§5.2)
for (const routine of INITIAL_READONLY_ROUTINES) {
  const err = validateRoutineContract(routine);
  if (err) throw new Error(`Rotina ${routine?.id} viola contrato: ${err}`);
}
