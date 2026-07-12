import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Upload, ArrowLeft } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { fetchClientData } from "@/lib/api";
import { datasetFromRows } from "@/lib/csv/parser";
import type { AnalysisMode, ReportConfig } from "@/lib/csv/types";
import { DashboardContent } from "./dashboard";
import { reconstructMariaMaria } from "@/lib/csv/maria-maria";

export const Route = createFileRoute("/dashboard/$clientSlug")({
  head: () => ({
    meta: [{ title: "Dashboard — Dashboard de Ouro" }],
  }),
  loader: async ({ params }) => {
    const result = await fetchClientData({ data: params.clientSlug });
    if (!result) throw notFound();
    return result;
  },
  component: ClientDashboard,
});

function ClientDashboard() {
  const { client, rows, externalWeekly } = Route.useLoaderData();

  const mode: AnalysisMode =
    client.dashboardProfile === "pixel_sales"
      ? "sales"
      : client.dashboardProfile === "whatsapp_external" || client.dashboardProfile === "maria-maria"
        ? "maria-maria"
        : (client.dashboardProfile as AnalysisMode);

  const dataset = useMemo(() => {
    const ds = datasetFromRows(rows, `${client.name} (histórico)`);
    if ((client.dashboardProfile === "maria-maria" || client.dashboardProfile === "whatsapp_external") && externalWeekly) {
      const mmDataset = reconstructMariaMaria(ds, externalWeekly);
      return { ...ds, mariaMaria: mmDataset };
    }
    return ds;
  }, [rows, client.name, client.dashboardProfile, externalWeekly]);

  const config: ReportConfig = useMemo(
    () => ({ clientName: client.name, period: "", mode }),
    [client.name, mode],
  );

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
    <DashboardContent dataOverride={{ dataset, config }} uploadSlug={client.slug} />
  );
}
