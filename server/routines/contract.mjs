// Contrato oficial de rotinas do OMNISERVER (§5.2).
// Toda rotina integrada ou de extensão deve aderir a este contrato.

export const REQUIRED_CONTRACT_FIELDS = [
  'id',
  'name',
  'version',
  'owner',
  'type',
  'trigger',
  'minIntervalMs',
  'maxIntervalMs',
  'timeoutMs',
  'maxRetries',
  'privilege',
  'idempotent',
  'action'
];

/**
 * Valida se uma rotina satisfaz integralmente o contrato do §5.2.
 * @param {object} routine 
 * @returns {string|null} Erro de validação ou null se válido.
 */
export function validateRoutineContract(routine) {
  if (!routine || typeof routine !== 'object') return 'rotina deve ser um objeto';

  for (const field of REQUIRED_CONTRACT_FIELDS) {
    if (routine[field] === undefined || routine[field] === null) {
      return `campo obrigatorio ausente: ${field}`;
    }
  }

  if (typeof routine.id !== 'string' || !/^[a-z0-9_-]+$/.test(routine.id)) {
    return 'id deve ser string alfanumerica com hifens/underscores';
  }

  if (typeof routine.name !== 'string' || !routine.name.trim()) {
    return 'name deve ser string nao vazia';
  }

  if (typeof routine.version !== 'string' || !/^\d+\.\d+\.\d+/.test(routine.version)) {
    return 'version deve seguir semver (ex: 1.0.0)';
  }

  if (routine.type !== 'read_only' && routine.type !== 'action') {
    return 'type deve ser "read_only" ou "action"';
  }

  if (!['interval', 'manual', 'condition'].includes(routine.trigger)) {
    return 'trigger deve ser "interval", "manual" ou "condition"';
  }

  if (!Number.isInteger(routine.minIntervalMs) || routine.minIntervalMs < 0) {
    return 'minIntervalMs deve ser inteiro >= 0';
  }

  if (!Number.isInteger(routine.maxIntervalMs) || routine.maxIntervalMs < routine.minIntervalMs) {
    return 'maxIntervalMs deve ser inteiro >= minIntervalMs';
  }

  if (!Number.isInteger(routine.timeoutMs) || routine.timeoutMs <= 0) {
    return 'timeoutMs deve ser inteiro > 0';
  }

  if (!Number.isInteger(routine.maxRetries) || routine.maxRetries < 0) {
    return 'maxRetries deve ser inteiro >= 0';
  }

  if (typeof routine.privilege !== 'string') {
    return 'privilege deve ser string (ex: user)';
  }

  if (typeof routine.idempotent !== 'boolean') {
    return 'idempotent deve ser booleano';
  }

  if (typeof routine.action !== 'function') {
    return 'action deve ser uma funcao executavel';
  }

  return null;
}
