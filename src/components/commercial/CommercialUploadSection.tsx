import { useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FunnelMappingForm } from "./FunnelMappingForm";
import type { FunnelConfig } from "@/lib/csv/types";
import {
  fetchFunnelConfig,
  persistFunnelConfig,
  importCommercialCsv,
} from "@/lib/api";

interface Props {
  clientId: number;
  refYear: number;
}

/**
 * Bloco independente de importação de dados comerciais (CSV gerado do PDF da
 * cliente). Não interfere no fluxo do Meta Ads. Na primeira importação pede o
 * mapeamento das colunas; nas seguintes aplica o mapeamento salvo.
 */
export function CommercialUploadSection({ clientId, refYear }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [config, setConfig] = useState<FunnelConfig | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(f: File) {
    setError(null);
    setSuccess(null);
    setLoading(true);
    setFileName(f.name);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const data = result.data;
          const cols = result.meta.fields ?? [];
          if (data.length === 0 || cols.length === 0) {
            throw new Error("O CSV comercial não contém colunas ou linhas de dados.");
          }
          setHeaders(cols);
          setRows(data);
          const existing = await fetchFunnelConfig({ data: clientId });
          setConfig(existing);
          if (!existing) {
            setShowMapping(true);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro ao ler o CSV comercial.");
          setFileName(null);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setFileName(null);
        setLoading(false);
      },
    });
  }

  async function runImport() {
    setLoading(true);
    setError(null);
    try {
      const res = await importCommercialCsv({
        data: { clientId, rows, refYear, fileName: fileName ?? undefined },
      });
      setSuccess(`${res.saved} período(s) salvo(s) com sucesso.`);
      setShowMapping(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar os dados comerciais.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMapping(cfg: FunnelConfig) {
    setLoading(true);
    setError(null);
    try {
      await persistFunnelConfig({ data: { clientId, config: cfg } });
      setConfig(cfg);
      await runImport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o mapeamento.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-8">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Dados comerciais (CSV)
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          CSV com os números do negócio (contatos, agendamentos, vendas, faturamento) por período.
        </p>
      </div>

      <UploadDropzone
        onFile={handleFile}
        fileName={fileName}
        loading={loading}
        description="CSV comercial gerado a partir do relatório da cliente."
      />

      {success && (
        <p className="flex items-center gap-2 text-sm text-[oklch(0.83_0.16_88)]">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {showMapping && headers.length > 0 && (
        <FunnelMappingForm
          headers={headers}
          initial={config}
          onSave={handleSaveMapping}
          saving={loading}
        />
      )}

      {!showMapping && config && headers.length > 0 && !success && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <p className="text-sm text-foreground">
            Mapeamento salvo detectado ({config.commercial.stages.length} etapa(s), período em
            &ldquo;{config.commercial.periodColumn}&rdquo;).
          </p>
          <div className="flex gap-2">
            <Button onClick={() => runImport()} disabled={loading} className="flex-1">
              {loading ? "Importando..." : "Importar com este mapeamento"}
            </Button>
            <Button variant="outline" onClick={() => setShowMapping(true)} disabled={loading}>
              <Pencil className="w-4 h-4 mr-1" /> Ajustar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
