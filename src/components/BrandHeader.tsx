import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

interface BrandHeaderProps {
  showHomeLink?: boolean;
  right?: React.ReactNode;
}

export function BrandHeader({ showHomeLink = false, right }: BrandHeaderProps) {
  const brand = (
    <div className="relative flex items-center">
      <img
        src="/images/logo-dashboard-de-ouro.png"
        alt="Dashboard de Ouro"
        className="h-36 md:h-48 w-auto object-contain"
      />
    </div>
  );

  return (
    <header className="border-b border-[oklch(0.83_0.16_88_/_0.15)] bg-[oklch(0.1_0_0_/_0.6)] backdrop-blur-xl sticky top-0 z-40 no-print h-20">
      <div className="mx-auto max-w-[1600px] px-6 h-full flex items-center justify-between">
        {showHomeLink ? (
          <Link to="/" className="flex items-center h-full group">
            {brand}
          </Link>
        ) : (
          <div className="flex items-center h-full group">{brand}</div>
        )}
        {right}
      </div>
    </header>
  );
}
