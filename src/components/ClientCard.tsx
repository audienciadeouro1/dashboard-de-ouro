import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import type { Client } from "@/lib/server/clients";
import { ANALYSIS_MODES } from "@/lib/csv/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function profileLabel(profile: Client["dashboardProfile"]): string {
  return ANALYSIS_MODES.find((m) => m.id === profile)?.label ?? profile;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-11 w-11 border border-[oklch(0.83_0.16_88_/_0.3)]">
            {client.logoUrl && <AvatarImage src={client.logoUrl} alt={client.name} />}
            <AvatarFallback className="bg-[oklch(0.83_0.16_88_/_0.12)] text-[oklch(0.88_0.18_92)] text-sm font-semibold">
              {initials(client.name)}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold text-foreground truncate">{client.name}</h3>
        </div>
        {stale && <AlertTriangle className="w-4 h-4 shrink-0 text-[oklch(0.85_0.16_60)]" />}
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
