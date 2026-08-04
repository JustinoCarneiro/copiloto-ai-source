import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-ignore iOS
  window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const InstallButton = ({ variant = "hero", className }: { variant?: any; className?: string }) => {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isInIframe || isStandalone()) return null;

  const click = async () => {
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    } else if (isIOS()) {
      setShowIOS(true);
    }
  };

  return (
    <>
      <Button variant={variant} size="sm" onClick={click} className={className}>
        <Download className="size-4" /> Instalar app
      </Button>
      {showIOS && (
        <div className="fixed inset-x-3 bottom-24 md:bottom-6 z-50 bg-card border border-primary/40 rounded-2xl p-4 shadow-elevated animate-fade-in max-w-md mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display font-bold mb-1">Instalar no iPhone</p>
              <p className="text-xs text-muted-foreground">
                Toque em <span className="font-semibold">Compartilhar</span> →{" "}
                <span className="font-semibold">Adicionar à Tela de Início</span>.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowIOS(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
