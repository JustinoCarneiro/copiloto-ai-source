import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildAuthHeader, buildErrorEvent, buildStoreUrl, parseDsn } from "./errorReporting.ts";

Deno.test("parseDsn - extrai host, chave pública e projectId de um DSN válido", () => {
  const parsed = parseDsn("https://abc123@o456.ingest.sentry.io/789");
  assertEquals(parsed, { host: "o456.ingest.sentry.io", publicKey: "abc123", projectId: "789" });
});

Deno.test("parseDsn - DSN inválido (sem chave, sem projeto, ou não é URL) retorna null", () => {
  assertEquals(parseDsn("não é uma url"), null);
  assertEquals(parseDsn("https://o456.ingest.sentry.io/789"), null); // sem publicKey
  assertEquals(parseDsn("https://abc123@o456.ingest.sentry.io/"), null); // sem projectId
});

Deno.test("buildStoreUrl - monta o endpoint legado /api/<project>/store/", () => {
  const url = buildStoreUrl({ host: "o456.ingest.sentry.io", publicKey: "abc123", projectId: "789" });
  assertEquals(url, "https://o456.ingest.sentry.io/api/789/store/");
});

Deno.test("buildAuthHeader - formato do header X-Sentry-Auth", () => {
  const header = buildAuthHeader("abc123");
  assertEquals(header, "Sentry sentry_version=7, sentry_client=copiloto-edge/1.0, sentry_key=abc123");
});

Deno.test("buildErrorEvent - erro real (instância de Error) inclui exception com tipo e mensagem", () => {
  const event = buildErrorEvent({
    error: new TypeError("algo quebrou"),
    functionName: "chat-ia",
    eventId: "eid1",
    timestamp: "2026-08-13T00:00:00.000Z",
  });
  assertEquals(event.message, "algo quebrou");
  assertEquals(event.tags, { function: "chat-ia" });
  assertEquals((event.exception as any).values[0].type, "TypeError");
});

Deno.test("buildErrorEvent - erro não-Error (string/objeto jogado) ainda vira mensagem legível", () => {
  const event = buildErrorEvent({
    error: "falha crua",
    functionName: "payments-cancel",
    eventId: "eid2",
    timestamp: "2026-08-13T00:00:00.000Z",
  });
  assertEquals(event.message, "falha crua");
  assertEquals(event.exception, undefined);
});
