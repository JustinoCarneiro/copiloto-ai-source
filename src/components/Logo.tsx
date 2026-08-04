import logo from "@/assets/copiloto-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  glow?: boolean;
}

const sizes = {
  sm: "h-10",
  md: "h-16",
  lg: "h-28",
  xl: "h-44",
  "2xl": "h-56",
};

export const Logo = ({ className, showText = false, size = "md", glow = true }: LogoProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <img
        src={logo}
        alt="Copiloto AI"
        className={cn(
          sizes[size],
          "w-auto object-contain transition-transform duration-500 hover:scale-105",
          glow && "drop-shadow-[0_0_28px_hsl(24_100%_50%/0.55)]"
        )}
      />
      {showText && (
        <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Seu copiloto financeiro
        </span>
      )}
    </div>
  );
};
