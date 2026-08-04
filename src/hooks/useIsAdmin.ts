// Compatibilidade — usa o novo hook useRole.
import { useRole } from "./useRole";

export const useIsAdmin = () => {
  const { isAdmin, isLoading } = useRole();
  return { isAdmin, isLoading };
};
