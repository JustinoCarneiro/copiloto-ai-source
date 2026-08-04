#!/usr/bin/env node
// Gera ANON_KEY e SERVICE_ROLE_KEY (JWTs HS256) a partir do JWT_SECRET em deploy/.env.
// Uso: preencher JWT_SECRET em deploy/.env, depois rodar `node deploy/generate-jwt-keys.js`
// a partir da raiz do repo. Só usa módulos nativos do Node — sem dependência nova.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error(`Não achei ${envPath}. Copie deploy/.env.example para deploy/.env e preencha JWT_SECRET antes de rodar este script.`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const secret = env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error("JWT_SECRET vazio ou curto demais em deploy/.env — gere com `openssl rand -base64 40` primeiro.");
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerEnc = base64url(JSON.stringify(header));
  const payloadEnc = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${headerEnc}.${payloadEnc}`).digest();
  const signatureEnc = signature.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${headerEnc}.${payloadEnc}.${signatureEnc}`;
}

const now = Math.floor(Date.now() / 1000);
// 10 anos de validade — self-host não tem rotação automática como o Supabase Cloud;
// rotacionar manualmente (gerar de novo com este script) se precisar revogar.
const exp = now + 10 * 365 * 24 * 60 * 60;

const anonKey = signJwt({ role: "anon", iss: "supabase", iat: now, exp }, secret);
const serviceRoleKey = signJwt({ role: "service_role", iss: "supabase", iat: now, exp }, secret);

console.log("Cole cada valor em TODOS os campos correspondentes de deploy/.env (ver comentários do arquivo):\n");
console.log(`ANON_KEY=${anonKey}\n`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}\n`);
