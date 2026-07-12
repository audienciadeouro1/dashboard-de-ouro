import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Mail, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login, checkSession } from "@/lib/api";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    // Se já estiver logado, redireciona para a home
    const session = await checkSession();
    if (session.authenticated) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Login — Dashboard de Ouro" },
      { name: "description", content: "Acesse o painel do Dashboard de Ouro." },
    ],
  }),
  component: LoginComponent,
});

function LoginComponent() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login({ data: { email, password } });
      if (res.success) {
        navigate({ to: "/" });
      } else {
        setError(res.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      setError("Erro ao tentar fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.08_0_0)] relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[oklch(0.83_0.16_88_/_0.03)] rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[oklch(0.83_0.16_88_/_0.03)] rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-6 z-10">
        <div className="flex flex-col items-center text-center">
          <img
            src="/images/logo-dashboard-de-ouro.png"
            alt="Dashboard de Ouro"
            className="h-32 md:h-40 w-auto object-contain mb-2 animate-pulse"
          />
          <h1 className="font-display text-2xl font-bold text-foreground">
            Acesse seus Dashboards
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entre com suas credenciais para gerenciar relatórios
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card border border-[oklch(0.83_0.16_88_/_0.15)] rounded-2xl p-6 md:p-8 space-y-5 bg-[oklch(0.12_0_0_/_0.4)] backdrop-blur-xl glow-gold-soft"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[oklch(0.83_0.16_88)]" /> E-mail
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="seu-email@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] focus-visible:border-[oklch(0.83_0.16_88_/_0.6)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[oklch(0.83_0.16_88)]" /> Senha
            </Label>
            <Input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] focus-visible:border-[oklch(0.83_0.16_88_/_0.6)]"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gold-gradient text-black font-semibold h-11 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Autenticando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                Entrar no Painel <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          Dashboard de Ouro · Audiência de Ouro
        </div>
      </div>
    </div>
  );
}
