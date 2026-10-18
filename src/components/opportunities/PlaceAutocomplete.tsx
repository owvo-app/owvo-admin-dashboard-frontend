"use client";

import { useEffect, useRef, useState } from "react";

let placesScriptPromise: Promise<void> | null = null;

function loadPlacesScript(apiKey: string): Promise<void> {
  if (placesScriptPromise) return placesScriptPromise;
  placesScriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const w = window as unknown as { google?: { maps?: { places?: unknown } } };
    if (w.google?.maps?.places) return resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&region=GB`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Places"));
    document.head.appendChild(script);
  });
  return placesScriptPromise;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function PlaceAutocomplete({ value, onChange, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ description: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key missing");
      return;
    }
    let cancelled = false;
    loadPlacesScript(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const w = window as any;
        const autocomplete = new w.google.maps.places.Autocomplete(inputRef.current, {
          types: ["(regions)"],
          componentRestrictions: { country: "gb" },
        });
        // Hide Google's own dropdown, we render our own
        const pacContainers = document.querySelectorAll(".pac-container");
        pacContainers.forEach((el) => ((el as HTMLElement).style.display = "none"));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load address suggestions");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const w = window as any;
      if (!w.google?.maps?.places) return;
      setLoading(true);
      const service = new w.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input, componentRestrictions: { country: "gb" }, types: ["(regions)"] },
        (predictions: Array<{ description: string }> | null) => {
          setLoading(false);
          setSuggestions(predictions || []);
          setShowSuggestions(true);
        }
      );
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className={className || "modal-input"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim().length >= 2 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="opp-places-dropdown">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                onChange(s.description);
                setShowSuggestions(false);
              }}
            >
              📍 {s.description}
            </button>
          ))}
        </div>
      )}
      {loading && <span className="table-sub" style={{ fontSize: 11 }}>Searching...</span>}
      {error && <p className="table-sub" style={{ color: "#d93025", fontSize: 11 }}>{error}</p>}
    </div>
  );
}
