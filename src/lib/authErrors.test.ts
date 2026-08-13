import { describe, expect, it } from "vitest";
import { translateAuthError } from "./authErrors";

describe("translateAuthError", () => {
  it("traduz mensagens conhecidas do GoTrue pra PT-BR", () => {
    expect(translateAuthError("Email not confirmed")).toMatch(/ainda não confirmado/);
    expect(translateAuthError("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("mensagem desconhecida cai no fallback (a própria mensagem), não desaparece", () => {
    expect(translateAuthError("Some brand new GoTrue error")).toBe("Some brand new GoTrue error");
  });

  it("mensagem ausente vira um fallback genérico em PT-BR", () => {
    expect(translateAuthError(undefined)).toMatch(/Erro desconhecido/);
    expect(translateAuthError(null)).toMatch(/Erro desconhecido/);
  });
});
