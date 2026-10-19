import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarCapacidades, perfilCompatibilidade, compararPerfil, montarRelatorio, coletarSsh, classificarMudancas, codigoSaida, UNKNOWN, UNSUPPORTED_HERE } from '../detect.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const fixture = n => readFileSync(join(aqui, '..', 'fixtures', n), 'utf8');
const porId = (caps, id) => caps.find(c => c.capability_id === id);

test('A15 Termux: RAM física só de MemTotal, swap separado, arquitetura kernel e userspace', () => {
  const caps = montarCapacidades({ saida: fixture('termux-a15.txt'), plataforma: 'android' });
  assert.equal(porId(caps, 'memory.ram_physical_mb').value, 3716);
  assert.equal(porId(caps, 'memory.swap_mb').value, 2048);
  assert.equal(porId(caps, 'cpu.arch_kernel').value, 'aarch64');
  assert.equal(porId(caps, 'cpu.arch_userspace').value, 'arm64-v8a');
  assert.equal(porId(caps, 'env.termux').value, true);
  assert.equal(porId(caps, 'privilege.root').value, false);
  for (const c of caps) assert.ok(c.source && c.confidence, `${c.capability_id} sem fonte/confiança`);
});

test('campo faltando vira UNKNOWN, nunca false nem número inventado', () => {
  const caps = montarCapacidades({ saida: fixture('termux-campo-faltando.txt'), plataforma: 'android' });
  const ram = porId(caps, 'memory.ram_physical_mb');
  assert.equal(ram.value, UNKNOWN);
  assert.equal(ram.status, 'unknown');
  assert.equal(porId(caps, 'cpu.arch_kernel').status, 'unknown');
  assert.equal(porId(caps, 'memory.available_mb').value, 1488);
});

test('saída malformada não vira valor: cores e RAM ficam UNKNOWN', () => {
  const caps = montarCapacidades({ saida: fixture('termux-malformado.txt'), plataforma: 'android' });
  assert.equal(porId(caps, 'cpu.cores').value, UNKNOWN);
  assert.equal(porId(caps, 'memory.ram_physical_mb').value, UNKNOWN);
  assert.equal(porId(caps, 'storage.home_free_mb').value, UNKNOWN);
});

test('PC Windows sem sh: capacidades vêm da API do OS e shell fica UNSUPPORTED_HERE', () => {
  const osApi = { plataforma: 'win32', arch: 'x64', memTotalBytes: 16 * 1073741824, memLivreBytes: 8 * 1073741824 };
  const caps = montarCapacidades({ saida: '', plataforma: 'win32', osApi, erroShell: 'comando não encontrado' });
  assert.equal(porId(caps, 'memory.ram_physical_mb').value, 16384);
  assert.equal(porId(caps, 'shell.posix').value, UNSUPPORTED_HERE);
  assert.equal(porId(caps, 'shell.posix').last_error, 'comando não encontrado');
  assert.equal(perfilCompatibilidade(caps).perfil, 'desktop-development');
});

test('timeout/permissão negada: nenhum dado inventado, erro registrado', () => {
  const caps = montarCapacidades({ saida: '', plataforma: 'android', erroShell: 'timeout' });
  assert.equal(porId(caps, 'shell.posix').last_error, 'timeout');
  assert.equal(porId(caps, 'memory.ram_physical_mb').value, UNKNOWN);
});

test('perfil de compatibilidade do A15 é android-termux-constrained; não usa preset se contradito', () => {
  const caps = montarCapacidades({ saida: fixture('termux-a15.txt'), plataforma: 'android' });
  assert.equal(perfilCompatibilidade(caps).perfil, 'android-termux-constrained');
  const semRoot = montarCapacidades({ saida: fixture('termux-malformado.txt'), plataforma: 'android' });
  assert.notEqual(perfilCompatibilidade(semRoot).perfil, 'android-termux-constrained');
});

test('comparar com profiles/a15.json: arquitetura e RAM física batem', () => {
  const rel = montarRelatorio({ alvo: 'a15', caps: montarCapacidades({ saida: fixture('termux-a15.txt'), plataforma: 'android' }) });
  const perfil = { hardware: { architecture: 'arm64-v8a (64-bit nativo)', ram_total: '4 GB (3.63 GB física)' } };
  const c = compararPerfil(rel, perfil);
  assert.equal(c.ok, true, JSON.stringify(c.achados));
});

test('SSH: executor injetado, sem StrictHostKeyChecking=no e com perfil incompleto recusado', async () => {
  let args = null;
  const exec = async (cmd, a, entrada) => { args = a; assert.match(entrada, /uname -m/); return { ok: true, saida: fixture('termux-a15.txt') }; };
  const rel = await coletarSsh({ id: 'a15', network: { ip: '192.168.1.164', ssh_port: 8022, ssh_user: 'u0_a304', ssh_key: '~/.ssh/id_ed25519' } }, { executor: exec });
  assert.ok(args.includes('StrictHostKeyChecking=accept-new'));
  assert.ok(!args.join(' ').includes('StrictHostKeyChecking=no'));
  assert.equal(porId(rel.capacidades, 'memory.ram_physical_mb').value, 3716);
  await assert.rejects(coletarSsh({ id: 'x', network: {} }, { executor: exec }));
});

