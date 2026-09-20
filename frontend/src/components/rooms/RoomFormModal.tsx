import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { ROOM_STATUSES, ROOM_TYPES } from "@/utils/constants";
import { useCreateRoom, useUpdateRoom } from "@/hooks/useRooms";
import type { Room, RoomInput, RoomStatus } from "@/types";

interface RoomFormModalProps {
  open: boolean;
  room: Room | null;
  onClose: () => void;
}

type FormState = {
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: string;
  floor: string;
  price: string;
  status: RoomStatus;
};

const EMPTY: FormState = {
  room_number: "",
  room_name: "",
  room_type: ROOM_TYPES[0],
  capacity: "2",
  floor: "1",
  price: "",
  status: "available",
};

export function RoomFormModal({ open, room, onClose }: RoomFormModalProps) {
  const isEdit = Boolean(room);
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      room
        ? {
            room_number: room.room_number,
            room_name: room.room_name,
            room_type: room.room_type,
            capacity: String(room.capacity),
            floor: String(room.floor),
            price: String(room.price),
            status: room.status,
          }
        : EMPTY
    );
  }, [open, room]);

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.room_number.trim()) next.room_number = "Room number is required";
    if (!form.room_name.trim()) next.room_name = "Room name is required";
    if (!(Number(form.capacity) > 0)) next.capacity = "Capacity must be greater than 0";
    if (Number(form.floor) < 0 || form.floor === "") next.floor = "Enter a valid floor";
    if (!(Number(form.price) > 0)) next.price = "Price must be greater than 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: RoomInput = {
      room_number: form.room_number.trim(),
      room_name: form.room_name.trim(),
      room_type: form.room_type,
      capacity: Number(form.capacity),
      floor: Number(form.floor),
      price: Number(form.price),
      status: form.status,
    };

    if (isEdit && room) {
      updateRoom.mutate({ id: room.id, payload }, { onSuccess: onClose });
    } else {
      createRoom.mutate(payload, { onSuccess: onClose });
    }
  };

  const isSubmitting = createRoom.isPending || updateRoom.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Room" : "Add Room"}
      description={isEdit ? "Update the room details below." : "Create a new room for your property."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="room-form" isLoading={isSubmitting}>
            {isEdit ? "Save changes" : "Create room"}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Room Number" htmlFor="room_number" required error={errors.room_number}>
          <Input
            id="room_number"
            value={form.room_number}
            onChange={(e) => set("room_number", e.target.value)}
            placeholder="e.g. 101"
            aria-invalid={Boolean(errors.room_number)}
          />
        </Field>

        <Field label="Room Name" htmlFor="room_name" required error={errors.room_name}>
          <Input
            id="room_name"
            value={form.room_name}
            onChange={(e) => set("room_name", e.target.value)}
            placeholder="e.g. Deluxe King"
            aria-invalid={Boolean(errors.room_name)}
          />
        </Field>

        <Field label="Room Type" htmlFor="room_type" required>
          <Select id="room_type" value={form.room_type} onChange={(e) => set("room_type", e.target.value)}>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="status" required>
          <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
            {ROOM_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Capacity" htmlFor="capacity" required error={errors.capacity}>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            aria-invalid={Boolean(errors.capacity)}
          />
        </Field>

        <Field label="Floor" htmlFor="floor" required error={errors.floor}>
          <Input
            id="floor"
            type="number"
            min={0}
            value={form.floor}
            onChange={(e) => set("floor", e.target.value)}
            aria-invalid={Boolean(errors.floor)}
          />
        </Field>

        <Field label="Price per night (₹)" htmlFor="price" required error={errors.price}>
          <Input
            id="price"
            type="number"
            min={1}
            step="0.01"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="129"
            aria-invalid={Boolean(errors.price)}
          />
        </Field>
      </form>
    </Modal>
  );
}
