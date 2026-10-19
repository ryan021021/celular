// Descoberta de capacidades (OMNISERVER §3). Só comandos de leitura.
// Uso:
//   node server/discovery/detect.mjs                       -> este computador
//   node server/discovery/detect.mjs --perfil a15          -> celular por SSH (usa profiles/a15.json)
//   node server/discovery/detect.mjs --perfil a15 --comparar -> confere com o perfil do aparelho
// Regras: nada é inventado. Sem dado -> status "unknown", value "UNKNOWN". Não suportado aqui -> "UNSUPPORTED_HERE".
// A saída do aparelho é dado não confiável: só vira número/texto depois de validada.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

export const UNKNOWN = 'UNKNOWN';
export const UNSUPPORTED_HERE = 'UNSUPPORTED_HERE';

// Script só de leitura, enviado por stdin (sh -s). Cada linha "@chave=valor"; blocos entre @inicio/@fim.
export const SCRIPT_LEITURA = `
echo "@uname_m=$(uname -m 2>/dev/null)"
echo "@uname_s=$(uname -s 2>/dev/null)"
echo "@uname_r=$(uname -r 2>/dev/null)"
echo "@abi=$(getprop ro.product.cpu.abi 2>/dev/null)"
echo "@prefix=$PREFIX"
echo "@uid=$(id -u 2>/dev/null)"
echo "@node=$(node --version 2>/dev/null)"
echo "@cores=$(nproc 2>/dev/null)"
echo "@home_df=$(df -Pk "$HOME" 2>/dev/null | tail -n 1)"
echo "@servicos=$(ls "$PREFIX/var/service" 2>/dev/null | tr '\\n' ' ')"
echo "@bateria=$(cat /sys/class/power_supply/battery/capacity 2>/dev/null)"
echo "@ips=$(ip -o -4 addr show 2>/dev/null | awk '{print $2"="$4}' | tr '\\n' ' ')"
echo "@inicio_meminfo"
grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo 2>/dev/null
echo "@fim_meminfo"
`;

const agora = () => new Date().toISOString();

// Converte a saída do SCRIPT_LEITURA em { chave: valor } + meminfo { MemTotal: kB, ... }.
export function lerSaida(texto) {
  const dados = {}, mem = {};
  let emMem = false;
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    if (linha === '@inicio_meminfo') { emMem = true; continue; }
    if (linha === '@fim_meminfo') { emMem = false; continue; }
    if (emMem) {
      const m = linha.match(/^(MemTotal|MemAvailable|SwapTotal|SwapFree):\s+(\d+)\s*kB$/);
      if (m) mem[m[1]] = Number(m[2]);
      continue;
    }
    const m = linha.match(/^@([a-z_]+)=(.*)$/);
    if (m) dados[m[1]] = m[2].trim();
  }
  return { dados, mem };
}

function cap(id, value, status, source, confidence, extra = {}) {
  return {
    capability_id: id, value, status, source, confidence,
    observed_at: extra.observed_at ?? agora(), expires_at: null,
    evidence_summary: extra.evidence ?? '', constraints: extra.constraints ?? [],
    required_permissions: extra.perms ?? [], last_error: extra.erro ?? null,
  };
}
const faltando = (id, motivo, fonte) => cap(id, UNKNOWN, 'unknown', fonte, 'low', { erro: motivo, evidence: motivo });

