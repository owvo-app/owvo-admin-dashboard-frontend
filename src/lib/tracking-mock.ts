// ─────────────────────────────────────────────────────────────
// MOCK DATA — Live Tracking page (frontend design phase)
// TODO(backend): replace with GET /admin/tracking/live
//   Response: { stats, bookings: [{ id, status, washer, customer,
//             service, price, eta, washerLat, washerLng,
//             customerLat, customerLng }] }
//   Poll every 15–30s, or socket event "tracking_update".
// ─────────────────────────────────────────────────────────────

export type TrackingStatus =
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress";

export type WasherStatus = "online" | "busy" | "offline";
export type TravelMode = "washer_to_customer" | "customer_to_washer";

export interface TrackingBooking {
  id: string;
  status: TrackingStatus;
  washerStatus: WasherStatus;
  travelMode: TravelMode;
  service: string;
  price: number;
  washerName: string;
  washerPhone: string;
  customerName: string;
  address: string;
  eta: string;
  startedAt: string;
  // Washer (provider) live position
  washerLat: number;
  washerLng: number;
  // Customer / job location
  customerLat: number;
  customerLng: number;
  // Real API se — optional
  distanceMiles?: number;
  hasLiveCustomer?: boolean;
}

export interface TrackingStats {
  activeBookings: number;
  washersOnline: number;
  inProgress: number;
  completedToday: number;
  customersTravelling: number;
}

export const trackingStats: TrackingStats = {
  activeBookings: 6,
  washersOnline: 14,
  inProgress: 2,
  completedToday: 38,
  customersTravelling: 3,
};

// Central London + surrounding areas
export const trackingBookings: TrackingBooking[] = [
  {
    id: "BK-8041",
    status: "on_the_way",
    washerStatus: "busy",
    travelMode: "washer_to_customer",
    service: "Essential Wash",
    price: 32,
    washerName: "Fahad Iqbal",
    washerPhone: "+44 7700 900123",
    customerName: "Sarah Mitchell",
    address: "24 High Street, Camden, London NW1",
    eta: "12 min",
    startedAt: "11:04",
    washerLat: 51.5416,
    washerLng: -0.1443,
    customerLat: 51.5512,
    customerLng: -0.1401,
  },
  {
    id: "BK-8042",
    status: "in_progress",
    washerStatus: "busy",
    travelMode: "washer_to_customer",
    service: "Deluxe Wash",
    price: 55,
    washerName: "James Carter",
    washerPhone: "+44 7700 900456",
    customerName: "Amelia Hart",
    address: "8 Baker Street, Marylebone, London NW1",
    eta: "—",
    startedAt: "10:32",
    washerLat: 51.5237,
    washerLng: -0.1585,
    customerLat: 51.5239,
    customerLng: -0.1587,
  },
  {
    id: "BK-8043",
    status: "arrived",
    washerStatus: "busy",
    travelMode: "washer_to_customer",
    service: "Essential Wash",
    price: 32,
    washerName: "Daniel Osei",
    washerPhone: "+44 7700 900789",
    customerName: "Olivia Bennett",
    address: "112 Shoreditch High St, London E1",
    eta: "—",
    startedAt: "11:12",
    washerLat: 51.5256,
    washerLng: -0.0753,
    customerLat: 51.5258,
    customerLng: -0.0755,
  },
  {
    id: "BK-8044",
    status: "on_the_way",
    washerStatus: "busy",
    travelMode: "customer_to_washer",
    service: "Premium Wash",
    price: 75,
    washerName: "Tariq Mehmood",
    washerPhone: "+44 7700 900321",
    customerName: "George Walker",
    address: "45 Greenwich Church St, London SE10",
    eta: "18 min",
    startedAt: "11:08",
    washerLat: 51.4812,
    washerLng: -0.0098,
    customerLat: 51.4778,
    customerLng: -0.0105,
  },
  {
    id: "BK-8045",
    status: "accepted",
    washerStatus: "online",
    travelMode: "washer_to_customer",
    service: "Essential Wash",
    price: 32,
    washerName: "Sophie Lane",
    washerPhone: "+44 7700 900654",
    customerName: "Harry Thompson",
    address: "3 Clapham High St, London SW4",
    eta: "25 min",
    startedAt: "11:18",
    washerLat: 51.4651,
    washerLng: -0.1298,
    customerLat: 51.4627,
    customerLng: -0.1382,
  },
  {
    id: "BK-8046",
    status: "in_progress",
    washerStatus: "busy",
    travelMode: "customer_to_washer",
    service: "Deluxe Wash",
    price: 55,
    washerName: "Bilal Ahmed",
    washerPhone: "+44 7700 900987",
    customerName: "Isabella Cruz",
    address: "19 Stratford Broadway, London E15",
    eta: "—",
    startedAt: "10:47",
    washerLat: 51.5419,
    washerLng: -0.0025,
    customerLat: 51.5421,
    customerLng: -0.0027,
  },
];

// ── Bottom cards (mock) ──────────────────────────────────
export const providerStatusData = {
  total: 46,
  online: 23,
  busy: 8,
  offline: 18,
};

export interface HourlyStat {
  hour: string;
  completed: number;
  active: number;
  cancelled: number;
}

export const bookingStatsHourly: HourlyStat[] = [
  { hour: "6", completed: 2, active: 1, cancelled: 0 },
  { hour: "8", completed: 5, active: 3, cancelled: 1 },
  { hour: "10", completed: 9, active: 5, cancelled: 1 },
  { hour: "12", completed: 14, active: 8, cancelled: 2 },
  { hour: "14", completed: 18, active: 10, cancelled: 2 },
  { hour: "16", completed: 24, active: 12, cancelled: 3 },
  { hour: "18", completed: 15, active: 8, cancelled: 2 },
  { hour: "20", completed: 8, active: 4, cancelled: 1 },
  { hour: "22", completed: 3, active: 2, cancelled: 0 },
];

export const topAreas = [
  { name: "Orpington", bookings: 28 },
  { name: "Bromley", bookings: 24 },
  { name: "Chislehurst", bookings: 18 },
  { name: "Petts Wood", bookings: 15 },
  { name: "Swanley", bookings: 12 },
];

export interface ActivityItem {
  time: string;
  text: string;
  color: "red" | "blue" | "green";
}

export const recentActivity: ActivityItem[] = [
  { time: "10:16", text: "Sarah A. started travelling to provider", color: "red" },
  { time: "10:12", text: "New booking #OW10234", color: "blue" },
  { time: "10:10", text: "Provider Ali R. went Online", color: "green" },
  { time: "10:08", text: "Booking #OW10229 completed (£20)", color: "green" },
  { time: "10:05", text: "Provider Fatima H. accepted booking", color: "green" },
  { time: "10:02", text: "New customer registered", color: "red" },
];

export const statusMeta: Record<
  TrackingStatus,
  { label: string; color: string; bg: string }
> = {
  accepted: { label: "Accepted", color: "#8a6d00", bg: "#fff7d6" },
  on_the_way: { label: "On the way", color: "#0b5ed7", bg: "#e3efff" },
  arrived: { label: "Arrived", color: "#7a4fd0", bg: "#efe6ff" },
  in_progress: { label: "In progress", color: "#0a9a45", bg: "#ddf5e5" },
};
