import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, History } from "lucide-react";
import { CopilotoChat } from "@/components/CopilotoChat";
import { Link } from "react-router-dom";

export function CopilotoFAB() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="hero"
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 size-14 md:size-16 rounded-full p-0 shadow-glow animate-pulse-glow"
          aria-label="Abrir Copiloto"
        >
          <Sparkles className="size-6 md:size-7" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gradient-card border-l border-border h-[100dvh]"
      >
        <SheetHeader className="p-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary flex items-center gap-1"><Sparkles className="size-3" /> IA</p>
              <SheetTitle className="font-display text-xl">Copiloto</SheetTitle>
            </div>
            <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Link to="/ia/historico"><History className="size-4" /> Histórico</Link>
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <CopilotoChat compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
