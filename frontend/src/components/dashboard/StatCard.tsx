import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "primary" | "success" | "info" | "warning" | "neutral";
  hint?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-blue-50 text-primary",
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-sky-50 text-sky-600",
  warning: "bg-amber-50 text-amber-600",
  neutral: "bg-slate-100 text-slate-600",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", hint }: StatCardProps) {
  return (
    <Card className="p-5 transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="size-11 rounded-xl" />
      </div>
    </Card>
  );
}
