export type RoomStatus = "available" | "occupied" | "maintenance";

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export interface Room {
  id: number;
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: number;
  floor: number;
  price: number;
  status: RoomStatus;
  created_at: string;
  updated_at: string;
}

export type RoomInput = {
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: number;
  floor: number;
  price: number;
  status: RoomStatus;
};

export interface RoomSummary {
  id: number;
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: number;
  price: number;
}

export const SERVICE_KEYS = [
  "food_beverages",
  "laundry",
  "miscellaneous",
  "taxi",
  "extra_person",
  "extra_bed",
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** Optional extra charges in rupees, before tax. */
export type ServiceCharges = Record<ServiceKey, number>;

export interface BookingRoom {
  room_id: number;
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: number;
  /** Per-night rate for this room, before tax. */
  rate: number;
}

export interface Booking {
  id: number;
  room_id: number;
  guest_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  company_name: string | null;
  guest_gst_number: string | null;
  check_in: string;
  /** null until the guest checks out. */
  check_out: string | null;
  guest_count: number;
  status: BookingStatus;
  check_in_time: string;
  check_out_time: string;
  payment_method: PaymentMethod;
  discount: number;
  cgst_percent: number;
  sgst_percent: number;
  /** Per-night price before tax. */
  effective_rate: number;
  /** Real check-out, or today while the guest is still staying. */
  effective_check_out: string;
  nights: number;
  amount: number;
  taxable: number;
  cgst_amount: number;
  sgst_amount: number;
  total: number;
  /** True once the invoice has been printed; the booking can no longer be deleted. */
  invoice_printed: boolean;
  services: ServiceCharges;
  /** Services before / including GST. */
  services_amount: number;
  services_total: number;
  /** Rooms + services, GST included — what the guest pays. */
  grand_total: number;
  documents: BookingDocument[];
  created_at: string;
  updated_at: string;
  /** First room (kept for older screens); see `rooms` for all of them. */
  room: RoomSummary;
  rooms: BookingRoom[];
  /** Room numbers joined for display, e.g. "101, 102". */
  room_numbers: string;
}

export interface BookingDocument {
  id: number;
  filename: string;
  content_type: string;
  size: number;
}

export type PaymentMethod = "Cash" | "Online" | "UPI" | "Card" | "Bank Transfer";

export type BookingInput = {
  guest_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  company_name?: string | null;
  guest_gst_number?: string | null;
  rooms: { room_id: number; rate: number }[];
  check_in: string;
  check_out?: string | null;
  guest_count?: number;
  status: BookingStatus;
  check_in_time: string;
  check_out_time?: string;
  payment_method: PaymentMethod;
  discount: number;
  services?: ServiceCharges;
};

export interface CheckoutInput {
  check_out: string;
  check_out_time: string;
}

export interface HotelSettings {
  hotel_name: string;
  tagline: string;
  address: string;
  mobile_numbers: string;
  gst_number: string;
  hsn_code: string;
  cgst_percent: number;
  sgst_percent: number;
  jurisdiction: string;
}


export interface DashboardStats {
  total_rooms: number;
  available_rooms: number;
  occupied_rooms: number;
  maintenance_rooms: number;
  total_bookings: number;
  todays_check_ins: number;
  todays_check_outs: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recent_bookings: Booking[];
}

export interface Admin {
  id: number;
  username: string;
}
