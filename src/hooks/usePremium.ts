import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionState {
  plano: "free" | "premium";
  status: "trialing" | "pending" | "active" | "overdue" | "canceled" | "free";
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  premiumActive: boolean;
  isPro: boolean;
  ciclo: "mensal" | "anual" | null;
  billingCycle: "mensal" | "anual" | null;
  amount: number | null;
  nextDueDate: Date | null;
  paymentMethod: string | null;
  lastInvoiceUrl: string | null;
  subscriptionId: string | null;
  premiumUntil: Date | null;
}

export const usePremium = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionState> => {
      if (!user) return defaults();
      const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) return defaults();

      const now = Date.now();
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
      const premiumUntil = data.premium_until ? new Date(data.premium_until) : null;
      const nextDueDate = (data as any).next_due_date ? new Date((data as any).next_due_date) : null;
      const status = ((data as any).status ?? "free") as SubscriptionState["status"];
      const trialActive = !!trialEndsAt && trialEndsAt.getTime() > now && data.plano !== "premium" && status !== "canceled";
      const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86400000)) : 0;
      const premiumActive = data.plano === "premium" && status === "active" && (!premiumUntil || premiumUntil.getTime() > now);

      return {
        plano: data.plano as "free" | "premium",
        status,
        trialActive,
        trialDaysLeft,
        trialEndsAt,
        premiumActive,
        isPro: premiumActive || trialActive,
        ciclo: (data.ciclo as any) ?? null,
        billingCycle: ((data as any).billing_cycle as any) ?? (data.ciclo as any) ?? null,
        amount: (data as any).amount ?? null,
        nextDueDate,
        paymentMethod: (data as any).payment_method ?? null,
        lastInvoiceUrl: (data as any).last_invoice_url ?? null,
        subscriptionId: (data as any).subscription_id ?? null,
        premiumUntil,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  return { ...(query.data ?? defaults()), isLoading: query.isLoading, refetch: query.refetch };
};

const defaults = (): SubscriptionState => ({
  plano: "free",
  status: "free",
  trialActive: false,
  trialDaysLeft: 0,
  trialEndsAt: null,
  premiumActive: false,
  isPro: false,
  ciclo: null,
  billingCycle: null,
  amount: null,
  nextDueDate: null,
  paymentMethod: null,
  lastInvoiceUrl: null,
  subscriptionId: null,
  premiumUntil: null,
});
