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

export default function WasherLocationMap({
  lat,
  lng,
  name,
  isOnline,
}: {
  lat: number | null;
  lng: number | null;
  name: string;
  isOnline: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }
    let map: google.maps.Map | null = null;
    let marker: google.maps.Marker | null = null;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!mapRef.current) return;
        const position = { lat, lng };
        map = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
        });
        marker = new google.maps.Marker({
          position,
          map,
          title: name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: isOnline ? "#22a355" : "#9aa0a6",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
        });
      })
      .catch((err) => setError(err?.message || "Failed to load map"));

    return () => {
      marker?.setMap(null);
    };
  }, [lat, lng, name, isOnline]);

  if (lat == null || lng == null) {
    return (
      <div className="washer-map-empty">
        <p>Location not available for this washer.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="washer-map-empty">
        <p>{error}</p>
      </div>
    );
  }

  return <div ref={mapRef} className="washer-map" />;
}
