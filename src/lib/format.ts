export const formatBRL = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

export const formatDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};

export const formatDateLong = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
};

export const monthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
};

export const monthLabel = (date = new Date()) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);

/**
 * Quebra um texto com marcação `**negrito**` em segmentos, sem produzir HTML — quem renderiza
 * decide como exibir `bold`. Existe pra evitar `dangerouslySetInnerHTML` com texto que pode conter
 * dado do usuário (ex.: nome de categoria) em vez de sanitizar HTML depois de já ter sido gerado.
 */
export function parseBoldSegments(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*.*?\*\*)/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/^\*\*(.*)\*\*$/);
      return match ? { text: match[1], bold: true } : { text: part, bold: false };
    });
}

/** Diferença em dias entre uma data alvo e hoje. Negativo = atrasada. */
export const daysUntil = (target: string | Date): number => {
  const date = typeof target === "string" ? new Date(target + (target.length === 10 ? "T00:00:00" : "")) : target;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
};