test('lista de serviços runit separa por espaço (não por letra)', () => {
  const caps = montarCapacidades({ saida: fixture('termux-a15.txt'), plataforma: 'android' });
  assert.deepEqual(porId(caps, 'services.runit').value, ['agentops', 'alertas', 'egress', 'server-box', 'sftp', 'sshd', 'crond']);
});

test('uid ausente ou inválido não vira privilégio false', () => {
  const saida = fixture('termux-a15.txt').replace('@uid=10304', '@uid=');
  const caps = montarCapacidades({ saida, plataforma: 'android' });
  assert.equal(porId(caps, 'privilege.root').value, UNKNOWN);
  assert.equal(porId(caps, 'privilege.root').status, 'unknown');
});

test('sem PREFIX, env.termux fica UNKNOWN e os serviços runit também', () => {
  const saida = fixture('termux-a15.txt').replace('@prefix=/data/data/com.termux/files/usr', '@prefix=').replace(/@servicos=.*/, '@servicos=');
  const caps = montarCapacidades({ saida, plataforma: 'android' });
  assert.equal(porId(caps, 'env.termux').value, UNKNOWN);
  assert.equal(porId(caps, 'services.runit').value, UNKNOWN);
});

// ----- T61 (§3.5): comparação entre dois snapshots -----
const snapA = () => montarRelatorio({ alvo: 'a15', caps: montarCapacidades({ saida: fixture('termux-a15.txt'), plataforma: 'android' }) });
const copia = o => JSON.parse(JSON.stringify(o));
const mudar = (rel, id, valor, status = 'available') => {
  const c = rel.capacidades.find(x => x.capability_id === id);
  c.value = valor; c.status = status; return rel;
};
const DETECT = join(aqui, '..', 'detect.mjs');

test('dois snapshots iguais: nenhuma mudança, código 0', () => {
  const a = snapA();
  const c = classificarMudancas(copia(a), copia(a));
  assert.equal(c.pior, 'nenhuma');
  assert.deepEqual(c.mudancas, []);
  assert.equal(codigoSaida(c.pior), 0);
});

test('mudança normal (RAM disponível, bateria) é informativa e não bloqueia', () => {
  const a = snapA();
  const b = mudar(mudar(copia(a), 'memory.available_mb', 600), 'power.battery_pct', 40);
  const c = classificarMudancas(a, b);
  assert.equal(c.pior, 'informativo');
  assert.ok(c.mudancas.some(m => m.capability_id === 'memory.available_mb' && m.tipo === 'informativo'));
  assert.equal(codigoSaida(c.pior), 0);
});

test('arquitetura trocada é quebra (código 4)', () => {
  const a = snapA();
  const b = mudar(copia(a), 'cpu.arch_kernel', 'x86_64');
  const c = classificarMudancas(a, b);
  assert.equal(c.pior, 'quebra');
  assert.equal(c.mudancas[0].capability_id, 'cpu.arch_kernel');
  assert.equal(codigoSaida(c.pior), 4);
});

test('Termux deixou de ser o ambiente é quebra', () => {
  const a = snapA();
  const c = classificarMudancas(a, mudar(copia(a), 'env.termux', false));
  assert.equal(c.pior, 'quebra');
});

test('Node sumido é quebra; versão de Node trocada é aviso', () => {
  const a = snapA();
  assert.equal(classificarMudancas(a, mudar(copia(a), 'runtime.node', UNKNOWN, 'unknown')).pior, 'quebra');
  const c = classificarMudancas(a, mudar(copia(a), 'runtime.node', 'v27.0.0'));
  assert.equal(c.pior, 'aviso');
  assert.equal(codigoSaida(c.pior), 2);
});

test('serviço sumindo do runit é aviso e cita o nome', () => {
  const a = snapA();
  const sem = porId(a.capacidades, 'services.runit').value.filter(s => s !== 'sshd');
  const c = classificarMudancas(a, mudar(copia(a), 'services.runit', sem));
  assert.equal(c.pior, 'aviso');
  assert.match(c.mudancas[0].motivo, /sshd/);
});

test('espaço livre abaixo de 1 GB é aviso; acima continua informativo ou nada', () => {
  const a = snapA();
  assert.equal(classificarMudancas(a, mudar(copia(a), 'storage.home_free_mb', 800)).pior, 'aviso');
  const ok = classificarMudancas(a, mudar(copia(a), 'storage.home_free_mb', 2000));
  assert.notEqual(ok.pior, 'aviso');
  assert.notEqual(ok.pior, 'quebra');
});

test('perfil de compatibilidade mudando é aviso', () => {
  const a = snapA();
  const b = copia(a);
  b.compatibilidade = { ...b.compatibilidade, perfil: 'linux-minimal' };
  assert.equal(classificarMudancas(a, b).pior, 'aviso');
});

test('CLI com um snapshot salvo em arquivo: arquitetura diferente sai com código 4', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  const arq = join(dir, 'ultimo.json');
  writeFileSync(arq, JSON.stringify(snapA()));
  const r = spawnSync(process.execPath, [DETECT, '--comparar', arq], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 4, r.stderr);
  assert.match(r.stdout, /"pior": "quebra"/);
});

test('aparelho sem resposta por SSH: erro claro, sem relatório vazio', async () => {
  const exec = async () => ({ ok: false, erro: 'saída 255' });
  await assert.rejects(coletarSsh({ id: 'a15', network: { ip: '192.168.1.164', ssh_port: 8022, ssh_user: 'u0_a304', ssh_key: '~/.ssh/id_ed25519' } }, { executor: exec }), /não respondeu/);
});
