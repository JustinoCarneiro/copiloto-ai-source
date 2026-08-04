import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { safeTokenMatch } from "./webhookAuth.ts";

Deno.test("safeTokenMatch - tokens idênticos batem", () => {
  assertEquals(safeTokenMatch("abc123", "abc123"), true);
});

Deno.test("safeTokenMatch - tokens diferentes (mesmo tamanho) não batem", () => {
  assertEquals(safeTokenMatch("abc123", "xyz789"), false);
});

Deno.test("safeTokenMatch - tamanhos diferentes não batem (e não lança erro)", () => {
  assertEquals(safeTokenMatch("abc", "abc123"), false);
  assertEquals(safeTokenMatch("abc123456", "abc"), false);
});

Deno.test("safeTokenMatch - token recebido null não bate com nada", () => {
  assertEquals(safeTokenMatch(null, "qualquer-token"), false);
});

Deno.test("safeTokenMatch - string vazia não bate com token não-vazio", () => {
  assertEquals(safeTokenMatch("", "token-real"), false);
});

Deno.test("safeTokenMatch - string vazia recebida nunca bate, mesmo contra expected vazio (\"\" é falsy, cai no guard de got ausente)", () => {
  assertEquals(safeTokenMatch("", ""), false);
});

Deno.test("safeTokenMatch - case-sensitive", () => {
  assertEquals(safeTokenMatch("Token123", "token123"), false);
});
