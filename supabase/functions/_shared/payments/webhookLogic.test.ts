import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPaymentPatch, buildPreapprovalPatch, type PaymentData, type PreapprovalData } from "./webhookLogic.ts";

const basePre = (over: Partial<PreapprovalData> = {}): PreapprovalData => ({
  id: "SUB1", status: "pending", nextDueDate: null, ...over,
});

Deno.test("buildPreapprovalPatch - status active promove pra premium", () => {
  const patch = buildPreapprovalPatch(basePre({ status: "active" }));
  assertEquals(patch.plano, "premium");
  assertEquals(patch.status, "active");
});

Deno.test("buildPreapprovalPatch - status canceled derruba pra free e marca canceled_at", () => {
  const patch = buildPreapprovalPatch(basePre({ status: "canceled" }));
  assertEquals(patch.plano, "free");
  assertEquals(typeof patch.canceled_at, "string");
});

Deno.test("buildPreapprovalPatch - status pending não mexe no plano", () => {
  const patch = buildPreapprovalPatch(basePre({ status: "pending" }));
  assertEquals("plano" in patch, false);
  assertEquals(patch.status, "pending");
});

Deno.test("buildPreapprovalPatch - propaga next_due_date e last_invoice_url só quando presentes", () => {
  const semExtras = buildPreapprovalPatch(basePre({}));
  assertEquals("next_due_date" in semExtras, false);
  assertEquals("last_invoice_url" in semExtras, false);

  const comExtras = buildPreapprovalPatch(basePre({ nextDueDate: "2026-09-01", initPoint: "https://mp/checkout" }));
  assertEquals(comExtras.next_due_date, "2026-09-01");
  assertEquals(comExtras.last_invoice_url, "https://mp/checkout");
});

const basePay = (over: Partial<PaymentData> = {}): PaymentData => ({
  id: "PAY1", status: "pending", preapprovalId: null, receiptUrl: null, ...over,
});

Deno.test("buildPaymentPatch - pagamento active promove pra premium e seta payment_method", () => {
  const patch = buildPaymentPatch(basePay({ status: "active", paymentMethod: "pix" }), undefined, new Date("2026-08-04"));
  assertEquals(patch.plano, "premium");
  assertEquals(patch.status, "active");
  assertEquals(patch.payment_method, "pix");
});

Deno.test("buildPaymentPatch - sem subRow (billingCycle undefined) NÃO recalcula premium_until", () => {
  const patch = buildPaymentPatch(basePay({ status: "active" }), undefined, new Date("2026-08-04"));
  assertEquals("premium_until" in patch, false);
});

Deno.test("buildPaymentPatch - ciclo mensal soma 1 mês a partir de agora", () => {
  const now = new Date("2026-08-04T12:00:00Z");
  const patch = buildPaymentPatch(basePay({ status: "active" }), "mensal", now);
  assertEquals(patch.premium_until, "2026-09-04T12:00:00.000Z");
});

Deno.test("buildPaymentPatch - ciclo anual soma 12 meses a partir de agora", () => {
  const now = new Date("2026-08-04T12:00:00Z");
  const patch = buildPaymentPatch(basePay({ status: "active" }), "anual", now);
  assertEquals(patch.premium_until, "2027-08-04T12:00:00.000Z");
});

Deno.test("buildPaymentPatch - billingCycle null (subRow existe mas ciclo não setado) trata como mensal, não quebra", () => {
  const now = new Date("2026-08-04T12:00:00Z");
  const patch = buildPaymentPatch(basePay({ status: "active" }), null, now);
  assertEquals(patch.premium_until, "2026-09-04T12:00:00.000Z");
});

Deno.test("buildPaymentPatch - pagamento canceled/recusado rebaixa pra overdue, não mexe no plano", () => {
  const patch = buildPaymentPatch(basePay({ status: "canceled" }), "mensal", new Date("2026-08-04"));
  assertEquals(patch.status, "overdue");
  assertEquals("plano" in patch, false);
  assertEquals("premium_until" in patch, false);
});

Deno.test("buildPaymentPatch - pagamento pending não gera nenhum patch", () => {
  const patch = buildPaymentPatch(basePay({ status: "pending" }), "mensal", new Date("2026-08-04"));
  assertEquals(Object.keys(patch).length, 0);
});

Deno.test("buildPaymentPatch - receiptUrl só entra no patch quando presente", () => {
  const sem = buildPaymentPatch(basePay({ status: "active" }), undefined, new Date("2026-08-04"));
  assertEquals("last_invoice_url" in sem, false);
  const com = buildPaymentPatch(basePay({ status: "active", receiptUrl: "https://mp/receipt" }), undefined, new Date("2026-08-04"));
  assertEquals(com.last_invoice_url, "https://mp/receipt");
});
