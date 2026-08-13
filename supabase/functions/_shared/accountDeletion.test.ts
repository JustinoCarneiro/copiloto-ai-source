import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TABLES_WITHOUT_USER_CASCADE } from "./accountDeletion.ts";

Deno.test("TABLES_WITHOUT_USER_CASCADE - lista exata das 3 tabelas sem FK até auth.users (levantada via grep nas migrations)", () => {
  assertEquals([...TABLES_WITHOUT_USER_CASCADE].sort(), ["ia_conversas", "pagamentos_contas", "subscriptions"]);
});
