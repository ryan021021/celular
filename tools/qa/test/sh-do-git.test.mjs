import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comShDoGit } from '../sh-do-git.mjs';

const GIT = 'C:\\Program Files\\Git';
// disco falso: só existem os arquivos listados
const disco = (...arquivos) => (p) => arquivos.includes(p);
const comGit = disco(`${GIT}\\cmd\\git.exe`, `${GIT}\\usr\\bin\\sh.exe`);

test('Windows sem sh no PATH: poe o usr\\bin do Git na frente, sem mexer no env original', () => {
  const env = { Path: `C:\\Windows\\system32;${GIT}\\cmd`, OUTRA: '1' };
  const novo = comShDoGit(env, { plataforma: 'win32', existe: comGit });
  assert.equal(novo.Path, `${GIT}\\usr\\bin;${GIT}\\usr\\bin;C:\\Windows\\system32;${GIT}\\cmd`);
  assert.equal(novo.OUTRA, '1');
  assert.equal(env.Path, `C:\\Windows\\system32;${GIT}\\cmd`);
  assert.notEqual(novo, env);
});

test('Windows com sh ja no PATH: devolve o mesmo env', () => {
  const env = { PATH: `${GIT}\\usr\\bin;${GIT}\\cmd` };
  assert.equal(comShDoGit(env, { plataforma: 'win32', existe: comGit }), env);
});

test('Windows sem Git instalado: devolve o mesmo env (as suites de shell falham e dizem por que)', () => {
  const env = { Path: 'C:\\Windows\\system32' };
  assert.equal(comShDoGit(env, { plataforma: 'win32', existe: disco() }), env);
});

test('Linux/Termux: nao mexe no PATH, mesmo com um Git que serviria no Windows', () => {
  const env = { PATH: `${GIT}\\cmd` };
  assert.equal(comShDoGit(env, { plataforma: 'linux', existe: comGit }), env);
});

test('git.exe em mingw64\\bin tambem acha a raiz do Git', () => {
  const env = { Path: `${GIT}\\mingw64\\bin` };
  const existe = disco(`${GIT}\\mingw64\\bin\\git.exe`, `${GIT}\\usr\\bin\\sh.exe`);
  assert.equal(comShDoGit(env, { plataforma: 'win32', existe }).Path, `${GIT}\\usr\\bin;${GIT}\\usr\\bin;${GIT}\\mingw64\\bin`);
});

test('teste que monta PATH com ":" (`${bin}:${PATH}`) ainda acha o sh antes do system32', () => {
  const env = { Path: `C:\\Windows\\system32;${GIT}\\cmd` };
  const colado = `C:\\tmp\\bin:${comShDoGit(env, { plataforma: 'win32', existe: comGit }).Path}`;
  const pastas = colado.split(';');
  const sh = pastas.indexOf(`${GIT}\\usr\\bin`);
  assert.ok(sh >= 0, 'usr\\bin sumiu grudado na pasta do teste');
  assert.ok(sh < pastas.indexOf('C:\\Windows\\system32'), 'sort/find/timeout do Windows viriam antes');
});
