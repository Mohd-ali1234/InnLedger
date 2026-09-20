import { useMemo, useState } from "react";
import { BedDouble, Plus, Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoomCard } from "@/components/rooms/RoomCard";
import { RoomFormModal } from "@/components/rooms/RoomFormModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ROOM_STATUSES, ROOM_TYPES } from "@/utils/constants";
import { useDeleteRoom, useRooms } from "@/hooks/useRooms";
import type { Room } from "@/types";

export default function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);

  const filtered = useMemo(() => {
    if (!rooms) return [];
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesSearch =
        !q ||
        room.room_number.toLowerCase().includes(q) ||
        room.room_name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || room.status === statusFilter;
      const matchesType = typeFilter === "all" || room.room_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rooms, search, statusFilter, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (room: Room) => {
    setEditing(room);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteRoom.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        subtitle="Manage your property's rooms, pricing, and availability."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Add Room
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by room number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
            <Select
              className="sm:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {ROOM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              className="sm:w-40"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <Skeleton className="mt-5 h-12 w-full" />
              <Skeleton className="mt-4 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchX : BedDouble}
          title={hasFilters ? "No rooms match your filters" : "No rooms yet"}
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Get started by adding your first room."
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={openCreate}>
                <Plus />
                Add Room
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "room" : "rooms"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((room) => (
              <RoomCard key={room.id} room={room} onEdit={openEdit} onDelete={setDeleting} />
            ))}
          </div>
        </>
      )}

      <RoomFormModal open={formOpen} room={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete room"
        description={`Are you sure you want to delete Room ${deleting?.room_number} (${deleting?.room_name})? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteRoom.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
