// Monitoramento de erro sem SDK: fala direto com a API legada "store" do Sentry (protocolo
// estável há anos, documentado, plano free não exige cartão). Evita puxar o @sentry/deno como
// dependência numa function que já tem pouca superfície. Se SENTRY_DSN não estiver setado (ex.:
// enquanto a conta Sentry não existe ainda), reportError() não faz nada — nunca é o motivo de uma
// resposta falhar.

export interface ParsedDsn {
  host: string;
  publicKey: string;
  projectId: string;
}

export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\//, "");
    if (!publicKey || !projectId || !u.host) return null;
    return { host: u.host, publicKey, projectId };
  } catch {
    return null;
  }
}

export function buildStoreUrl(parsed: ParsedDsn): string {
  return `https://${parsed.host}/api/${parsed.projectId}/store/`;
}

export function buildAuthHeader(publicKey: string): string {
  return `Sentry sentry_version=7, sentry_client=copiloto-edge/1.0, sentry_key=${publicKey}`;
}

export interface ErrorEventInput {
  error: unknown;
  functionName: string;
  extra?: Record<string, unknown>;
  eventId: string;
  timestamp: string;
}

export function buildErrorEvent(input: ErrorEventInput): Record<string, unknown> {
  const { error, functionName, extra, eventId, timestamp } = input;
  const message = error instanceof Error ? error.message : String(error);
  return {
    event_id: eventId,
    timestamp,
    platform: "other",
    level: "error",
    logger: "supabase-edge-function",
    message,
    exception: error instanceof Error
      ? { values: [{ type: error.name, value: error.message }] }
      : undefined,
    tags: { function: functionName },
    extra,
  };
}

export async function reportError(error: unknown, functionName: string, extra?: Record<string, unknown>): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const event = buildErrorEvent({
    error, functionName, extra,
    eventId: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
  });

  try {
    await fetch(buildStoreUrl(parsed), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": buildAuthHeader(parsed.publicKey) },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // monitoramento não pode ser motivo de a function falhar — silencioso de propósito.
  }
}
