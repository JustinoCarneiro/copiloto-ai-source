import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDailyLimitExceeded, startOfTodayISO } from "./iaLimit.ts";

Deno.test("isDailyLimitExceeded - limit null significa sem limite (comportamento atual da coluna nullable)", () => {
  assertEquals(isDailyLimitExceeded(999, null), false);
  assertEquals(isDailyLimitExceeded(999, undefined), false);
});

Deno.test("isDailyLimitExceeded - contagem abaixo do limite não bloqueia", () => {
  assertEquals(isDailyLimitExceeded(4, 5), false);
});

Deno.test("isDailyLimitExceeded - contagem igual ao limite já bloqueia (limite é o teto, não o próximo permitido)", () => {
  assertEquals(isDailyLimitExceeded(5, 5), true);
});

Deno.test("isDailyLimitExceeded - contagem acima do limite bloqueia", () => {
  assertEquals(isDailyLimitExceeded(10, 5), true);
});

Deno.test("isDailyLimitExceeded - limite 0 bloqueia tudo (admin pode zerar acesso de um usuário)", () => {
  assertEquals(isDailyLimitExceeded(0, 0), true);
});

Deno.test("startOfTodayISO - zera horas/minutos/segundos mantendo a data local", () => {
  const iso = startOfTodayISO(new Date(2026, 7, 13, 23, 59, 59));
  const d = new Date(iso);
  assertEquals(d.getFullYear(), 2026);
  assertEquals(d.getMonth(), 7);
  assertEquals(d.getDate(), 13);
  assertEquals(d.getHours(), 0);
  assertEquals(d.getMinutes(), 0);
});
