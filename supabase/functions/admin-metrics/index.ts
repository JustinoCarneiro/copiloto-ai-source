// Métricas globais e séries temporais para o Dashboard Executivo. Requer role 'admin'.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient, isAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const supa = serviceClient();
    const admin_ok = await isAdmin(user.userId);
    if (!admin_ok) return jsonResponse({ error: "Acesso restrito" }, 403);

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const inicio30 = new Date(now.getTime() - 30 * 86400000);

    const [
      { count: totalUsers },
      { count: premiumUsers },
      { count: canceladas },
      { count: pendentes },
      { data: ativas },
      { count: ativosMes },
      { count: canceladasMes },
      { count: ativasInicioMes },
    ] = await Promise.all([
      supa.from("profiles").select("*", { count: "exact", head: true }),
      supa.from("subscriptions").select("*", { count: "exact", head: true }).eq("plano", "premium").eq("status", "active"),
      supa.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "canceled"),
      supa.from("subscriptions").select("*", { count: "exact", head: true }).in("status", ["pending", "overdue"]),
      supa.from("subscriptions").select("amount,billing_cycle").eq("status", "active").eq("plano", "premium"),
      supa.from("gastos").select("user_id", { count: "exact", head: true }).gte("created_at", inicio30.toISOString()),
      supa.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "canceled").gte("canceled_at", inicioMes.toISOString()),
      supa.from("subscriptions").select("*", { count: "exact", head: true }).eq("plano", "premium").lte("created_at", inicioMes.toISOString()),
    ]);

    let mrr = 0;
    for (const s of ativas ?? []) {
      const amt = Number(s.amount ?? 0);
      mrr += s.billing_cycle === "anual" ? amt / 12 : amt;
    }
    const arr = mrr * 12;

    const { data: pagos } = await supa.from("payment_logs").select("amount,created_at").eq("status", "active");
    const receitaTotal = (pagos ?? []).reduce((a, l: any) => a + Number(l.amount ?? 0), 0);
    const ticketMedio = (premiumUsers ?? 0) > 0 ? receitaTotal / (premiumUsers ?? 1) : 0;
    const conversao = (totalUsers ?? 0) > 0 ? ((premiumUsers ?? 0) / (totalUsers ?? 1)) * 100 : 0;
    const churn = (ativasInicioMes ?? 0) > 0 ? ((canceladasMes ?? 0) / (ativasInicioMes ?? 1)) * 100 : 0;
    const receitaPrevista = arr; // simplificação: ARR

    // Séries temporais últimos 6 meses
    const { data: profilesAll } = await supa.from("profiles").select("created_at");
    const { data: subsAll } = await supa.from("subscriptions").select("created_at,amount,billing_cycle,status,plano");
    const series: { mes: string; usuarios: number; assinaturas: number; mrr: number; receita: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dNext = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const usuariosNoMes = (profilesAll ?? []).filter((p: any) => new Date(p.created_at) < dNext).length;
      const assinaturasNoMes = (subsAll ?? []).filter((sb: any) => sb.plano === "premium" && new Date(sb.created_at) >= d && new Date(sb.created_at) < dNext).length;
      let mrrNoMes = 0;
      (subsAll ?? []).filter((sb: any) => sb.plano === "premium" && sb.status === "active" && new Date(sb.created_at) < dNext).forEach((sb: any) => {
        const amt = Number(sb.amount ?? 0); mrrNoMes += sb.billing_cycle === "anual" ? amt / 12 : amt;
      });
      const receitaNoMes = (pagos ?? []).filter((p: any) => {
        const dt = new Date(p.created_at); return dt >= d && dt < dNext;
      }).reduce((a, p: any) => a + Number(p.amount ?? 0), 0);
      series.push({ mes: key, usuarios: usuariosNoMes, assinaturas: assinaturasNoMes, mrr: Number(mrrNoMes.toFixed(2)), receita: Number(receitaNoMes.toFixed(2)) });
    }

    return jsonResponse({
      totalUsers: totalUsers ?? 0,
      usuariosAtivos: ativosMes ?? 0,
      premiumUsers: premiumUsers ?? 0,
      assinaturasAtivas: ativas?.length ?? 0,
      assinaturasCanceladas: canceladas ?? 0,
      pagamentosPendentes: pendentes ?? 0,
      mrr: Number(mrr.toFixed(2)),
      arr: Number(arr.toFixed(2)),
      receitaTotal: Number(receitaTotal.toFixed(2)),
      receitaPrevista: Number(receitaPrevista.toFixed(2)),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      conversaoPct: Number(conversao.toFixed(2)),
      churnPct: Number(churn.toFixed(2)),
      series,
    });
  } catch (e) {
    console.error("admin-metrics", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
