import { describe, expect, it } from "vitest";
import { daysUntil, formatBRL, monthRange } from "./format";

describe("formatBRL", () => {
  it("formata valor positivo em BRL", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });

  it("trata null/undefined como zero em vez de quebrar", () => {
    expect(formatBRL(null)).toBe("R$ 0,00");
    expect(formatBRL(undefined)).toBe("R$ 0,00");
  });
});

describe("monthRange", () => {
  it("retorna o primeiro e o último dia do mês informado", () => {
    const { start, end } = monthRange(new Date(2026, 1, 15)); // fevereiro/2026
    expect(start).toBe("2026-02-01");
    expect(end).toBe("2026-02-28");
  });

  it("lida com ano bissexto corretamente", () => {
    const { end } = monthRange(new Date(2028, 1, 10)); // 2028 é bissexto
    expect(end).toBe("2028-02-29");
  });
});

describe("daysUntil", () => {
  it("retorna 0 para uma data que é hoje", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isoToday = today.toISOString().slice(0, 10);
    expect(daysUntil(isoToday)).toBe(0);
  });

  it("retorna negativo para data já vencida", () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const iso = ontem.toISOString().slice(0, 10);
    expect(daysUntil(iso)).toBeLessThan(0);
  });

  it("retorna positivo para data futura", () => {
    const emCinco = new Date();
    emCinco.setDate(emCinco.getDate() + 5);
    const iso = emCinco.toISOString().slice(0, 10);
    expect(daysUntil(iso)).toBe(5);
  });
});
