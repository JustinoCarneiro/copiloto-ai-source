import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractUserFromClaims, hasAdminRole, parseBearerToken } from "./authLogic.ts";

Deno.test("parseBearerToken - extrai o token de um header Bearer válido", () => {
  assertEquals(parseBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
});

Deno.test("parseBearerToken - header ausente retorna null", () => {
  assertEquals(parseBearerToken(null), null);
});

Deno.test("parseBearerToken - header sem prefixo Bearer retorna null", () => {
  assertEquals(parseBearerToken("Basic abc123"), null);
});

Deno.test("parseBearerToken - header vazio retorna null", () => {
  assertEquals(parseBearerToken(""), null);
});

Deno.test("extractUserFromClaims - claims válidos extraem userId (sub) e email", () => {
  const r = extractUserFromClaims({ data: { claims: { sub: "user-123", email: "a@b.com" } }, error: null });
  assertEquals(r, { userId: "user-123", email: "a@b.com" });
});

Deno.test("extractUserFromClaims - claims sem email não quebra (fica undefined)", () => {
  const r = extractUserFromClaims({ data: { claims: { sub: "user-123" } }, error: null });
  assertEquals(r, { userId: "user-123", email: undefined });
});

Deno.test("extractUserFromClaims - erro na resposta retorna null, mesmo com claims presentes", () => {
  const r = extractUserFromClaims({ data: { claims: { sub: "user-123" } }, error: new Error("token expirado") });
  assertEquals(r, null);
});

Deno.test("extractUserFromClaims - data null retorna null", () => {
  assertEquals(extractUserFromClaims({ data: null, error: null }), null);
});

Deno.test("extractUserFromClaims - data sem claims retorna null", () => {
  assertEquals(extractUserFromClaims({ data: {}, error: null }), null);
});

Deno.test("hasAdminRole - linha encontrada é admin", () => {
  assertEquals(hasAdminRole({ role: "admin" }), true);
});

Deno.test("hasAdminRole - sem linha (query maybeSingle vazia) não é admin", () => {
  assertEquals(hasAdminRole(null), false);
});
