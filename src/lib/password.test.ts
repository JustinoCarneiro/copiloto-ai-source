import { describe, expect, it } from "vitest";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  it("rejeita senha com menos de 8 caracteres", () => {
    expect(validatePassword("abc123").valid).toBe(false);
  });

  it("rejeita senha só com letras", () => {
    expect(validatePassword("somenteletras").valid).toBe(false);
  });

  it("rejeita senha só com números", () => {
    expect(validatePassword("12345678").valid).toBe(false);
  });

  it("aceita senha com 8+ caracteres, letra e número", () => {
    expect(validatePassword("senha1234").valid).toBe(true);
  });

  it("mensagem de erro é específica pro critério que falhou", () => {
    expect(validatePassword("curta1").reason).toMatch(/8 caracteres/);
    expect(validatePassword("semnumero").reason).toMatch(/número/);
  });
});
