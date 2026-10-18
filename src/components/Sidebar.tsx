"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import {
  canAccessMenu,
  type DashboardMenuKey,
} from "@/lib/dashboard-permissions";
import { initials } from "@/lib/format";
import {
  Bell,
  BadgePoundSterling,
  BarChart3,
  BookOpenCheck,
  Briefcase,
  CalendarCheck,
  ChevronRight,
  Database,
  GraduationCap,
  Gauge,
  Landmark,
  LifeBuoy,
  Radar,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  key: DashboardMenuKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  children?: { label: string; href: string; tab: string }[];
};

type NavSection = {
  label: string | null;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: null,
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: Gauge },
      { key: "bookings", label: "Bookings", href: "/bookings", icon: CalendarCheck },
      { key: "tracking", label: "Live Tracking", href: "/tracking", icon: Radar },
      { key: "reports", label: "Support & Disputes", href: "/support-disputes", icon: LifeBuoy, badge: 5 },
      { key: "payouts-payments", label: "Payments & Refunds", href: "/payouts-payments", icon: WalletCards },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { key: "washers", label: "Providers", href: "/washers", icon: UserRoundCheck },
      { key: "provider-verification", label: "Provider Verification", href: "/provider-verification", icon: ShieldCheck },
      { key: "customers", label: "Customers", href: "/customers", icon: UsersRound },
      { key: "reports", label: "Services & Pricing", href: "/reports", icon: BadgePoundSterling },
      {
        key: "washers",
        label: "Provider Opportunities",
        href: "/provider-opportunities",
        icon: Briefcase,
        children: [
          { label: "Campaigns", href: "/provider-opportunities?tab=campaigns", tab: "campaigns" },
          { label: "Promotions", href: "/provider-opportunities?tab=promotions", tab: "promotions" },
          { label: "Provider Progress", href: "/provider-opportunities?tab=progress", tab: "progress" },
          { label: "Bonus Payouts", href: "/provider-opportunities?tab=payouts", tab: "payouts" },
        ],
      },
      { key: "washers", label: "Training", href: "/training", icon: GraduationCap },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { key: "reports", label: "Reports & Analytics", href: "/reports-analytics", icon: BarChart3 },
      { key: "earnings", label: "Earnings", href: "/earnings", icon: Landmark },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { key: "data-requests", label: "Data Requests", href: "/data-requests", icon: Database },
      { key: "staff-management", label: "Staff Management", href: "/staff-management", icon: UsersRound },
      { key: "notifications", label: "Notifications", href: "/notifications", icon: Bell, badge: 3 },
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
      { key: "system-logs", label: "System Logs", href: "/system-logs", icon: BookOpenCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "campaigns";
  const user = useDashboardUser();
  const isStaff = user?.role === "staff";
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: isStaff
        ? section.items.filter((item) => canAccessMenu(user, item.key))
        : section.items,
    }))
    .filter((section) => section.items.length > 0);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const hasChildren = item.children && item.children.length > 0;
    return (
      <div key={item.href}>
        <Link
          className={active ? "sidebar-link active" : "sidebar-link"}
          href={item.href}
        >
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
          {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
        </Link>
        {hasChildren && active && (
          <div className="sidebar-submenu">
            {item.children!.map((child) => {
              const childActive = currentTab === child.tab;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={childActive ? "sidebar-sublink active" : "sidebar-sublink"}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="brand" aria-label="OWVO">
        <span className="brand-mark" />
        <span className="brand-word">owvo</span>
      </div>

      {visibleSections.map((section, idx) => (
        <div key={section.label || `main-${idx}`}>
          {section.label ? (
            <div className="sidebar-section-label">{section.label}</div>
          ) : null}
          <nav className="sidebar-nav" aria-label={section.label || "Primary"}>
            {section.items.map(renderItem)}
          </nav>
        </div>
      ))}

      <Link className="sidebar-profile" href="/settings">
        <div className="avatar">{initials(user?.name || user?.email, "A")}</div>
        <div className="profile-copy">
          <p className="profile-name">{user?.name || user?.email || "OWVO Admin"}</p>
          <p className="profile-role">{user?.role === "staff" ? "Staff Operator" : "Admin"}</p>
          <p className="profile-status">
            <span className="online-dot" />
            Online
          </p>
        </div>
        <ChevronRight size={18} color="#dce5ef" />
      </Link>
    </aside>
  );
}