import { useCallback, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  loading?: boolean;
  fileName?: string | null;
  description?: string;
}

export function UploadDropzone({ onFile, loading, fileName, description }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={handleDrop}
      className={cn(
        "relative block cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all",
        "glass-card",
        dragOver
          ? "border-[oklch(0.88_0.18_92)] glow-gold scale-[1.01]"
          : "border-[oklch(0.83_0.16_88_/_0.3)] hover:border-[oklch(0.83_0.16_88_/_0.6)]",
        loading && "pointer-events-none opacity-70",
      )}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={loading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full gold-gradient blur-2xl opacity-30" />
          <div className="relative w-20 h-20 rounded-full gold-gradient flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-9 h-9 text-black animate-spin" strokeWidth={2.5} />
            ) : fileName ? (
              <FileText className="w-9 h-9 text-black" strokeWidth={2.5} />
            ) : (
              <Upload className="w-9 h-9 text-black" strokeWidth={2.5} />
            )}
          </div>
        </div>
        <div>
          <div className="font-display text-2xl font-semibold text-foreground">
            {loading
              ? "Processando seu CSV..."
              : fileName
                ? fileName
                : "Arraste seu CSV ou clique para selecionar"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {description ||
              "Aceitamos arquivos CSV exportados do Gerenciador de Anúncios do Meta. Todo o processamento acontece no seu navegador — seus dados não saem do dispositivo."}
          </p>
        </div>
      </div>
    </label>
  );
}
