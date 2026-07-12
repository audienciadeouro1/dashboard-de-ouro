import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShoppingCart,
  MessageCircle,
  Radio,
  Heart,
  Play,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCsvFile } from "@/lib/csv/parser";
import { ANALYSIS_MODES, type AnalysisMode, type ParsedDataset } from "@/lib/csv/types";
import { processMariaMaria } from "@/lib/csv/maria-maria";
import { setData } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Ouro — Análise Premium de Meta Ads" },
      {
        name: "description",
        content:
          "Transforme seus CSVs do Meta Ads em dashboards premium com insights, rankings e diagnósticos automáticos.",
      },
      { property: "og:title", content: "Dashboard de Ouro" },
      {
        property: "og:description",
        content: "Relatórios premium de Meta Ads para reuniões com clientes.",
      },
    ],
  }),
  component: HomePage,
});

const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "shopping-cart": ShoppingCart,
  "message-circle": MessageCircle,
  radio: Radio,
  heart: Heart,
  play: Play,
  sliders: Sliders,
  sparkles: Sparkles,
};

function HomePage() {
  const navigate = useNavigate();
  const [fileA, setFileA] = useState<File | null>(null); // Meta Ads
  const [fileB, setFileB] = useState<File | null>(null); // Salão (Maria Maria)
  const [parsed, setParsed] = useState<ParsedDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("sales");
  const [clientName, setClientName] = useState("");
  const [period, setPeriod] = useState("");

  const isMariaMaria = mode === "maria-maria";

  async function handleFileA(f: File) {
    setError(null);
    setLoading(true);
    setFileA(f);
    try {
      const result = await parseCsvFile(f);
      if (result.totalRows === 0) {
        throw new Error("O CSV do Meta não contém linhas de dados.");
      }
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar o arquivo.");
      setFileA(null);
    } finally {
      setLoading(false);
    }
  }

  function handleFileB(f: File) {
    setFileB(f);
  }

  async function handleGenerate() {
    if (!parsed) return;

    if (isMariaMaria) {
      if (!fileB) {
        setError("Para Maria Maria, é necessário subir o arquivo do Salão também.");
        return;
      }
      setLoading(true);
      try {
        const mmDataset = await processMariaMaria(parsed, fileB);
        const finalDataset: ParsedDataset = {
          ...parsed,
          mariaMaria: mmDataset,
        };
        setData(finalDataset, {
          clientName: clientName || "Maria Maria",
          period,
          mode,
        });
        navigate({ to: "/dashboard" });
      } catch (e) {
        setError("Erro ao processar dados da Maria Maria.");
      } finally {
        setLoading(false);
      }
    } else {
      setData(parsed, { clientName, period, mode });
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="min-h-screen">
      <BrandHeader />

      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs uppercase tracking-[0.2em] text-[oklch(0.83_0.16_88)] mb-6">
            <Zap className="w-3.5 h-3.5" /> Relatórios premium para gestores de tráfego
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] mb-5">
            Transforme seus CSVs do Meta Ads em
            <br />
            <span className="gold-text">dashboards de ouro.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Suba o arquivo exportado do Gerenciador de Anúncios e receba uma análise sofisticada,
            pronta para reuniões com seus clientes.
          </p>
        </section>

        {/* Seleção de Modo / Cliente */}
        <section className="mb-10">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-4 block text-center">
            Selecione o Cliente ou Objetivo
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ANALYSIS_MODES.map((m) => {
              const Icon = MODE_ICONS[m.icon] ?? Sliders;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id);
                    if (m.id === "maria-maria") setClientName("Maria Maria");
                  }}
                  className={cn(
                    "text-left rounded-xl p-4 border transition-all",
                    active
                      ? "border-[oklch(0.83_0.16_88)] bg-[oklch(0.83_0.16_88_/_0.08)] glow-gold"
                      : "border-[oklch(0.83_0.16_88_/_0.15)] bg-[oklch(0.16_0_0)] hover:border-[oklch(0.83_0.16_88_/_0.4)]",
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center",
                        active ? "gold-gradient" : "bg-[oklch(0.22_0_0)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4",
                          active ? "text-black" : "text-[oklch(0.83_0.16_88)]",
                        )}
                      />
                    </div>
                    <div className="font-medium text-sm">{m.label}</div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Upload */}
        <section className="mb-10 space-y-6">
          <div className={cn("grid gap-6", isMariaMaria ? "md:grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-2">
              {isMariaMaria && (
                <div className="text-xs font-bold text-[oklch(0.83_0.16_88)] uppercase mb-2">
                  1. Arraste o CSV do Meta Ads (Diário)
                </div>
              )}
              <UploadDropzone
                onFile={handleFileA}
                loading={loading}
                fileName={fileA?.name}
                description={
                  isMariaMaria ? "CSV detalhado por Dia do Meta" : "CSV exportado do Gerenciador"
                }
              />
            </div>

            {isMariaMaria && (
              <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-xs font-bold text-[oklch(0.83_0.16_88)] uppercase mb-2">
                  2. Arraste o CSV de Conversão do Salão (Semanal)
                </div>
                <UploadDropzone
                  onFile={handleFileB}
                  loading={loading}
                  fileName={fileB?.name}
                  description="CSV do Salão com colunas Semana, Total, Agendamentos..."
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-[oklch(0.65_0.22_25_/_0.4)] bg-[oklch(0.65_0.22_25_/_0.08)] p-4 text-sm text-[oklch(0.85_0.15_25)]">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Erro no processamento</div>
                <div className="text-xs opacity-80 mt-0.5">{error}</div>
              </div>
            </div>
          )}
        </section>

        {/* Configurar análise (aparece após parse do arquivo principal) */}
        {parsed && (
          <section className="glass-card rounded-2xl p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">Configure sua análise</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {parsed.totalRows} linhas · {parsed.recognizedColumns.length} colunas reconhecidas
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="client"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Nome do cliente
                </Label>
                <Input
                  id="client"
                  placeholder="Ex.: Restaurante do João"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] focus-visible:border-[oklch(0.83_0.16_88_/_0.6)]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="period"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Período do relatório (opcional)
                </Label>
                <Input
                  id="period"
                  placeholder="Ex.: Abril 2026"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] focus-visible:border-[oklch(0.83_0.16_88_/_0.6)]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                size="lg"
                disabled={loading || (isMariaMaria && !fileB)}
                className="gold-gradient text-black font-semibold hover:opacity-90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale"
              >
                {isMariaMaria ? "Gerar Dashboard Maria Maria" : "Gerar Dashboard"}{" "}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground mt-16 pb-4">
          Dashboard de Ouro · Uma ferramenta da{" "}
          <span className="text-[oklch(0.83_0.16_88)]">Audiência de Ouro</span>
        </footer>
      </main>
    </div>
  );
}
