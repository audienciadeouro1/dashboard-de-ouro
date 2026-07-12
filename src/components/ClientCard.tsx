import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import type { Client } from "@/lib/server/clients";
import { ANALYSIS_MODES } from "@/lib/csv/types";
import { cn } from "@/lib/utils";

function profileLabel(profile: Client["dashboardProfile"]): string {
  return ANALYSIS_MODES.find((m) => m.id === profile)?.label ?? profile;
}

function formatDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const last = new Date(lastSyncedAt.replace(" ", "T") + "Z").getTime();
  return Date.now() - last > 7 * 24 * 3600 * 1000;
}

export function ClientCard({ client }: { client: Client }) {
  const stale = isStale(client.lastSyncedAt);
  return (
    <Link
      to="/dashboard/$clientSlug"
      params={{ clientSlug: client.slug }}
      className={cn(
        "glass-card rounded-xl p-6 flex flex-col gap-3 transition-transform hover:scale-[1.02]",
        "border",
        stale ? "border-[oklch(0.78_0.16_60_/_0.4)]" : "border-[oklch(0.83_0.16_88_/_0.2)]",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{client.name}</h3>
        {stale && <AlertTriangle className="w-4 h-4 text-[oklch(0.85_0.16_60)]" />}
      </div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {profileLabel(client.dashboardProfile)}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarCheck className="w-4 h-4" />
        {client.lastSyncedAt ? `Dados até ${formatDate(client.lastSyncedAt)}` : "Sem dados ainda"}
      </div>
    </Link>
  );
}
