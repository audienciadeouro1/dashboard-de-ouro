import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { logout } from "@/lib/api";

interface BrandHeaderProps {
  showHomeLink?: boolean;
  right?: React.ReactNode;
}

export function BrandHeader({ showHomeLink = false, right }: BrandHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const showLogout = location.pathname !== "/login";

  async function handleLogout() {
    try {
      await logout();
      navigate({ to: "/login" });
    } catch (e) {
      console.error("Erro ao fazer logout", e);
    }
  }

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
        <div className="flex items-center gap-4">
          {right}
          {showLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/5 gap-1.5"
            >
              <LogOut className="w-4.5 h-4.5" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