// Monta as capacidades a partir da saída (remoto/local) e do que o SO informa via API.
export function montarCapacidades({ saida = '', plataforma, osApi = null, erroShell = null }) {
  const { dados, mem } = lerSaida(saida);
  const temShell = !erroShell && saida.length > 0;
  const caps = [];
  const fonteShell = 'comando de leitura (sh)';

  // Identidade e arquitetura
  if (osApi) {
    caps.push(cap('os.family', osApi.plataforma, 'available', 'API do OS (os.platform)', 'high'));
    if (!temShell) caps.push(cap('cpu.arch_kernel', osApi.arch, 'available', 'API do OS (os.arch)', 'high'));
  }
  if (temShell) {
    caps.push(dados.uname_s
      ? cap('os.kernel', `${dados.uname_s} ${dados.uname_r || ''}`.trim(), 'available', fonteShell, 'high', { evidence: 'uname -s/-r' })
      : faltando('os.kernel', 'uname -s vazio', fonteShell));
    if (dados.uname_m) caps.push(cap('cpu.arch_kernel', dados.uname_m, 'available', fonteShell, 'high', { evidence: 'uname -m' }));
    else caps.push(faltando('cpu.arch_kernel', 'uname -m vazio', fonteShell));
    // userspace: ABI do Android (ro.product.cpu.abi) é a arquitetura real do processo quando existe
    if (dados.abi) caps.push(cap('cpu.arch_userspace', dados.abi, 'available', 'getprop ro.product.cpu.abi', 'high'));
    else caps.push(cap('cpu.arch_userspace', UNSUPPORTED_HERE, 'unknown', fonteShell, 'low', { evidence: 'sem getprop (não é Android)' }));
    caps.push(dados.cores && /^\d+$/.test(dados.cores)
      ? cap('cpu.cores', Number(dados.cores), 'available', 'nproc', 'high')
      : faltando('cpu.cores', 'nproc ausente ou inválido', fonteShell));
    // sem uid válido não dá para saber se é root: nunca false por ausência
    caps.push(/^\d+$/.test(dados.uid || '')
      ? cap('privilege.root', dados.uid === '0', 'available', 'id -u', 'high', { evidence: `uid=${dados.uid}` })
      : faltando('privilege.root', 'id -u sem saída válida', 'id -u'));
    caps.push(dados.node
      ? cap('runtime.node', dados.node, 'available', 'node --version', 'high')
      : cap('runtime.node', UNKNOWN, 'unavailable', fonteShell, 'high', { evidence: 'node não encontrado no PATH' }));
    caps.push(dados.prefix
      ? cap('env.termux', /com\.termux/.test(dados.prefix), 'available', 'variável PREFIX', 'high', { evidence: 'PREFIX definido' })
      : faltando('env.termux', 'PREFIX vazio', 'variável PREFIX'));
    // lista vazia pode ser "sem runit" ou "sem permissão": não dá para afirmar, então fica unknown
    caps.push(dados.servicos
      ? cap('services.runit', dados.servicos.split(/\s+/).filter(Boolean), 'available', 'ls $PREFIX/var/service', 'high')
      : faltando('services.runit', 'ls $PREFIX/var/service sem saída (ausente ou sem permissão)', 'ls $PREFIX/var/service'));
    if (dados.bateria && /^\d+$/.test(dados.bateria)) caps.push(cap('power.battery_pct', Number(dados.bateria), 'available', 'sysfs power_supply', 'medium'));
    else caps.push(cap('power.battery_pct', UNSUPPORTED_HERE, 'unavailable', 'sysfs power_supply', 'low', { evidence: 'sem leitura de bateria' }));
    if (dados.ips) caps.push(cap('network.interfaces', dados.ips.split(/\s+/).filter(Boolean), 'available', 'ip -o -4 addr', 'high', { evidence: 'IPv4 por interface (sem tokens)' }));
    if (dados.home_df) {
      const partes = dados.home_df.split(/\s+/);
      const livreKb = Number(partes[3]);
      caps.push(Number.isFinite(livreKb)
        ? cap('storage.home_free_mb', Math.floor(livreKb / 1024), 'available', 'df -Pk $HOME', 'high')
        : faltando('storage.home_free_mb', 'df sem coluna de espaço livre', 'df -Pk $HOME'));
    } else caps.push(faltando('storage.home_free_mb', 'df sem saída', 'df -Pk $HOME'));
  } else {
    caps.push(cap('shell.posix', UNSUPPORTED_HERE, 'unavailable', 'teste de sh', 'high', { erro: erroShell || 'sem sh no sistema' }));
  }

  // Memória: RAM física só de MemTotal. Swap separado. Nunca somados (§3.2).
  if (mem.MemTotal) {
    caps.push(cap('memory.ram_physical_mb', Math.round(mem.MemTotal / 1024), 'available', '/proc/meminfo MemTotal', 'high', { evidence: 'MemTotal (kB)' }));
  } else if (osApi && osApi.memTotalBytes) {
    caps.push(cap('memory.ram_physical_mb', Math.round(osApi.memTotalBytes / 1048576), 'available', 'API do OS (os.totalmem)', 'high'));
  } else caps.push(faltando('memory.ram_physical_mb', 'MemTotal ausente', '/proc/meminfo'));
  if (mem.MemAvailable) caps.push(cap('memory.available_mb', Math.round(mem.MemAvailable / 1024), 'available', '/proc/meminfo MemAvailable', 'high'));
  else if (osApi && osApi.memLivreBytes) caps.push(cap('memory.available_mb', Math.round(osApi.memLivreBytes / 1048576), 'available', 'API do OS (os.freemem)', 'high'));
  else caps.push(faltando('memory.available_mb', 'MemAvailable ausente', '/proc/meminfo'));
  if (mem.SwapTotal !== undefined) caps.push(cap('memory.swap_mb', Math.round(mem.SwapTotal / 1024), 'available', '/proc/meminfo SwapTotal', 'high', { evidence: 'swap/zRAM separado da RAM física' }));
  else caps.push(faltando('memory.swap_mb', 'SwapTotal ausente', '/proc/meminfo'));

  return caps;
}

