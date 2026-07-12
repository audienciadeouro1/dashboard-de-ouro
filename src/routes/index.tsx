import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { ClientCard } from "@/components/ClientCard";
import { NewClientDialog } from "@/components/NewClientDialog";
import { fetchClients, checkSession } from "@/lib/api";
import {
  Zap,
  Sliders,
  ShoppingCart,
  MessageCircle,
  Radio,
  Heart,
  Play,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { parseCsvFile } from "@/lib/csv/parser";
import { processMariaMaria } from "@/lib/csv/maria-maria";
import { setData } from "@/lib/store";
import { ANALYSIS_MODES } from "@/lib/csv/types";
import type { AnalysisMode, ParsedDataset } from "@/lib/csv/types";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await checkSession();
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard de Ouro — Início" },
      {
        name: "description",
        content: "Crie dashboards de tráfego pago para clientes fixos ou análises avulsas.",
      },
    ],
  }),
  loader: () => fetchClients(),
  component: DashboardHome,
});

const MODE_ICONS: Record<string, React.ComponentType<any>> = {
  "shopping-cart": ShoppingCart,
  "message-circle": MessageCircle,
  "radio": Radio,
  "heart": Heart,
  "play": Play,
  "sliders": Sliders,
};

function DashboardHome() {
  const clients = Route.useLoaderData();
  const navigate = useNavigate();

  // Estados para Análise Avulsa
  const [mode, setMode] = useState<AnalysisMode>("sales");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleGenerate() {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      if (isMariaMaria) {
        if (!fileB) {
          setError("Para a Maria Maria, selecione também a planilha do salão.");
          setLoading(false);
          return;
        }
        const mmDataset = await processMariaMaria(parsed, fileB);
        setData(
          { ...parsed, mariaMaria: mmDataset },
          {
            clientName: clientName || "Maria Maria",
            period,
            mode,
          },
        );
        navigate({ to: "/dashboard" });
      } else {
        setData(parsed, {
          clientName: clientName || "Cliente Avulso",
          period,
          mode,
        });
        navigate({ to: "/dashboard" });
      }
    } catch (e) {
      console.error(e);
      setError("Erro ao gerar o relatório. Verifique se os arquivos são válidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="bg-[oklch(0.14_0_0)] border border-[oklch(0.83_0.16_88_/_0.15)] p-1 h-auto flex-wrap w-full md:w-auto">
            <TabsTrigger
              value="clients"
              className="data-[state=active]:bg-[oklch(0.83_0.16_88_/_0.15)] data-[state=active]:text-[oklch(0.88_0.18_92)] px-6 py-2 text-sm"
            >
              Meus Clientes (Com Histórico)
            </TabsTrigger>
            <TabsTrigger
              value="quick"
              className="data-[state=active]:bg-[oklch(0.83_0.16_88_/_0.15)] data-[state=active]:text-[oklch(0.88_0.18_92)] px-6 py-2 text-sm"
            >
              Análise Rápida / Avulsa
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Painel de Clientes Fixos */}
          <TabsContent value="clients" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Painel de Clientes</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione um cliente para atualizar dados e abrir o dashboard.
                </p>
              </div>
              <NewClientDialog />
            </div>
            {clients.length === 0 ? (
              <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((c) => (
                  <ClientCard key={c.id} client={c} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Análise Avulsa (Sem cadastro) */}
          <TabsContent value="quick" className="space-y-8">
            <section className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs uppercase tracking-[0.2em] text-[oklch(0.83_0.16_88)] mb-4">
                <Zap className="w-3.5 h-3.5" /> Relatórios premium instantâneos em memória
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight">
                Análise Avulsa (Sem Salvar no Banco)
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
                Suba o CSV do Meta Ads e gere um relatório interativo na hora. Útil para demonstrações, prospecção ou análises rápidas.
              </p>
            </section>

            {/* Objetivos */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground block text-center">
                Selecione o Perfil do Relatório
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                        <div className="font-semibold text-sm leading-tight">{m.label}</div>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upload Zone */}
            <div className={cn("grid gap-4", isMariaMaria ? "md:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2">
                {isMariaMaria && (
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    1. CSV do Meta Ads (Diário)
                  </Label>
                )}
                <UploadDropzone
                  onFile={handleFileA}
                  loading={loading}
                  fileName={fileA?.name ?? null}
                  description="Arraste o CSV exportado do Gerenciador de Anúncios."
                />
              </div>

              {isMariaMaria && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    2. Planilha do Salão (Semanal)
                  </Label>
                  <UploadDropzone
                    onFile={setFileB}
                    loading={loading}
                    fileName={fileB?.name ?? null}
                    description="CSV do Salão com colunas Semana, Total, Agendamentos..."
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Erro ao carregar arquivos</div>
                  <div className="text-xs opacity-80 mt-0.5">{error}</div>
                </div>
              </div>
            )}

            {/* Configs (Fica visível após o parse do arquivo principal) */}
            {parsed && (
              <section className="glass-card rounded-2xl p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h3 className="font-display text-xl font-semibold">Configurar Análise</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {parsed.totalRows} linhas carregadas · {parsed.recognizedColumns.length} colunas mapeadas
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Nome do cliente / Marca
                    </Label>
                    <Input
                      id="client"
                      placeholder="Ex: Restaurante do João"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Período do relatório (opcional)
                    </Label>
                    <Input
                      id="period"
                      placeholder="Ex: Julho 2026"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleGenerate}
                    size="lg"
                    disabled={loading || (isMariaMaria && !fileB)}
                    className="gold-gradient text-black font-semibold hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    Gerar Relatório Avulso <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
