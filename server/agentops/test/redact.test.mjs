import test from "node:test";
import assert from "node:assert/strict";
import { redact, makeRedactor } from "../redact.mjs";
import { logar, logarErro, definirSegredosLog } from "../../../tools/worker/worker.mjs";

// Rodar com: node --test server/agentops/test/redact.test.mjs  (passar só a pasta falha no Node 25 do Windows)

// fixtures falsas montadas em pedaços, para a trava do §11 (tools/qa/escopo.mjs) não confundir com segredo real
const ANT = "sk-" + "ant-api03-AbCdEf1234567890xyz", GH = "gh" + "p_abcdefghijklmnopqrstuvwxyz0123456789";
const PEM = (l) => "-----" + l + " RSA PRIVATE " + "KEY-----";

// 8 formatos de segredo: cada um precisa sumir do texto (T65, §20.1)
const SEGREDOS = [
  ["chave Anthropic", `usando ${ANT} agora`, ANT],
  ["Bearer no cabeçalho", "Authorization: Bearer abcdef1234567890ABCDEF", "abcdef1234567890ABCDEF"],
  ["token=valor", "chamada com token=zz9Plural8Qw2Xy falhou", "zz9Plural8Qw2Xy"],
  ["password: valor", 'config password: "hunter2-super" ok', "hunter2-super"],
  ["senha em URL", "clone https://ryan:SenhaMuitoForte99@git.exemplo.com/repo.git", "SenhaMuitoForte99"],
  ["token em query string", "GET https://host.exemplo.com/x?access_token=tok123456789abc&v=1", "tok123456789abc"],
  ["chave privada PEM", `${PEM("BEGIN")}\nMIIEpAIBAAKCAQEA0abc\n${PEM("END")}`, "MIIEpAIBAAKCAQEA0abc"],
  ["token GitHub", `push com ${GH}`, GH],
];

for (const [nome, texto, segredo] of SEGREDOS) {
  test(`segredo some do log: ${nome}`, () => {
    const out = redact(texto);
    assert.ok(!out.includes(segredo), `vazou: ${out}`);
    assert.match(out, /\[segredo\]/);
  });
}

test("texto normal fica intacto (sem falso positivo)", () => {
  const normal = "task-manager reunião às 10h; o token de acesso expira amanhã; Basic information; saída 0 em 1.5 s";
  assert.equal(redact(normal), normal);
  assert.equal(redact("GET https://host.exemplo.com/x?page=2&sort=nome"), "GET https://host.exemplo.com/x?page=2&sort=nome");
});

test("o nome da chave e a URL continuam legíveis; só o valor some", () => {
  assert.equal(redact("password: hunter2-super"), "password: [segredo]");
  assert.equal(redact("https://ryan:SenhaMuitoForte99@git.exemplo.com/r"), "https://ryan:[segredo]@git.exemplo.com/r");
});

test("segredos literais (tokens da config) são trocados mesmo sem formato conhecido", () => {
  assert.equal(makeRedactor(["minha-chave-xyz-123"])("valor minha-chave-xyz-123 fim"), "valor [segredo] fim");
  assert.equal(redact("curto abc", ["abc"]), "curto abc", "literal com menos de 8 caracteres é ignorado");
});

test("worker: logar e logarErro mascaram o token do A13", () => {
  const capturado = [];
  const origLog = console.log, origErr = console.error;
  console.log = m => capturado.push(m);
  console.error = m => capturado.push(m);
  try {
    definirSegredosLog(["token-do-worker-0123456789"]);
    logar("[worker] conectando com token-do-worker-0123456789");
    logarErro("[worker] falha Authorization: Bearer token-do-worker-0123456789");
  } finally {
    console.log = origLog; console.error = origErr;
    definirSegredosLog([]);
  }
  assert.equal(capturado.length, 2);
  for (const linha of capturado) assert.ok(!linha.includes("token-do-worker-0123456789"), linha);
});