// §3.4: perfil de compatibilidade. Preset só quando nada na deteção o contradiz.
export function perfilCompatibilidade(caps) {
  const v = id => caps.find(c => c.capability_id === id)?.value;
  const motivos = [];
  if (v('env.termux') === true && /arm64|aarch64/.test(String(v('cpu.arch_kernel')))) {
    motivos.push('Termux no Android com arquitetura arm64');
    if (v('privilege.root') === false) motivos.push('sem root');
    return { perfil: 'android-termux-constrained', motivos };
  }
  if (v('os.family') === 'win32') { motivos.push('Windows'); return { perfil: 'desktop-development', motivos }; }
  if (v('services.runit') !== UNSUPPORTED_HERE && v('shell.posix') !== UNSUPPORTED_HERE) {
    motivos.push('Linux com runit'); return { perfil: 'linux-server', motivos };
  }
  if (v('shell.posix') !== UNSUPPORTED_HERE) { motivos.push('Linux sem supervisor conhecido'); return { perfil: 'linux-minimal', motivos }; }
  motivos.push('sem dados suficientes'); return { perfil: 'unknown-restricted', motivos };
}

export function montarRelatorio({ alvo, caps }) {
  return { alvo, gerado_em: agora(), schema: 'omniserver.discovery/1', capacidades: caps, compatibilidade: perfilCompatibilidade(caps) };
}

// Compara com profiles/<id>.json (campos que o perfil declara). Não altera nada.
export function compararPerfil(relatorio, perfil) {
  const achados = [];
  const cap = id => relatorio.capacidades.find(c => c.capability_id === id);
  const arch = cap('cpu.arch_kernel')?.value, esperado = String(perfil?.hardware?.architecture || '');
  if (esperado) {
    // aarch64 (kernel) e arm64 (perfil) são a mesma arquitetura
    const norm = x => String(x).toLowerCase().replace(/^aarch64$/, 'arm64').replace(/-v8a$/, '');
    achados.push({ campo: 'arquitetura', esperado, obtido: arch, ok: norm(esperado).includes(norm(arch)) });
  }
  const m = String(perfil?.hardware?.ram_total || '').match(/\(([\d.]+)\s*GB/i);
  const ram = cap('memory.ram_physical_mb')?.value;
  if (m && typeof ram === 'number') {
    const esp = Number(m[1]) * 1024, dif = Math.abs(ram - esp) / esp;
    achados.push({ campo: 'RAM física (MB)', esperado: esp, obtido: ram, ok: dif <= 0.05 });
  }
  achados.push({ campo: 'compatibilidade', esperado: 'android-termux-constrained', obtido: relatorio.compatibilidade.perfil, ok: relatorio.compatibilidade.perfil === 'android-termux-constrained' });
  return { ok: achados.every(a => a.ok), achados };
}

// Execução real. O canal é injetado para os testes; o padrão roda o script local ou por SSH.
function executar(cmd, args, entrada, timeoutMs) {
  return new Promise(resolver => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = '', err = '';
    const t = setTimeout(() => { p.kill(); resolver({ ok: false, erro: 'timeout' }); }, timeoutMs);
    p.stdout.on('data', c => { if (out.length < 65536) out += c; });
    p.stderr.on('data', c => { if (err.length < 4096) err += c; });
    p.on('error', e => { clearTimeout(t); resolver({ ok: false, erro: e.code === 'ENOENT' ? 'comando não encontrado' : 'erro ao executar' }); });
    p.on('close', code => { clearTimeout(t); resolver(code === 0 ? { ok: true, saida: out } : { ok: false, erro: `saída ${code}`, saida: out }); });
    p.stdin.end(entrada);
  });
}

