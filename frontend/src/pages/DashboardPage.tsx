import {
  BedDouble,
  DoorOpen,
  CalendarCheck,
  LogIn,
  LogOut,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/StatCard";
import { RoomStatusOverview } from "@/components/dashboard/RoomStatusOverview";
import { RecentBookings } from "@/components/dashboard/RecentBookings";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboard } from "@/hooks/useDashboard";

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="A quick overview of your rooms and bookings today."
      />

      {isError && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load dashboard data. Please refresh the page.
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Rooms" value={data.stats.total_rooms} icon={BedDouble} tone="primary" />
            <StatCard label="Available Rooms" value={data.stats.available_rooms} icon={DoorOpen} tone="success" />
            <StatCard label="Occupied Rooms" value={data.stats.occupied_rooms} icon={Users} tone="info" />
            <StatCard label="Total Bookings" value={data.stats.total_bookings} icon={CalendarCheck} tone="neutral" />
            <StatCard label="Today's Check-ins" value={data.stats.todays_check_ins} icon={LogIn} tone="success" />
            <StatCard label="Today's Check-outs" value={data.stats.todays_check_outs} icon={LogOut} tone="warning" />
          </>
        )}
      </div>

      {/* Recent bookings + room status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isLoading || !data ? (
          <>
            <Card className="p-5 lg:col-span-2">
              <Skeleton className="h-5 w-40" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            </Card>
          </>
        ) : (
          <>
            <RecentBookings bookings={data.recent_bookings} />
            <RoomStatusOverview stats={data.stats} />
          </>
        )}
      </div>
    </div>
  );
}
