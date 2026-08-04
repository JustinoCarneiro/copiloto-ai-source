import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User as UserIcon, Send, Mic, MicOff, Loader2, Check, X, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatBRL } from "@/lib/format";
import { useCopiloto, type Msg } from "@/hooks/useCopiloto";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useState } from "react";

interface Props {
  conversaId?: string | null;
  onNewConversation?: () => void;
  compact?: boolean;
}

const INVALIDATE = ["gastos", "dashboard", "relatorios", "cartoes", "contas", "ranking", "metas"];

export function CopilotoChat({ conversaId, onNewConversation, compact }: Props) {
  const qc = useQueryClient();
  const { messages, sending, send, confirmSave, dismiss, reset } = useCopiloto(conversaId ?? null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder((t) => { setInput(prev => (prev ? prev + " " : "") + t); inputRef.current?.focus(); });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [conversaId]);

  const doSend = async () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    await send(t);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const doConfirm = async (i: number, m: Msg) => {
    await confirmSave(i, m.suggestion!);
    INVALIDATE.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };

  const newChat = () => { reset(); onNewConversation?.(); };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className={`flex-1 overflow-y-auto ${compact ? "p-3" : "p-4 md:p-6"} space-y-4 scrollbar-thin`}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 md:gap-3 ${m.role === "user" ? "flex-row-reverse" : ""} animate-float-up`}>
            <div className={`size-8 md:size-9 rounded-full flex items-center justify-center shrink-0 ${m.role === "assistant" ? "gradient-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              {m.role === "assistant" ? <Bot className="size-4 md:size-5" /> : <UserIcon className="size-4" />}
            </div>
            <div className={`max-w-[85%] min-w-0 ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-sm ${m.role === "assistant" ? "bg-background/60 border border-border/60" : "gradient-primary text-primary-foreground"}`}>
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_strong]:text-primary [&_ul]:my-1 [&_ul]:pl-4">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
              {m.suggestion && !m.dismissed && (
                <div className="mt-2 p-3 md:p-4 rounded-xl border border-primary/40 bg-primary/5 backdrop-blur space-y-2 text-left">
                  <p className="text-xs uppercase tracking-wider text-primary font-bold">Confirmar lançamento</p>
                  <div className="flex justify-between items-baseline gap-2">
                    <p className="font-medium truncate">{m.suggestion.descricao}</p>
                    <p className="font-display text-lg md:text-xl font-bold text-primary shrink-0">{formatBRL(m.suggestion.valor)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    {[m.suggestion.destino, m.suggestion.forma_pagamento, m.suggestion.categoria_sugerida, m.suggestion.tipo === "entrada" ? "Entrada" : "Saída"].filter(Boolean).join(" · ")}
                    {(m.suggestion.parcelas ?? 1) > 1 && ` · ${m.suggestion.parcelas}x`}
                  </p>
                  {m.saved ? (
                    <p className="text-success text-sm font-semibold flex items-center gap-1"><Check className="size-4" /> Salvo</p>
                  ) : (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Button size="sm" variant="hero" onClick={() => doConfirm(i, m)}><Check className="size-4" /> Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(i)}><X className="size-4" /> Descartar</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2 md:gap-3 animate-float-up">
            <div className="size-8 md:size-9 rounded-full gradient-primary flex items-center justify-center"><Bot className="size-4 md:size-5 text-primary-foreground" /></div>
            <div className="px-4 py-3 rounded-2xl bg-background/60 border border-border/60"><Loader2 className="size-4 animate-spin text-primary" /></div>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-2.5 bg-background/40 space-y-2 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={newChat} className="text-xs h-7"><Plus className="size-3" /> Nova conversa</Button>
          {voice.recording && <span className="text-xs text-destructive font-medium animate-pulse">● Gravando…</span>}
          {voice.processing && <span className="text-xs text-muted-foreground">Transcrevendo…</span>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); doSend(); }} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Digite ou fale...'
            disabled={sending}
            className="bg-card/60"
          />
          <Button
            type="button"
            variant={voice.recording ? "destructive" : "outline"}
            size="icon"
            disabled={sending || voice.processing}
            onClick={voice.toggle}
            aria-label={voice.recording ? "Parar gravação" : "Gravar áudio"}
          >
            {voice.processing ? <Loader2 className="size-4 animate-spin" /> : voice.recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Button type="submit" variant="hero" size="icon" disabled={!input.trim() || sending}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
