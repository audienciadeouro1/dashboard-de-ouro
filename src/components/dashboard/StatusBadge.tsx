import type { Status } from "@/lib/csv/diagnostics";
import { STATUS_LABELS } from "@/lib/csv/diagnostics";
import { cn } from "@/lib/utils";
import { Rocket, Wrench, Pause, Eye, HelpCircle } from "lucide-react";

const STATUS_STYLES: Record<
  Status,
  { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  scale: {
    bg: "bg-[oklch(0.72_0.18_150_/_0.15)]",
    text: "text-[oklch(0.78_0.18_150)]",
    border: "border-[oklch(0.72_0.18_150_/_0.4)]",
    icon: Rocket,
  },
  optimize: {
    bg: "bg-[oklch(0.78_0.16_60_/_0.15)]",
    text: "text-[oklch(0.85_0.16_60)]",
    border: "border-[oklch(0.78_0.16_60_/_0.4)]",
    icon: Wrench,
  },
  pause: {
    bg: "bg-[oklch(0.65_0.22_25_/_0.15)]",
    text: "text-[oklch(0.78_0.18_25)]",
    border: "border-[oklch(0.65_0.22_25_/_0.4)]",
    icon: Pause,
  },
  monitor: {
    bg: "bg-[oklch(0.83_0.16_88_/_0.1)]",
    text: "text-[oklch(0.83_0.16_88)]",
    border: "border-[oklch(0.83_0.16_88_/_0.3)]",
    icon: Eye,
  },
  insufficient: {
    bg: "bg-[oklch(0.4_0_0)]",
    text: "text-muted-foreground",
    border: "border-[oklch(0.4_0_0)]",
    icon: HelpCircle,
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        s.bg,
        s.text,
        s.border,
      )}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABELS[status]}
    </span>
  );
}
