"use client";

import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useState } from "react";

export function OpportunitiesPageContent() {
  const dateRange = useDashboardDateRange();
  const [activeTab, setActiveTab] = useState("campaigns");

  const tabs = [
    { key: "campaigns", label: "Campaigns" },
    { key: "promotions", label: "Promotions" },
    { key: "progress", label: "Provider Progress" },
    { key: "payouts", label: "Bonus Payouts" },
  ];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Provider Opportunities</h1>
          <p>Create and manage booking targets, bonuses and promotional campaigns for providers.</p>
        </div>
        <div className="booking-header-actions">
          <button className="booking-filter-select" type="button">
            Oct 17, 2026 - Oct 23, 2026
          </button>
          <button className="booking-create-btn" type="button">
            + Create Opportunity
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="booking-filters" style={{ gap: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={activeTab === t.key ? "booking-create-btn" : "booking-filter-reset"}
            style={activeTab === t.key ? {} : { border: "1px solid #e5e7eb" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content - Step 2+ will fill these */}
      <div className="table-card" style={{ padding: 40, textAlign: "center", color: "#888" }}>
        {activeTab === "campaigns" && "Step 2: Stat cards + table ayenge"}
        {activeTab === "promotions" && "Promotions tab — coming soon"}
        {activeTab === "progress" && "Provider Progress tab — coming soon"}
        {activeTab === "payouts" && "Bonus Payouts tab — coming soon"}
      </div>
    </section>
  );
}