export async function coletarLocal({ executor = executar } = {}) {
  const osApi = { plataforma: os.platform(), arch: os.arch(), memTotalBytes: os.totalmem(), memLivreBytes: os.freemem() };
  if (os.platform() === 'win32') {
    const r = await executor('sh', ['-s'], SCRIPT_LEITURA, 10000);
    return montarRelatorio({ alvo: 'local', caps: montarCapacidades({ saida: r.ok ? r.saida : '', plataforma: 'win32', osApi, erroShell: r.ok ? null : r.erro }) });
  }
  const r = await executor('sh', ['-s'], SCRIPT_LEITURA, 10000);
  return montarRelatorio({ alvo: 'local', caps: montarCapacidades({ saida: r.ok ? r.saida : '', plataforma: os.platform(), osApi, erroShell: r.ok ? null : r.erro }) });
}

export async function coletarSsh(perfil, { executor = executar } = {}) {
  const n = perfil.network || {};
  if (!n.ip || !n.ssh_user) throw new Error('perfil sem network.ip / network.ssh_user');
  const chave = String(n.ssh_key || '').replace(/^~/, os.homedir());
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=accept-new',
    '-i', chave, '-p', String(n.ssh_port || 8022), `${n.ssh_user}@${n.ip}`, 'sh -s'];
  const r = await executor('ssh', args, SCRIPT_LEITURA, 20000);
  return montarRelatorio({ alvo: perfil.id || 'remoto', caps: montarCapacidades({ saida: r.ok ? r.saida : '', plataforma: 'android', erroShell: r.ok ? null : r.erro }) });
}

// ----- CLI -----
const ehCli = process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1]).replace(/\\/g, '/')}`).href;
if (ehCli) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--perfil');
  const idPerfil = i >= 0 ? args[i + 1] : null;
  const aqui = dirname(fileURLToPath(import.meta.url));
  const raiz = resolve(aqui, '..', '..');
  const lockPath = join(raiz, '.collab', 'locks', 'a15-discovery.lock');
  const travar = () => { mkdirSync(dirname(lockPath), { recursive: true }); writeFileSync(lockPath, `claude-orq | T59 | ${agora()} | leitura do A15 (sem escrita)\n`, { flag: 'wx' }); };
  const soltar = () => { try { unlinkSync(lockPath); } catch {} };
  (async () => {
    let rel;
    if (idPerfil) {
      const pf = join(raiz, 'profiles', `${idPerfil}.json`);
      if (!existsSync(pf)) { console.error(`[discovery] perfil não encontrado: ${idPerfil}`); process.exit(1); }
      const perfil = JSON.parse(readFileSync(pf, 'utf8'));
      try { travar(); } catch { console.error('[discovery] lock a15-discovery.lock já existe: outra leitura em curso'); process.exit(3); }
      try { rel = await coletarSsh(perfil); } finally { soltar(); }
      if (args.includes('--comparar')) {
        const c = compararPerfil(rel, perfil);
        console.log(JSON.stringify(c, null, 2));
        process.exit(c.ok ? 0 : 2);
      }
    } else rel = await coletarLocal();
    console.log(JSON.stringify(rel, null, 2));
  })().catch(e => { console.error(`[discovery] falhou: ${e.message}`); process.exit(1); });
}
