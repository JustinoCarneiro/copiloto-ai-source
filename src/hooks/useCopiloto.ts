import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Suggestion {
  descricao: string;
  destino?: string;
  valor: number;
  tipo: "entrada" | "saida";
  forma_pagamento?: "debito" | "credito" | "dinheiro" | "pix";
  parcelas?: number;
  categoria_sugerida?: string;
}

export interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  suggestion?: Suggestion | null;
  saved?: boolean;
  dismissed?: boolean;
}

const WELCOME: Msg = {
  role: "assistant",
  content: "Olá! Sou o **Copiloto** ✨\n\nMe diga um gasto (ex: *gastei 45 no iFood no crédito*) ou pergunte sobre suas finanças:\n\n• Quanto gastei com alimentação este mês?\n• Quais contas vencem esta semana?\n• Qual foi meu maior gasto?",
};

export function useCopiloto(initialConversaId?: string | null) {
  const { user } = useAuth();
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId ?? null);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [sending, setSending] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!initialConversaId) return;
    if (loadedFor.current === initialConversaId) return;
    loadedFor.current = initialConversaId;
    (async () => {
      const { data } = await supabase.from("ia_mensagens").select("*").eq("conversa_id", initialConversaId).order("created_at");
      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({
          id: m.id, role: m.role, content: m.content, suggestion: m.suggestion,
        })));
        setConversaId(initialConversaId);
      }
    })();
  }, [initialConversaId]);

  const reset = () => {
    setConversaId(null);
    setMessages([WELCOME]);
    loadedFor.current = null;
  };

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-ia", {
        body: {
          messages: next.filter(m => m.role !== "assistant" || m.content).map(m => ({ role: m.role, content: m.content })),
          conversa_id: conversaId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.conversa_id && !conversaId) setConversaId(data.conversa_id);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.text || (data.suggestion ? "Identifiquei um lançamento — confirme abaixo:" : "..."),
        suggestion: data.suggestion ?? undefined,
      }]);
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const confirmSave = async (idx: number, s: Suggestion) => {
    if (!user) return;
    let categoria_id: string | null = null;
    if (s.categoria_sugerida) {
      const { data: cats } = await supabase.from("categorias").select("id,nome");
      const found = cats?.find((c: any) => c.nome.toLowerCase() === s.categoria_sugerida!.toLowerCase());
      categoria_id = found?.id ?? null;
    }
    const { error } = await supabase.from("gastos").insert({
      user_id: user.id,
      descricao: s.descricao,
      destino: s.destino ?? null,
      valor: s.valor,
      tipo: s.tipo,
      forma_pagamento: s.forma_pagamento ?? "dinheiro",
      parcelas: s.parcelas ?? 1,
      valor_parcela: (s.parcelas ?? 1) > 1 ? s.valor / (s.parcelas ?? 1) : null,
      categoria_id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo!");
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, saved: true } : m));
  };

  const dismiss = (idx: number) => setMessages(prev => prev.map((m, i) => i === idx ? { ...m, dismissed: true } : m));

  return { conversaId, setConversaId, messages, sending, send, confirmSave, dismiss, reset };
}
