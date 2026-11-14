type Analytics = (
  command: "event",
  name: "waitlist_request_accepted",
  parameters: { signup_method: "direct_capture" },
) => void;

/** Counts accepted requests, including duplicates. Never identifies a member. */
export function trackWaitlistAccepted(analytics?: Analytics): boolean {
  try {
    const send = analytics ?? (typeof window === "undefined"
      ? undefined
      : (window as Window & { gtag?: Analytics }).gtag);
    if (typeof send !== "function") return false;
    send("event", "waitlist_request_accepted", { signup_method: "direct_capture" });
    return true;
  } catch {
    // Analytics being blocked or broken must not change the signup outcome.
    return false;
  }
}
