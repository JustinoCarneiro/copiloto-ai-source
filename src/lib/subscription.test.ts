import { describe, expect, it } from "vitest";
import { computeSubscriptionState, defaultSubscriptionState, type SubscriptionRow } from "./subscription";

const NOW = new Date("2026-08-04T12:00:00Z").getTime();
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe("defaultSubscriptionState", () => {
  it("retorna estado free sem trial nem premium", () => {
    const state = defaultSubscriptionState();
    expect(state.plano).toBe("free");
    expect(state.isPro).toBe(false);
    expect(state.trialActive).toBe(false);
    expect(state.premiumActive).toBe(false);
  });
});

describe("computeSubscriptionState — trial", () => {
  it("usuário em trial com dias restantes é isPro", () => {
    const row: SubscriptionRow = { plano: "free", status: "trialing", trial_ends_at: days(3) };
    const state = computeSubscriptionState(row, NOW);
    expect(state.trialActive).toBe(true);
    expect(state.trialDaysLeft).toBe(3);
    expect(state.isPro).toBe(true);
    expect(state.premiumActive).toBe(false);
  });

  it("trial expirado não é mais ativo", () => {
    const row: SubscriptionRow = { plano: "free", status: "trialing", trial_ends_at: days(-1) };
    const state = computeSubscriptionState(row, NOW);
    expect(state.trialActive).toBe(false);
    expect(state.trialDaysLeft).toBe(0);
    expect(state.isPro).toBe(false);
  });

  it("trial não conta se a assinatura já foi cancelada, mesmo com data futura", () => {
    const row: SubscriptionRow = { plano: "free", status: "canceled", trial_ends_at: days(3) };
    const state = computeSubscriptionState(row, NOW);
    expect(state.trialActive).toBe(false);
    expect(state.isPro).toBe(false);
  });

  it("trial não conta se o plano já virou premium (evita dupla contagem de acesso)", () => {
    const row: SubscriptionRow = { plano: "premium", status: "active", trial_ends_at: days(3) };
    const state = computeSubscriptionState(row, NOW);
    expect(state.trialActive).toBe(false);
    expect(state.premiumActive).toBe(true);
    expect(state.isPro).toBe(true);
  });
});

describe("computeSubscriptionState — premium", () => {
  it("premium ativo sem data de expiração (assinatura recorrente em dia)", () => {
    const row: SubscriptionRow = { plano: "premium", status: "active" };
    const state = computeSubscriptionState(row, NOW);
    expect(state.premiumActive).toBe(true);
    expect(state.isPro).toBe(true);
  });

  it("premium com premium_until no passado não é mais ativo", () => {
    const row: SubscriptionRow = { plano: "premium", status: "active", premium_until: days(-1) };
    const state = computeSubscriptionState(row, NOW);
    expect(state.premiumActive).toBe(false);
    expect(state.isPro).toBe(false);
  });

  it("plano premium mas status overdue não conta como ativo (cobrança falhou)", () => {
    const row: SubscriptionRow = { plano: "premium", status: "overdue" };
    const state = computeSubscriptionState(row, NOW);
    expect(state.premiumActive).toBe(false);
    expect(state.isPro).toBe(false);
  });

  it("billingCycle cai pra ciclo legado quando billing_cycle não existe", () => {
    const row: SubscriptionRow = { plano: "premium", status: "active", ciclo: "anual" };
    const state = computeSubscriptionState(row, NOW);
    expect(state.billingCycle).toBe("anual");
  });

  it("billing_cycle tem prioridade sobre ciclo quando ambos existem", () => {
    const row: SubscriptionRow = { plano: "premium", status: "active", ciclo: "anual", billing_cycle: "mensal" };
    const state = computeSubscriptionState(row, NOW);
    expect(state.billingCycle).toBe("mensal");
  });
});
