import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Role = "super_admin" | "admin" | "suporte" | "user";

export const useRole = () => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<Role[]> => {
      if (!user) return ["user"];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role as Role);
      return roles.length ? roles : ["user"];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const roles = q.data ?? ["user"];
  return {
    roles,
    isSuperAdmin: roles.includes("admin"), // no MVP, admin == super_admin
    isAdmin: roles.includes("admin"),
    isSuporte: roles.includes("suporte") || roles.includes("admin"),
    isLoading: q.isLoading,
  };
};
