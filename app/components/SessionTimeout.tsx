"use client";

import { useEffect } from "react";
import { getAccessToken, logoutFromApi, SESSION_ACTIVITY_KEY, SESSION_IDLE_TIMEOUT_MS } from "../../lib/api-client";

/** Share real user activity across tabs; background API requests do not extend a session. */
export default function SessionTimeout() {
  useEffect(() => {
    let signingOut = false;
    let lastWrite = 0;

    function checkSession(activity = false) {
      if (signingOut || !getAccessToken()) return;
      const now = Date.now();
      const stored = Number(localStorage.getItem(SESSION_ACTIVITY_KEY));
      const lastActivity = Number.isFinite(stored) && stored > 0 ? stored : now;

      if (now - lastActivity >= SESSION_IDLE_TIMEOUT_MS) {
        signingOut = true;
        void logoutFromApi();
        window.location.replace("/");
        return;
      }

      if (!stored || (activity && now - lastWrite >= 1_000)) {
        localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
        lastWrite = now;
      }
    }

    const onActivity = () => checkSession(true);
    const onResume = () => checkSession();
    const onStorage = () => {
      if (!getAccessToken() && window.location.pathname.startsWith("/dashboard")) {
        window.location.replace("/");
      } else {
        checkSession();
      }
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(onResume, 1_000);
    checkSession();

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
