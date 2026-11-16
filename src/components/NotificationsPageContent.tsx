"use client";

import {
  getAdminNotificationsFeed,
  getNotificationsLastSeen,
  markNotificationsSeen,
  type AdminFeedItem,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { getStoredUser } from "@/lib/auth-storage";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CalendarCheck2,
  Cog,
  Database,
  LifeBuoy,
  Loader2,
  PoundSterling,
} from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/* ------------------------------------------------------------------ */
/* Notifications — the admin activity feed: bookings, payments,        */
/* support tickets, GDPR data requests and system activity, newest     */
/* first. Items newer than the last visit are marked "New"; opening    */
/* this page clears the bell + sidebar unread badges. Clicking an      */
/* item opens the page where it can be acted on.                       */
/* ------------------------------------------------------------------ */

const TYPE_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "booking", label: "Bookings" },
  { key: "payment", label: "Payments" },
  { key: "support", label: "Support" },
  { key: "data_request", label: "Data Requests" },
  { key: "system", label: "System" },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  booking: CalendarCheck2,
  payment: PoundSterling,
  support: LifeBuoy,
  data_request: Database,
  system: Cog,
};

const PAGE_SIZE = 20;

function relativeTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : formatDistanceToNow(d, { addSuffix: true });
}

export function NotificationsPageContent() {
  const queryClient = useQueryClient();
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminFeedItem[]>([]);
  // Snapshot of "last seen" taken when the page opened, so the New
  // markers stay visible during this visit even though opening the
  // page already cleared the badges.
  const [seenAt] = useState(() => getNotificationsLastSeen());

  const feedQuery = useQuery({
    queryKey: ["admin-notifications-feed", type, page],
    queryFn: () => getAdminNotificationsFeed({ type, page, limit: PAGE_SIZE }),
    retry: false,
  });

  useEffect(() => {
    if (!feedQuery.data) return;
    setItems((prev) => {
      if (page === 1) return feedQuery.data.items;
      const known = new Set(prev.map((item) => item.id));
      return [...prev, ...feedQuery.data.items.filter((item) => !known.has(item.id))];
    });
  }, [feedQuery.data, page]);

  // Opening the page marks everything as seen (bell + sidebar badges).
  useEffect(() => {
    markNotificationsSeen();
    queryClient.invalidateQueries({ queryKey: ["admin-notifications-unread"] });
  }, [queryClient]);

  // Live: new activity refreshes the first page and the unread count.
  useEffect(() => {
    const user = getStoredUser();
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-feed"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-unread"] });
    };
    socket.on("admin_booking_created", refresh);
    socket.on("admin_booking_status_updated", refresh);
    socket.on("admin_payout_updated", refresh);
    socket.on("admin_activity_log_created", refresh);
    socket.on("admin_ticket_created", refresh);
    socket.on("admin_ticket_updated", refresh);
    socket.on("admin_data_request_created", refresh);
    socket.on("admin_data_request_updated", refresh);
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const counts = feedQuery.data?.typeCounts ?? {};
  const total = feedQuery.data?.total ?? 0;
  const isFirstLoad = feedQuery.isLoading && page === 1;

  const changeType = (next: string) => {
    setType(next);
    setPage(1);
    setItems([]);
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Notifications</h1>
          <p>
            Booking, payment, support, data request, and system activity —
            newest first. Select any item to open the related page.
          </p>
        </div>
      </div>

      <div className="filter-pills" style={{ marginBottom: 14 }}>
        {TYPE_TABS.map((tab) => (
          <button
            className={type === tab.key ? "filter-pill active" : "filter-pill"}
            key={tab.key}
            onClick={() => changeType(tab.key)}
            type="button"
          >
            {tab.label}
            {typeof counts[tab.key] === "number" ? ` (${counts[tab.key]})` : ""}
          </button>
        ))}
      </div>

      {isFirstLoad ? (
        <div className="empty-state">
          <Loader2 size={22} /> Loading notifications...
        </div>
      ) : feedQuery.isError && page === 1 && !feedQuery.data ? (
        <div className="error-state">
          We could not load notifications. Please check your internet
          connection and try again.
          <button
            className="booking-filter-reset"
            onClick={() => feedQuery.refetch()}
            style={{ marginLeft: 10 }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          {type === "all"
            ? "No activity yet. New bookings, payments, tickets, and data requests will appear here."
            : "No activity of this type yet."}
        </div>
      ) : (
        <>
          <div className="notification-list">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type] || Bell;
              const isNew =
                item.createdAt &&
                new Date(item.createdAt).getTime() > seenAt;
              return (
                <article
                  className={`notification-card ${item.severity} nt-clickable`}
                  key={item.id}
                  onClick={() => {
                    if (item.link) window.location.href = item.link;
                  }}
                >
                  <span className={`nt-type-icon ${item.type}`}>
                    <Icon size={17} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <h2>
                      {item.title}
                      {isNew ? <span className="nt-new-pill">New</span> : null}
                    </h2>
                    <p>{item.message}</p>
                    <span>{relativeTime(item.createdAt)}</span>
                  </div>
                  {isNew ? <span className="nt-unread-dot" /> : null}
                </article>
              );
            })}
          </div>

          {items.length < total ? (
            <div className="nt-load-more">
              <button
                className="booking-filter-reset"
                disabled={feedQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                {feedQuery.isFetching ? (
                  <>
                    <Loader2 size={15} /> Loading…
                  </>
                ) : (
                  `Load more (${items.length} of ${total})`
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
