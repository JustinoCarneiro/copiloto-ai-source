import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EXPORT_TABLES } from "./accountExport.ts";

Deno.test("EXPORT_TABLES - cobre as 14 tabelas de domínio com user_id, exclui tabelas administrativas", () => {
  assertEquals(EXPORT_TABLES.length, 14);
  assertEquals(EXPORT_TABLES.includes("admin_logs" as any), false);
  assertEquals(EXPORT_TABLES.includes("coupons" as any), false);
  assertEquals(EXPORT_TABLES.includes("app_settings" as any), false);
});
