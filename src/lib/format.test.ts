import { describe, expect, it } from "vitest";
import { daysUntil, formatBRL, monthRange, parseBoldSegments } from "./format";

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

describe("parseBoldSegments", () => {
  it("separa texto simples sem negrito num único segmento", () => {
    expect(parseBoldSegments("sem negrito aqui")).toEqual([{ text: "sem negrito aqui", bold: false }]);
  });

  it("identifica um trecho em negrito no meio do texto", () => {
    expect(parseBoldSegments("Sua maior categoria foi **Mercado** este mês")).toEqual([
      { text: "Sua maior categoria foi ", bold: false },
      { text: "Mercado", bold: true },
      { text: " este mês", bold: false },
    ]);
  });

  it("nunca produz HTML — mesmo com tags no texto, tudo vira segmento de texto puro", () => {
    const malicioso = "**<img src=x onerror=alert(1)>**";
    const segmentos = parseBoldSegments(malicioso);
    expect(segmentos).toEqual([{ text: "<img src=x onerror=alert(1)>", bold: true }]);
    // nenhum segmento contém HTML já "montado" (sem tags de abertura/fechamento coladas) —
    // quem renderiza usa {seg.text} como texto React, que escapa automaticamente.
  });
});

// toISOString() sempre devolve a data em UTC — usá-lo pra montar uma string "YYYY-MM-DD" a
// partir de um Date local é o bug clássico de fuso horário: rodando à noite num fuso negativo
// (ex.: Brasil, -03:00, depois das 21h), "ontem às 21h local" já virou "hoje" em UTC, e o teste
// passa a falhar de forma intermitente dependendo da hora em que roda. Achado rodando esta
// suíte à noite pela primeira vez — não era flakiness do daysUntil, era do teste. Formata a
// partir dos componentes LOCAIS do Date, nunca de toISOString(), pra ficar determinístico em
// qualquer fuso e qualquer hora do dia.
const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("daysUntil", () => {
  it("retorna 0 para uma data que é hoje", () => {
    expect(daysUntil(toLocalISODate(new Date()))).toBe(0);
  });

  it("retorna negativo para data já vencida", () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    expect(daysUntil(toLocalISODate(ontem))).toBeLessThan(0);
  });

  it("retorna positivo para data futura", () => {
    const emCinco = new Date();
    emCinco.setDate(emCinco.getDate() + 5);
    expect(daysUntil(toLocalISODate(emCinco))).toBe(5);
  });
});
