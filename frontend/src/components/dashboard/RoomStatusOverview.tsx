import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DashboardStats } from "@/types";

interface Segment {
  label: string;
  value: number;
  barClass: string;
  dotClass: string;
}

export function RoomStatusOverview({ stats }: { stats: DashboardStats }) {
  const total = stats.total_rooms || 1;
  const segments: Segment[] = [
    {
      label: "Available",
      value: stats.available_rooms,
      barClass: "bg-emerald-500",
      dotClass: "bg-emerald-500",
    },
    {
      label: "Occupied",
      value: stats.occupied_rooms,
      barClass: "bg-blue-500",
      dotClass: "bg-blue-500",
    },
    {
      label: "Maintenance",
      value: stats.maintenance_rooms,
      barClass: "bg-amber-500",
      dotClass: "bg-amber-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stacked proportion bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {segments.map(
            (s) =>
              s.value > 0 && (
                <div
                  key={s.label}
                  className={s.barClass}
                  style={{ width: `${(s.value / total) * 100}%` }}
                  title={`${s.label}: ${s.value}`}
                />
              )
          )}
        </div>

        <div className="space-y-3">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`size-2.5 rounded-full ${s.dotClass}`} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
