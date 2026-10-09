import { api } from "@/lib/api";

type ApiEnvelope<T> = { data: T };

// ── Real API types (GET /admin/tracking/live) ──────────────

export interface ApiTrackingBooking {
  id: string;
  status: string;
  service: string;
  price: number;
  washerName: string;
  washerPhone: string;
  washerStatus: "online" | "busy" | "offline";
  drivewayLat: number | null;
  drivewayLng: number | null;
  drivewayAddress: string;
  customerName: string;
  customerLat: number | null;
  customerLng: number | null;
  customerLocationUpdatedAt: string | null;
  etaMinutes: number | null;
  distanceMiles: number | null;
  address: string;
  startedAt: string;
}

export interface TrackingLiveData {
  stats: {
    activeBookings: number;
    washersOnline: number;
    inProgress: number;
    completedToday: number;
    customersTravelling: number;
  };
  bookings: ApiTrackingBooking[];
  providerStatus: {
    total: number;
    online: number;
    busy: number;
    offline: number;
  };
  topAreas: Array<{ name: string; bookings: number }>;
  recentActivity: Array<{
    time: string;
    text: string;
    color: "red" | "blue" | "green";
  }>;
}

export type BookingStatsRange = "today" | "week" | "month";

export interface BookingStatsData {
  range: BookingStatsRange;
  buckets: Array<{
    label: string;
    completed: number;
    active: number;
    cancelled: number;
  }>;
  topAreas: Array<{ name: string; bookings: number }>;
}

export async function getBookingStats(
  range: BookingStatsRange = "today"
): Promise<BookingStatsData> {
  const response = await api.get<ApiEnvelope<BookingStatsData>>(
    `/admin/tracking/booking-stats?range=${range}`
  );
  return response.data.data;
}

export async function getTrackingLive(): Promise<TrackingLiveData> {
  const response = await api.get<ApiEnvelope<TrackingLiveData>>(
    "/admin/tracking/live"
  );
  return response.data.data;
}

// ── Google Directions (Map Standard: real road route, traffic-aware) ──

export interface RouteResult {
  points: Array<{ lat: number; lng: number }>;
  etaMinutes: number | null;
  distanceMiles: number | null;
}

const routeCache = new Map<string, RouteResult>();

/**
 * Customer → driveway ka real driving route (traffic-aware).
 * google.maps.DirectionsService use hota hai (browser-safe, CORS-free).
 * Cache: same booking + ~100m grid par dobara API call nahi.
 */
export function fetchDrivingRoute(
  bookingId: string,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  const key = `${bookingId}:${fromLat.toFixed(3)},${fromLng.toFixed(3)}`;
  const cached = routeCache.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    if (typeof google === "undefined" || !google.maps) {
      resolve(null);
      return;
    }
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: toLat, lng: toLng },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result?.routes?.[0]?.legs?.[0]) {
          resolve(null);
          return;
        }
        const leg = result.routes[0].legs[0];
        const routeResult: RouteResult = {
          points: result.routes[0].overview_path.map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          })),
          etaMinutes: leg.duration_in_traffic
            ? Math.round(leg.duration_in_traffic.value / 60)
            : leg.duration
              ? Math.round(leg.duration.value / 60)
              : null,
          distanceMiles: leg.distance
            ? Math.round((leg.distance.value / 1609.344) * 10) / 10
            : null,
        };
        if (routeCache.size > 50) routeCache.clear();
        routeCache.set(key, routeResult);
        resolve(routeResult);
      }
    );
  });
}
