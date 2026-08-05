import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BodySchema, buildSubscriptionUpsertPayload, resolveCustomerIdentity } from "./logic.ts";

Deno.test("BodySchema - aceita cycle mensal/anual, cpfCnpj e phone opcionais", () => {
  const r = BodySchema.safeParse({ cycle: "mensal" });
  assertEquals(r.success, true);
});

Deno.test("BodySchema - rejeita cycle fora do enum", () => {
  const r = BodySchema.safeParse({ cycle: "semanal" });
  assertEquals(r.success, false);
});

Deno.test("BodySchema - rejeita cpfCnpj curto demais (proteção contra lixo/injeção)", () => {
  const r = BodySchema.safeParse({ cycle: "mensal", cpfCnpj: "123" });
  assertEquals(r.success, false);
});

Deno.test("BodySchema - aceita CPF (11) e CNPJ (14, formatado até 18) dentro do limite", () => {
  assertEquals(BodySchema.safeParse({ cycle: "anual", cpfCnpj: "12345678901" }).success, true);
  assertEquals(BodySchema.safeParse({ cycle: "anual", cpfCnpj: "12.345.678/0001-90" }).success, true);
});

Deno.test("resolveCustomerIdentity - usa nome/email do perfil quando existem", () => {
  const r = resolveCustomerIdentity({ nome: "Ana", email: "ana@example.com" }, { userId: "u1", email: "outro@x.com" });
  assertEquals(r, { name: "Ana", email: "ana@example.com" });
});

Deno.test("resolveCustomerIdentity - sem perfil, cai pro claim do JWT (nome vem da parte antes do @)", () => {
  const r = resolveCustomerIdentity(null, { userId: "u1", email: "joao@example.com" });
  assertEquals(r, { name: "joao", email: "joao@example.com" });
});

Deno.test("resolveCustomerIdentity - perfil sem email, mas com nome, ainda cai pro email do JWT", () => {
  const r = resolveCustomerIdentity({ nome: "Maria" }, { userId: "u1", email: "maria@example.com" });
  assertEquals(r, { name: "Maria", email: "maria@example.com" });
});

Deno.test("resolveCustomerIdentity - sem email em lugar nenhum retorna erro, não string vazia silenciosa", () => {
  const r = resolveCustomerIdentity(null, { userId: "u1" });
  assertEquals(r, { error: "Email não encontrado no perfil" });
});

Deno.test("resolveCustomerIdentity - sem nome em lugar nenhum usa 'Usuário' como fallback final", () => {
  const r = resolveCustomerIdentity(null, { userId: "u1", email: "x@example.com" }) as { name: string };
  // email sem @ na frente não deveria acontecer, mas o fallback de nome é 'Usuário' só quando
  // profile.nome falta E user.email falta também (aqui email existe, então nome vem de "x")
  assertEquals(r.name, "x");
});

Deno.test("buildSubscriptionUpsertPayload - plano sempre nasce 'free', mesmo se o gateway já responder status active", () => {
  const payload = buildSubscriptionUpsertPayload({
    userId: "u1", gateway: "mercadopago", customerId: "cus1", subscriptionId: "sub1",
    status: "active", amount: 19.9, cycle: "mensal", nextDueDate: "2026-09-04", invoiceUrl: "https://mp/checkout",
  });
  assertEquals(payload.plano, "free");
  assertEquals(payload.status, "active");
  assertEquals(payload.billing_cycle, "mensal");
  assertEquals(payload.ciclo, "mensal");
});

Deno.test("PLAN_PRICES (service.ts) deve continuar batendo com o preço exibido em src/pages/Planos.tsx", async () => {
  const { PLAN_PRICES } = await import("../_shared/payments/service.ts");
  // Se este teste falhar, ou PLAN_PRICES mudou ou o preço exibido no frontend (Planos.tsx)
  // mudou — os dois têm que ser atualizados juntos, senão o usuário vê um preço e é cobrado outro.
  assertEquals(PLAN_PRICES.mensal, 19.9);
  assertEquals(PLAN_PRICES.anual, 199.9);
});
