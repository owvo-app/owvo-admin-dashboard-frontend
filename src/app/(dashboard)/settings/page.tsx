"use client";

import { ServiceAreasPageContent } from "@/components/ServiceAreasPageContent";
import { SettingsPageContent } from "@/components/SettingsPageContent";
import { useState } from "react";

export default function SettingsPage() {
  const [tab, setTab] = useState<"general" | "areas">("general");
  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Settings</h1>
          <p>Admin-controlled platform settings connected to the backend.</p>
        </div>
      </div>
      <div className="sa-tabs">
        <button
          type="button"
          className={`sa-tab ${tab === "general" ? "sa-tab-active" : ""}`}
          onClick={() => setTab("general")}
        >
          General
        </button>
        <button
          type="button"
          className={`sa-tab ${tab === "areas" ? "sa-tab-active" : ""}`}
          onClick={() => setTab("areas")}
        >
          Service Areas
        </button>
      </div>
      {tab === "general" ? <SettingsPageContent bareHeader /> : <ServiceAreasPageContent />}
    </section>
  );
}
