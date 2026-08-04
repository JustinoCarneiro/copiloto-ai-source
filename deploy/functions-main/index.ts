// Dispatcher do Edge Runtime self-hosted — reproduz o template oficial publicado pela Supabase
// em supabase/supabase (docker/volumes/functions/main/index.ts). Recebe TODA requisição em
// /functions/v1/<nome> e delega pro worker da função correspondente em
// supabase/functions/<nome>/index.ts (montado no container via docker-compose.yml).
//
// IMPORTANTE: a API `EdgeRuntime.userWorkers.create()` é específica da imagem
// supabase/edge-runtime e pode mudar entre versões. Se as functions não responderem no dry-run
// (passo do RUNBOOK.md), o primeiro lugar a checar é se este arquivo ainda bate com o template
// atual da versão pinada em docker-compose.yml — conferir em
// https://github.com/supabase/supabase/blob/master/docker/volumes/functions/main/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("main function started");

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const VERIFY_JWT = (Deno.env.get("VERIFY_JWT") ?? "true") === "true";

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") throw new Error(`Auth header is not 'Bearer {token}'`);
  return token;
}

async function verifyJWT(jwt: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const [header, payload, signature] = jwt.split(".");
  const valid = await crypto.subtle.verify(
    "HMAC",
    secretKey,
    Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    encoder.encode(`${header}.${payload}`),
  );
  return valid;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url = new URL(req.url);
  const { pathname } = url;
  const pathParts = pathname.split("/");
  const serviceName = pathParts[1];

  if (!serviceName) {
    return new Response(JSON.stringify({ error: "missing function name in path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // supabase/config.toml marca chat-ia e mercadopago-webhook com verify_jwt=false — cada uma
  // faz a própria checagem internamente (requireUser() ou token de querystring).
  const noVerifyJwt = new Set(["chat-ia", "mercadopago-webhook"]);
  if (VERIFY_JWT && !noVerifyJwt.has(serviceName)) {
    try {
      const token = getAuthToken(req);
      const isValidJWT = await verifyJWT(token);
      if (!isValidJWT) {
        return new Response(JSON.stringify({ error: "Invalid JWT" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Invalid auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const servicePath = `/home/deno/functions/${serviceName}`;
  console.error(`serving the request with ${servicePath}`);

  const memoryLimitMb = 256;
  const workerTimeoutMs = 5 * 60 * 1000;
  const noModuleCache = false;
  const importMapPath = null;
  const envVarsObj = Deno.env.toObject();
  const envVars = Object.entries(envVarsObj);

  try {
    // @ts-expect-error — global só existe dentro da imagem supabase/edge-runtime
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      importMapPath,
      envVars,
    });
    return await worker.fetch(req);
  } catch (e) {
    const error = { msg: e instanceof Error ? e.message : String(e) };
    return new Response(JSON.stringify(error), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
