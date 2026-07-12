import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Upload, ArrowLeft } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { fetchClientData, fetchClientFunnel } from "@/lib/api";
import { toISODate } from "@/lib/dates";
import { datasetFromRows } from "@/lib/csv/parser";
import type { AnalysisMode, ReportConfig } from "@/lib/csv/types";
import { DashboardContent } from "./dashboard";
import { reconstructMariaMaria } from "@/lib/csv/maria-maria";

export const Route = createFileRoute("/dashboard/$clientSlug")({
  head: () => ({
    meta: [{ title: "Dashboard — Dashboard de Ouro" }],
  }),
  validateSearch: (search: Record<string, unknown>): { start?: string; end?: string } => ({
    start:
      typeof search.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.start)
        ? search.start
        : undefined,
    end:
      typeof search.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.end)
        ? search.end
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ start: search.start, end: search.end }),
  loader: async ({ params, deps }) => {
    const [result, funnel] = await Promise.all([
      fetchClientData({
        data: { slug: params.clientSlug, start: deps.start, end: deps.end },
      }),
      fetchClientFunnel({
        data: { slug: params.clientSlug, start: deps.start, end: deps.end },
      }),
    ]);
    if (!result) throw notFound();
    return { ...result, funnel };
  },
  component: ClientDashboard,
});

function ClientDashboard() {
  const { client, rows, externalWeekly, funnel } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const onDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    navigate({
      search: {
        start: range?.from ? toISODate(range.from) : undefined,
        end: range?.to ? toISODate(range.to) : undefined,
      },
      replace: true,
    });
  };

  const mode: AnalysisMode = client.dashboardProfile;

  const dataset = useMemo(() => {
    const ds = datasetFromRows(rows, `${client.name} (histórico)`);
    if (client.dashboardProfile === "maria-maria" && externalWeekly) {
      const mmDataset = reconstructMariaMaria(ds, externalWeekly);
      return { ...ds, mariaMaria: mmDataset };
    }
    return ds;
  }, [rows, client.name, client.dashboardProfile, externalWeekly]);

  const config: ReportConfig = useMemo(
    () => ({ clientName: client.name, period: "", mode }),
    [client.name, mode],
  );

  // Período filtrado sem dados: mensagem clara + opção de limpar (não confundir com "sem dados salvos")
  const hasFilter = Boolean(search.start || search.end);
  if (rows.length === 0 && hasFilter) {
    return (
      <div className="min-h-screen">
        <BrandHeader showHomeLink />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-muted-foreground">Sem dados no período selecionado.</p>
          <Button variant="outline" onClick={() => onDateRangeChange(undefined)}>
            Limpar filtro de datas
          </Button>
        </main>
      </div>
    );
  }

  // Sem dados salvos: convida a importar o primeiro CSV
  if (rows.length === 0) {
    return (
      <div className="min-h-screen">
        <BrandHeader showHomeLink />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-muted-foreground">
            Ainda não há dados salvos para este cliente. Importe o primeiro CSV do Meta Ads para
            gerar o dashboard.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/upload/$clientSlug" params={{ clientSlug: client.slug }}>
              <Upload className="w-4 h-4" /> Importar dados
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <DashboardContent
      dataOverride={{ dataset, config }}
      uploadSlug={client.slug}
      onDateRangeChange={onDateRangeChange}
      funnel={funnel}
    />
  );
}
