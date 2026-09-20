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

export interface Booking {
  id: number;
  room_id: number;
  guest_name: string;
  phone: string;
  email: string;
  address: string | null;
  company_name: string | null;
  guest_gst_number: string | null;
  check_in: string;
  check_out: string;
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
  nights: number;
  amount: number;
  taxable: number;
  cgst_amount: number;
  sgst_amount: number;
  total: number;
  documents: BookingDocument[];
  created_at: string;
  updated_at: string;
  room: RoomSummary;
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
  email: string;
  address?: string | null;
  company_name?: string | null;
  guest_gst_number?: string | null;
  room_id: number;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: BookingStatus;
  check_in_time: string;
  check_out_time: string;
  payment_method: PaymentMethod;
  rate: number;
  discount: number;
};

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
