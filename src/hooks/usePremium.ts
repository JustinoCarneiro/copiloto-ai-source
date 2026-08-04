import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeSubscriptionState, defaultSubscriptionState, type SubscriptionState } from "@/lib/subscription";

export type { SubscriptionState };

export const usePremium = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionState> => {
      if (!user) return defaultSubscriptionState();
      const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) return defaultSubscriptionState();
      return computeSubscriptionState(data);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  return { ...(query.data ?? defaultSubscriptionState()), isLoading: query.isLoading, refetch: query.refetch };
};
