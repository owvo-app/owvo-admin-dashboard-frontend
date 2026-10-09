/// <reference types="google.maps" />
"use client";

import { useEffect, useRef } from "react";
import { fetchDrivingRoute } from "@/lib/tracking-api";
import {
  statusMeta,
  type TrackingBooking,
} from "@/lib/tracking-mock";

/** Google Maps JS API ko <script> tag se load karo (Loader class ke bajaye). */
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { google?: { maps?: unknown } }).google?.maps
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

// Marker colours — mockup legend scheme
const WASHER_COLORS: Record<string, string> = {
  online: "#22a355", // green — Provider (Online)
  busy: "#2369e8", // blue — Provider (Busy)
  offline: "#9aa0a6", // grey — Provider (Offline)
};
const CUSTOMER_COLOR = "#e5484d"; // red — Customer
const ROUTE_COLOR = "#2369e8"; // blue — routes

function pinSvg(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 15 31 15 31s15-20.5 15-31C33 7.7 26.3 1 18 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="18" y="20" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function washerSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 15 31 15 31s15-20.5 15-31C33 7.7 26.3 1 18 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(18,15)" fill="#fff">
      <path d="M-7 2 a7 7 0 0 1 14 0 v3 h-2 v-1 h-10 v1 h-2 z M-6 -3 h12 l2 3 h-16 z" transform="scale(0.9)"/>
      <circle cx="-4.5" cy="5" r="1.6"/><circle cx="4.5" cy="5" r="1.6"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function customerSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 15 31 15 31s15-20.5 15-31C33 7.7 26.3 1 18 1z" fill="${CUSTOMER_COLOR}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(18,15)" fill="#fff">
      <circle cx="0" cy="-3" r="3.2"/>
      <path d="M-5.5 7 c0-4 2.5-6 5.5-6 s5.5 2 5.5 6 z"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

interface Props {
  bookings: TrackingBooking[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TrackingMap({ bookings, selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const lines = useRef<google.maps.Polyline[]>([]);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Init map once
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current || mapObj.current) return;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapRef.current) return;
      mapObj.current = new google.maps.Map(mapRef.current, {
        center: { lat: 51.5074, lng: -0.1278 }, // London
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      infoWindow.current = new google.maps.InfoWindow();
      renderMarkers();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when bookings change
  useEffect(() => {
    if (mapObj.current) renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  // Pan to selected booking
  useEffect(() => {
    if (!selectedId || !mapObj.current) return;
    const b = bookings.find((x) => x.id === selectedId);
    if (b) {
      mapObj.current.panTo({ lat: b.washerLat, lng: b.washerLng });
      mapObj.current.setZoom(14);
      openInfo(b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function openInfo(b: TrackingBooking) {
    if (!infoWindow.current || !mapObj.current) return;
    const meta = statusMeta[b.status];
    infoWindow.current.setContent(`
      <div style="font-family:Arial,sans-serif;min-width:210px;padding:2px">
        <div style="font-weight:800;font-size:14px;margin-bottom:2px">${b.id} · ${b.service}</div>
        <div style="margin-bottom:6px"><span style="background:${meta.bg};color:${meta.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${meta.label}</span></div>
        <div style="font-size:12px;color:#444;margin-bottom:2px">🚗 <b>${b.washerName}</b> · ${b.washerPhone}</div>
        <div style="font-size:12px;color:#444;margin-bottom:2px">👤 ${b.customerName}</div>
        <div style="font-size:12px;color:#444;margin-bottom:2px">📍 ${b.address}</div>
        <div style="font-size:12px;color:#444">💷 £${b.price}</div>
        <div style="font-size:12px;color:#0b5ed7;font-weight:700;margin-top:2px">⏱ ETA ${b.eta}${b.distanceMiles != null ? ` · 🛣 ${b.distanceMiles} mi` : ""}</div>
      </div>
    `);
    infoWindow.current.setPosition({ lat: b.washerLat, lng: b.washerLng });
    infoWindow.current.open(mapObj.current);
  }

  function renderMarkers() {
    const map = mapObj.current;
    if (!map || typeof google === "undefined") return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];
    lines.current.forEach((l) => l.setMap(null));
    lines.current = [];
    const bounds = new google.maps.LatLngBounds();

    bookings.forEach((b, i) => {
      // Washer live position — colour by provider status
      const washerMarker = new google.maps.Marker({
        position: { lat: b.washerLat, lng: b.washerLng },
        map,
        title: `${b.washerName} (${b.washerStatus}, ${b.id})`,
        icon: {
          url: washerSvg(WASHER_COLORS[b.washerStatus] ?? WASHER_COLORS.online),
          scaledSize: new google.maps.Size(32, 42),
        },
        zIndex: 10,
      });
      washerMarker.addListener("click", () => {
        onSelect(b.id);
        openInfo(b);
      });
      markers.current.push(washerMarker);
      bounds.extend(washerMarker.getPosition()!);

      // Customer live location — red pin
      const custMarker = new google.maps.Marker({
        position: { lat: b.customerLat, lng: b.customerLng },
        map,
        title: `${b.customerName} (${b.id})`,
        icon: {
          url: customerSvg(),
          scaledSize: new google.maps.Size(32, 42),
        },
      });
      custMarker.addListener("click", () => {
        onSelect(b.id);
        openInfo(b);
      });
      markers.current.push(custMarker);
      bounds.extend(custMarker.getPosition()!);

      // Route: customer → washer driveway (real road route via Directions API)
      // Client ne confirm kiya: hamesha customer travel karta hai.
      drawRoute(map, b);
    });

    if (!selectedRef.current && bookings.length > 0) {
      map.fitBounds(bounds, 40);
    }
  }

  /** Customer → driveway: Directions API se real road route (dotted style) */
  function drawRoute(map: google.maps.Map, b: TrackingBooking) {
    const drawLine = (path: Array<{ lat: number; lng: number }>, dotted: boolean) => {
      if (!map) return;
      const line = new google.maps.Polyline({
        path,
        geodesic: !dotted,
        strokeColor: ROUTE_COLOR,
        strokeOpacity: dotted ? 0 : 0.85,
        strokeWeight: 4,
        icons: [
          ...(dotted
            ? [
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                    strokeColor: ROUTE_COLOR,
                  },
                  offset: "0",
                  repeat: "14px",
                },
              ]
            : []),
          {
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
            offset: "100%",
          },
        ],
      });
      line.setMap(map);
      lines.current.push(line);
    };

    const straight: Array<{ lat: number; lng: number }> = [
      { lat: b.customerLat, lng: b.customerLng },
      { lat: b.washerLat, lng: b.washerLng },
    ];

    // Pehle straight dotted line (instant), phir real route aane par replace
    drawLine(straight, true);

    fetchDrivingRoute(b.id, b.customerLat, b.customerLng, b.washerLat, b.washerLng).then(
      (route) => {
        if (!route || route.points.length < 2 || !mapObj.current) return;
        // Purani straight line hatao, real road route lagao
        const last = lines.current.pop();
        last?.setMap(null);
        drawLine(route.points, false);
      }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="tracking-map-fallback">
        <p className="tracking-map-fallback-title">Google Maps API key missing</p>
        <p>
          Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your{" "}
          <code>.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className="tracking-map" />;
}
