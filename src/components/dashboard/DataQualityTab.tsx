import { FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { fmtNum } from "@/lib/csv/format";
import { useDashboard } from "./context";

export function DataQualityTab() {
  const { dataset } = useDashboard();
  if (!dataset) return null;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard
          label="Linhas importadas"
          value={fmtNum(dataset.totalRows)}
          icon={<FileSpreadsheet className="w-4 h-4" />}
        />
        <KpiCard
          label="Colunas no CSV"
          value={fmtNum(dataset.totalColumns)}
          icon={<FileSpreadsheet className="w-4 h-4" />}
        />
        <KpiCard
          label="Reconhecidas"
          value={fmtNum(dataset.recognizedColumns.length)}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <KpiCard
          label="Não reconhecidas"
          value={fmtNum(dataset.unrecognizedColumns.length)}
          icon={<XCircle className="w-4 h-4" />}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[oklch(0.78_0.18_150)]" />
            Colunas reconhecidas
          </h3>
          <div className="flex flex-wrap gap-2">
            {dataset.recognizedColumns.map((c) => (
              <span
                key={c}
                className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.72_0.18_150_/_0.12)] text-[oklch(0.78_0.18_150)] border border-[oklch(0.72_0.18_150_/_0.3)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            Colunas ignoradas
          </h3>
          {dataset.unrecognizedColumns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dataset.unrecognizedColumns.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.22_0_0)] text-muted-foreground border border-[oklch(0.3_0_0)]"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Todas as colunas foram reconhecidas. ✨
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Métricas indisponíveis</h3>
        {dataset.missingMetrics.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              As métricas abaixo não foram encontradas no CSV. Para análises mais completas,
              considere adicioná-las ao exportar do Gerenciador de Anúncios:
            </p>
            <div className="flex flex-wrap gap-2">
              {dataset.missingMetrics.map((m) => (
                <span
                  key={m}
                  className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.78_0.16_60_/_0.08)] text-[oklch(0.85_0.16_60)] border border-[oklch(0.78_0.16_60_/_0.2)]"
                >
                  {m}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Todas as métricas suportadas estão disponíveis.
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-3">💡 Como exportar o CSV ideal</h3>
        <ol className="space-y-2 text-sm text-foreground/85 list-decimal list-inside">
          <li>
            No Gerenciador de Anúncios, acesse a aba <strong>Campanhas</strong> (ou Conjuntos /
            Anúncios).
          </li>
          <li>
            Configure as colunas para incluir: Investimento, Impressões, Alcance, Cliques no link,
            CTR, CPC, CPM, Frequência, Resultados, Compras, Valor de conversão, ROAS.
          </li>
          <li>Selecione o período desejado.</li>
          <li>
            Clique em <strong>Relatórios → Exportar tabela (.csv)</strong>.
          </li>
          <li>Faça upload do arquivo aqui no Dashboard de Ouro.</li>
        </ol>
      </div>
    </div>
  );
}
