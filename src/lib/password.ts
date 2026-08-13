export interface PasswordCheck {
  valid: boolean;
  reason?: string;
}

export function validatePassword(pwd: string): PasswordCheck {
  if (pwd.length < 8) return { valid: false, reason: "A senha precisa ter no mínimo 8 caracteres." };
  if (!/[a-zA-Z]/.test(pwd)) return { valid: false, reason: "A senha precisa ter pelo menos uma letra." };
  if (!/[0-9]/.test(pwd)) return { valid: false, reason: "A senha precisa ter pelo menos um número." };
  return { valid: true };
}
