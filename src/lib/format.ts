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

/** Diferença em dias entre uma data alvo e hoje. Negativo = atrasada. */
export const daysUntil = (target: string | Date): number => {
  const date = typeof target === "string" ? new Date(target + (target.length === 10 ? "T00:00:00" : "")) : target;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
};
