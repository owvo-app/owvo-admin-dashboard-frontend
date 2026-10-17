/// <reference types="google.maps" />
"use client";

import { useEffect, useRef, useState } from "react";

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

type WasherPin = {
  _id: string;
  name?: string;
  isOnline?: boolean;
  isBusy?: boolean;
  location?: { coordinates?: [number, number] };
};

export default function WashersMap({ washers }: { washers: WasherPin[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pins = washers.filter(
    (w) => w.location?.coordinates?.[0] != null && w.location?.coordinates?.[1] != null,
  );

  useEffect(() => {
    if (pins.length === 0) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }
    const markers: google.maps.Marker[] = [];
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!mapRef.current) return;
        const bounds = new google.maps.LatLngBounds();
        const map = new google.maps.Map(mapRef.current, {
          mapTypeControl: false,
          streetViewControl: false,
        });
        pins.forEach((w) => {
          const lng = w.location!.coordinates![0];
          const lat = w.location!.coordinates![1];
          const pos = { lat, lng };
          bounds.extend(pos);
          const color = w.isBusy ? "#2369e8" : w.isOnline ? "#22a355" : "#9aa0a6";
          const marker = new google.maps.Marker({
            position: pos,
            map,
            title: w.name || "Washer",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
          marker.addListener("click", () => {
            window.location.href = `/washers/${w._id}`;
          });
          markers.push(marker);
        });
        map.fitBounds(bounds);
      })
      .catch((err) => setError(err?.message || "Failed to load map"));

    return () => {
      markers.forEach((m) => m.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [washers]);

  if (pins.length === 0) {
    return null;
  }

  if (error) {
    return (
      <div className="washer-map-empty">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="washer-detail-map">
      <div ref={mapRef} className="washer-map" />
      <div className="washers-map-legend">
        <span><i style={{ background: "#22a355" }} /> Online</span>
        <span><i style={{ background: "#2369e8" }} /> Busy</span>
        <span><i style={{ background: "#9aa0a6" }} /> Offline</span>
      </div>
    </div>
  );
}
