"use client";

import { getAdminMe } from "@/lib/admin-api";
import {
  clearDashboardSession,
  hydrateDashboardSession,
  storeDashboardSession,
} from "@/lib/auth-storage";
import {
  canAccessPath,
  getDefaultDashboardHref,
} from "@/lib/dashboard-permissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  // Backend verification sirf pehli baar — har tab switch par nahi.
  const verifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (pathname === "/login") {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const session = hydrateDashboardSession();
    if (!session.token) {
      router.replace("/login");
      return () => {
        cancelled = true;
      };
    }

    // Pehli baar: backend se user verify karo (login ke baad ya page reload par)
    if (!verifiedRef.current) {
      const token = session.token;
      setReady(false);

      getAdminMe()
        .then((user) => {
          if (cancelled) return;
          verifiedRef.current = true;
          storeDashboardSession({
            accessToken: token,
            user,
          });

          if (!canAccessPath(user, pathname)) {
            router.replace(getDefaultDashboardHref(user));
            return;
          }

          setReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          clearDashboardSession();
          router.replace("/login");
        });

      return () => {
        cancelled = true;
      };
    }

    // Tab switch: sirf local permission check — koi API call nahi, koi white flash nahi.
    const storedUser = session.user;
    if (storedUser && !canAccessPath(storedUser, pathname)) {
      router.replace(getDefaultDashboardHref(storedUser));
    }
    // `ready` pehle se true hy — screen white nahi hogi.

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return null;
  }

  return children;
}
