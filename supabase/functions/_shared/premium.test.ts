import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeIsPremium } from "./premium.ts";

const NOW = new Date("2026-08-04T12:00:00Z").getTime();
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

Deno.test("computeIsPremium - sem linha de assinatura não é premium", () => {
  assertEquals(computeIsPremium(null, NOW), false);
});

Deno.test("computeIsPremium - trial ativo é premium", () => {
  const row = { plano: "free", status: "trialing", trial_ends_at: days(3) };
  assertEquals(computeIsPremium(row, NOW), true);
});

Deno.test("computeIsPremium - trial expirado não é premium", () => {
  const row = { plano: "free", status: "trialing", trial_ends_at: days(-1) };
  assertEquals(computeIsPremium(row, NOW), false);
});

Deno.test("computeIsPremium - REGRESSÃO: assinatura cancelada durante o trial NÃO é premium mesmo com trial_ends_at no futuro", () => {
  // Bug real encontrado (ver memoria-tecnica/bugs/): a versão anterior de isPremium() não
  // checava status !== "canceled", então um usuário que cancelava durante o trial continuava
  // sendo tratado como premium até a data de expiração do trial. Nunca foi explorado em
  // produção porque isPremium() não tem chamador hoje — mas seria uma falha real se algo vier a
  // usá-la (ex.: liberar ia_daily_limit maior por engano pra quem já cancelou).
  const row = { plano: "free", status: "canceled", trial_ends_at: days(3) };
  assertEquals(computeIsPremium(row, NOW), false);
});

Deno.test("computeIsPremium - plano já premium não conta mais como trial (evita dupla contagem)", () => {
  const row = { plano: "premium", status: "active", trial_ends_at: days(3) };
  assertEquals(computeIsPremium(row, NOW), true); // premium por premiumActive, não por trial
});

Deno.test("computeIsPremium - premium ativo sem data de expiração", () => {
  assertEquals(computeIsPremium({ plano: "premium", status: "active" }, NOW), true);
});

Deno.test("computeIsPremium - premium com premium_until vencido não é mais ativo", () => {
  const row = { plano: "premium", status: "active", premium_until: days(-1) };
  assertEquals(computeIsPremium(row, NOW), false);
});

Deno.test("computeIsPremium - plano premium com status overdue não é ativo (cobrança falhou)", () => {
  assertEquals(computeIsPremium({ plano: "premium", status: "overdue" }, NOW), false);
});

Deno.test("computeIsPremium - free sem trial não é premium", () => {
  assertEquals(computeIsPremium({ plano: "free", status: "free" }, NOW), false);
});
