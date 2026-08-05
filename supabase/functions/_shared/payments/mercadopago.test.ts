import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapPaymentStatus, mapPreapprovalStatus, MercadoPagoProvider } from "./mercadopago.ts";

Deno.test("mapPreapprovalStatus - authorized vira active", () => {
  assertEquals(mapPreapprovalStatus("authorized"), "active");
});

Deno.test("mapPreapprovalStatus - paused vira overdue", () => {
  assertEquals(mapPreapprovalStatus("paused"), "overdue");
});

Deno.test("mapPreapprovalStatus - cancelled e canceled (as duas grafias) viram canceled", () => {
  assertEquals(mapPreapprovalStatus("cancelled"), "canceled");
  assertEquals(mapPreapprovalStatus("canceled"), "canceled");
});

Deno.test("mapPreapprovalStatus - pending continua pending", () => {
  assertEquals(mapPreapprovalStatus("pending"), "pending");
});

Deno.test("mapPreapprovalStatus - status desconhecido do MP cai em pending, nunca vira active por engano", () => {
  assertEquals(mapPreapprovalStatus("algum-status-novo-que-o-mp-inventou"), "pending");
  assertEquals(mapPreapprovalStatus(undefined), "pending");
});

Deno.test("mapPreapprovalStatus - é case-insensitive", () => {
  assertEquals(mapPreapprovalStatus("AUTHORIZED"), "active");
});

Deno.test("mapPaymentStatus - approved vira active", () => {
  assertEquals(mapPaymentStatus("approved"), "active");
});

Deno.test("mapPaymentStatus - in_process, pending e authorized viram pending", () => {
  assertEquals(mapPaymentStatus("in_process"), "pending");
  assertEquals(mapPaymentStatus("pending"), "pending");
  assertEquals(mapPaymentStatus("authorized"), "pending");
});

Deno.test("mapPaymentStatus - rejected/cancelled/refunded/charged_back viram canceled", () => {
  assertEquals(mapPaymentStatus("rejected"), "canceled");
  assertEquals(mapPaymentStatus("cancelled"), "canceled");
  assertEquals(mapPaymentStatus("refunded"), "canceled");
  assertEquals(mapPaymentStatus("charged_back"), "canceled");
});

Deno.test("mapPaymentStatus - status desconhecido cai em pending, nunca em active por engano", () => {
  assertEquals(mapPaymentStatus("algo-novo"), "pending");
});

// parseWebhook não faz I/O (não chama this.req) — pode instanciar com credenciais fake.
const provider = new MercadoPagoProvider("fake-token", "https://app.example.com/assinatura");

Deno.test("parseWebhook - evento de preapproval (assinatura) extrai subscriptionId, não paymentId", () => {
  const evt = provider.parseWebhook({ type: "preapproval", action: "updated", data: { id: "SUB123" } });
  assertEquals(evt.event, "PREAPPROVAL.UPDATED");
  assertEquals(evt.subscriptionId, "SUB123");
  assertEquals(evt.paymentId, undefined);
});

Deno.test("parseWebhook - evento de payment extrai paymentId, não subscriptionId", () => {
  const evt = provider.parseWebhook({ type: "payment", action: "created", data: { id: "PAY456" } });
  assertEquals(evt.event, "PAYMENT.CREATED");
  assertEquals(evt.paymentId, "PAY456");
  assertEquals(evt.subscriptionId, undefined);
});

Deno.test("parseWebhook - topic legado (subscription_preapproval) também extrai subscriptionId", () => {
  const evt = provider.parseWebhook({ topic: "subscription_preapproval", id: "SUB789" });
  assertEquals(evt.subscriptionId, "SUB789");
});

Deno.test("parseWebhook - payload sem type/topic reconhecido não quebra, não marca nenhum id", () => {
  const evt = provider.parseWebhook({ foo: "bar" });
  assertEquals(evt.subscriptionId, undefined);
  assertEquals(evt.paymentId, undefined);
});

Deno.test("parseWebhook - sem action, event é só o type maiúsculo", () => {
  const evt = provider.parseWebhook({ type: "payment", data: { id: "PAY1" } });
  assertEquals(evt.event, "PAYMENT");
});
