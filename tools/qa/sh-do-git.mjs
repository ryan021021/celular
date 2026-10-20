// No Windows, PowerShell e cmd nao tem `sh` no PATH (e o `bash` que aparece e o do WSL), entao os
// testes de shell do Termux quebram com ENOENT. Devolve um env NOVO com o usr\bin do Git na frente;
// nos outros casos devolve o mesmo env.
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

export function comShDoGit(env, { plataforma = process.platform, existe = existsSync } = {}) {
  if (plataforma !== 'win32') return env;
  const chave = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const pastas = (env[chave] ?? '').split(';').filter(Boolean);
  if (pastas.some((p) => existe(win32.join(p, 'sh.exe')))) return env;
  const comGit = pastas.find((p) => existe(win32.join(p, 'git.exe')));
  if (!comGit) return env;
  // git.exe fica em <Git>\cmd, <Git>\bin ou <Git>\mingw64\bin
  const raiz = [win32.dirname(comGit), win32.dirname(win32.dirname(comGit))]
    .find((r) => existe(win32.join(r, 'usr', 'bin', 'sh.exe')));
  if (!raiz) return env;
  // duas vezes de proposito: os testes do Termux montam `${bin}:${PATH}` (":" e o separador do Linux),
  // o que gruda a pasta deles na primeira do PATH; a segunda copia sobrevive e fica antes do system32
  // (senao sort/find/timeout do Windows entram no lugar dos do Git). Conserto de verdade: path.delimiter nos testes.
  const usrBin = win32.join(raiz, 'usr', 'bin');
  return { ...env, [chave]: [usrBin, usrBin, ...pastas].join(';') };
}
