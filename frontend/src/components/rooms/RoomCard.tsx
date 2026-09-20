import { BedDouble, Layers, Pencil, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RoomStatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/utils/format";
import type { Room } from "@/types";

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <BedDouble className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Room {room.room_number}
            </p>
            <h3 className="text-sm font-semibold text-foreground">{room.room_name}</h3>
          </div>
        </div>
        <RoomStatusBadge status={room.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 border-y border-border bg-slate-50/60 px-5 py-3 text-center">
        <Meta icon={Layers} label="Type" value={room.room_type} />
        <Meta icon={Users} label="Capacity" value={`${room.capacity}`} />
        <Meta icon={Layers} label="Floor" value={`${room.floor}`} />
      </div>

      <div className="flex items-center justify-between p-5 pt-4">
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">
            {formatCurrency(room.price)}
          </p>
          <p className="text-xs text-muted-foreground">per night</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(room)}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-red-50 hover:text-destructive"
            aria-label={`Delete room ${room.room_number}`}
            onClick={() => onDelete(room)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="truncate text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
