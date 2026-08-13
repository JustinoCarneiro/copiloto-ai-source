// GoTrue (Supabase Auth) devolve mensagem de erro em inglês, sem tradução própria pro projeto.
// Mapa das mensagens mais comuns pro usuário PT-BR — fallback é a mensagem original (melhor
// mostrar algo em inglês do que esconder um erro real que ainda não mapeamos).
const MAP: Record<string, string> = {
  "Email not confirmed": "E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam).",
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "User already registered": "Já existe uma conta com esse e-mail.",
  "Signup requires a valid password": "Informe uma senha válida.",
  "Unable to validate email address: invalid format": "E-mail inválido.",
  "Email rate limit exceeded": "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  "New password should be different from the old password.": "A nova senha precisa ser diferente da atual.",
};

export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Erro desconhecido. Tente novamente.";
  return MAP[message] ?? message;
}
