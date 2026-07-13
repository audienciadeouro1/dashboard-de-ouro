import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { PlugZap, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/server/clients";
import { saveClientMetaAccountId, testClientMetaConnection, syncClientMeta } from "@/lib/api";

type Feedback = { kind: "ok" | "err"; text: string } | null;

/** Marca da Meta (infinito). Usa currentColor para herdar a cor do botão. */
function MetaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="currentColor" aria-hidden="true">
      <path d="M349.4 128c-33.4 0-59.5 25.2-83 57.5-32.3-41-59.3-57.5-91.6-57.5C110.2 128 64 212.1 64 301.2c0 55.8 27 91 72.2 91 32.5 0 55.9-15.3 97.4-87.9 0 0 17.3-30.6 29.2-51.9 4.2 6.8 8.6 14.1 13.3 21.9l19.9 33.5c38.7 64.7 60.3 84.4 99.4 84.4 44 0 68.6-35.7 68.6-92.6 0-93.3-47.2-171.9-114.6-171.9zM175.2 259.6c-27.7 43.4-37.3 53.1-52.7 53.1-15.9 0-25.3-13.9-25.3-38.8 0-53.3 26.6-107.8 58.3-107.8 17.2 0 31.5 9.9 53.5 41.3-20.9 32-33.4 52.2-33.8 52.2zm155.1-8.1l-23.8-39.7c-6.4-10.5-12.6-20.1-18.6-28.9 21.7-33.5 39.6-50.2 60.9-50.2 44.2 0 79.6 65.1 79.6 145.1 0 30.5-10 48.2-30.7 48.2-19.8 0-29.3-13.1-67.4-74.6z" />
    </svg>
  );
}

export function MetaSyncPanel({ client }: { client: Client }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(client.metaAdAccountId ?? "");
  const [busy, setBusy] = useState<null | "save" | "test" | "sync">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function run<T>(
    kind: "save" | "test" | "sync",
    fn: () => Promise<T>,
    ok: (r: T) => string,
  ) {
    setBusy(kind);
    setFeedback(null);
    try {
      const r = await fn();
      setFeedback({ kind: "ok", text: ok(r) });
      await router.invalidate();
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Erro inesperado." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Meta Ads (atualização direta)</h2>
        <p className="text-sm text-muted-foreground">
          Busque as métricas dos últimos 30 dias direto da Meta. O CSV abaixo continua disponível
          como alternativa de emergência.
        </p>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="meta-account"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          ID da conta de anúncios
        </Label>
        <div className="flex gap-2">
          <Input
            id="meta-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="act_1234567890"
          />
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run(
                "save",
                () => saveClientMetaAccountId({ data: { clientId: client.id, accountId } }),
                () => "ID salvo.",
              )
            }
          >
            {busy === "save" ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="gap-2"
          disabled={busy !== null}
          onClick={() =>
            run(
              "test",
              () => testClientMetaConnection({ data: client.slug }),
              (r) => `Conexão OK: ${r.accountName}`,
            )
          }
        >
          <PlugZap className="w-4 h-4" /> {busy === "test" ? "Testando..." : "Testar conexão"}
        </Button>
        <Button
          className="gap-2 bg-[#0866FF] text-white hover:bg-[#0757db]"
          disabled={busy !== null}
          onClick={() =>
            run(
              "sync",
              () => syncClientMeta({ data: { slug: client.slug } }),
              (r) => `Pronto: ${r.days} dias / ${r.ads} anúncios (${r.start} a ${r.end}).`,
            )
          }
        >
          <MetaLogo className={`w-4 h-4 ${busy === "sync" ? "animate-pulse" : ""}`} />
          {busy === "sync" ? "Atualizando..." : "Atualizar via Meta"}
        </Button>
      </div>

      {client.lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          Última atualização: {client.lastSyncedAt} (UTC)
        </p>
      )}

      {feedback && (
        <p
          className={`flex items-center gap-2 text-sm ${
            feedback.kind === "ok" ? "text-emerald-400" : "text-destructive"
          }`}
        >
          {feedback.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {feedback.text}
        </p>
      )}
    </div>
  );
}
