import { createFileRoute, useNavigate, notFound, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCsvFile } from "@/lib/csv/parser";
import type { AnalysisMode, ParsedDataset } from "@/lib/csv/types";
import { processMariaMaria } from "@/lib/csv/maria-maria";
import { setData } from "@/lib/store";
import { fetchClientBySlug, ingestCsvRows, ingestExternalWeeklyData, checkSession } from "@/lib/api";
import { format } from "date-fns";

export const Route = createFileRoute("/upload/$clientSlug")({
  beforeLoad: async () => {
    const session = await checkSession();
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ params }) => {
    const client = await fetchClientBySlug({ data: params.clientSlug });
    if (!client) throw notFound();
    return client;
  },
  component: UploadPage,
});

function UploadPage() {
  const client = Route.useLoaderData();
  const navigate = useNavigate();
  const [fileA, setFileA] = useState<File | null>(null); // Meta Ads
  const [fileB, setFileB] = useState<File | null>(null); // Salão (Maria Maria)
  const [parsed, setParsed] = useState<ParsedDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("");

  // Modo derivado do perfil do cliente
  const mode: AnalysisMode =
    client.slug === "maria-maria"
      ? "maria-maria"
      : client.dashboardProfile === "pixel_sales"
        ? "sales"
        : "leads";
  const isMariaMaria = mode === "maria-maria";

  // A página inteira aceita o arraste: soltar o CSV em qualquer lugar
  // funciona, em vez de exigir mira na caixa de upload.
  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      if (isMariaMaria) return;
      const f = e.dataTransfer?.files?.[0];
      if (f && (f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv"))) {
        void handleFileA(f);
      }
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMariaMaria]);

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
      let finalDataset = parsed;
      if (isMariaMaria) {
        if (!fileB) {
          setError("Para Maria Maria, é necessário subir o arquivo do Salão também.");
          setLoading(false);
          return;
        }
        const mmDataset = await processMariaMaria(parsed, fileB);
        finalDataset = { ...parsed, mariaMaria: mmDataset };
        
        // Salva dados diários do Meta:
        await ingestCsvRows({ data: { clientId: client.id, rows: parsed.rows } });
        
        // Salva dados semanais do Salão no D1:
        const externalWeeks = mmDataset.weeks.map((w) => ({
          startDate: format(new Date(w.startDate), "yyyy-MM-dd"),
          endDate: format(new Date(w.endDate), "yyyy-MM-dd"),
          contatosWhatsapp: w.salonData.contatosWhatsapp,
          agendamentos: w.salonData.agendamentos,
          agendamentosComServico: w.salonData.agendamentosComServico,
          faturamento: w.salonData.totalFaturamento,
          ticketMedio: w.salonData.ticketMedio,
        }));
        await ingestExternalWeeklyData({ data: { clientId: client.id, weeks: externalWeeks } });

        // Salva também no store local (para redundância) e navega para a rota persistida
        setData(finalDataset, { clientName: client.name, period, mode });
        navigate({ to: "/dashboard/$clientSlug", params: { clientSlug: client.slug } });
        return;
      }
      // Demais clientes: dados já persistidos no banco — abre o dashboard do
      // cliente, que relê tudo do D1 (acumulado, não só o upload atual).
      await ingestCsvRows({ data: { clientId: client.id, rows: parsed.rows } });
      setData(finalDataset, { clientName: client.name, period, mode });
      navigate({ to: "/dashboard/$clientSlug", params: { clientSlug: client.slug } });
    } catch (e) {
      setError(
        e instanceof Error
          ? `Erro ao salvar os dados: ${e.message}`
          : "Erro ao salvar os dados no banco.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <BrandHeader showHomeLink />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Atualizar dados — {client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suba o CSV exportado do Meta Ads. Os dados são salvos e somados ao histórico — dias
            repetidos são substituídos pela versão mais recente, nunca duplicados.
          </p>
        </div>

        <div className="space-y-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            CSV do Meta Ads
          </Label>
          <UploadDropzone onFile={handleFileA} fileName={fileA?.name ?? null} loading={loading} />
          {isMariaMaria && (
            <>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                CSV do Salão (Maria Maria)
              </Label>
              <UploadDropzone
                onFile={setFileB}
                fileName={fileB?.name ?? null}
                description="Planilha semanal do salão com faturamento, agendamentos e contatos."
              />
            </>
          )}
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
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ex: 01/07 a 31/07"
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!parsed || loading}
          className="w-full gap-2"
          size="lg"
        >
          {loading ? "Processando..." : "Salvar e abrir dashboard"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </main>
    </div>
  );
}
