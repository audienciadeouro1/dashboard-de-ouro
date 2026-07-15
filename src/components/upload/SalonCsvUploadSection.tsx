import { useState } from "react";
import Papa from "papaparse";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toNumber } from "@/lib/csv/normalize";
import { parseSemana } from "@/lib/csv/maria-maria";
import { ingestExternalWeeklyData } from "@/lib/api";
import { format } from "date-fns";

interface Props {
  clientId: number;
}

/**
 * Seção independente para atualizar a planilha do salão (Maria Maria) sem
 * precisar re-importar o CSV do Meta Ads. Salva diretamente em external_weekly_data.
 */
export function SalonCsvUploadSection({ clientId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const weeks: {
            startDate: string;
            endDate: string;
            contatosWhatsapp: number;
            agendamentos: number;
            agendamentosComServico: number;
            faturamento: number;
            ticketMedio: number;
          }[] = [];

          for (const row of results.data) {
            const semanaText = row["Semana"] || row["semana"];
            if (!semanaText) continue;
            const dates = parseSemana(semanaText, year);
            if (!dates) continue;
            weeks.push({
              startDate: format(new Date(dates.start), "yyyy-MM-dd"),
              endDate: format(new Date(dates.end), "yyyy-MM-dd"),
              contatosWhatsapp: toNumber(
                row["Contatos Whatsapp"] || row["contatos_whatsapp"],
              ),
              agendamentos: toNumber(row["Agendamentos"] || row["agendamentos"]),
              agendamentosComServico: toNumber(
                row["Agendamentos com serviço"] || row["agendamentos_com_servico"],
              ),
              faturamento: toNumber(row["Total"] || row["total"]),
              ticketMedio: toNumber(row["TM"] || row["tm"]),
            });
          }

          if (weeks.length === 0) {
            throw new Error(
              'Nenhuma semana encontrada. Verifique se o CSV tem uma coluna "Semana" no formato "19/04 a 25/04".',
            );
          }

          await ingestExternalWeeklyData({
            data: { clientId, weeks, fileName: file.name },
          });

          setSuccess(`${weeks.length} semana(s) salva(s) com sucesso.`);
          setFile(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro ao salvar os dados do salão.");
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-8">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Atualizar planilha do salão
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Atualize faturamento, agendamentos e contatos sem precisar re-importar o CSV do Meta Ads.
          Use esta seção sempre que a planilha do salão mudar.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="salon-year" className="text-sm text-muted-foreground whitespace-nowrap">
          Ano de referência
        </Label>
        <Input
          id="salon-year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28"
          min={2020}
          max={2035}
        />
      </div>

      <UploadDropzone
        onFile={handleFile}
        fileName={file?.name ?? null}
        loading={loading}
        description='Planilha do salão com colunas: Semana, Contatos Whatsapp, Agendamentos, Agendamentos com serviço, TM, Total.'
      />

      {file && !loading && (
        <Button onClick={handleSave} className="w-full">
          Salvar dados do salão
        </Button>
      )}

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
    </div>
  );
}
