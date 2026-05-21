export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMailPolling } = await import("@/lib/jobs/poller");
    startMailPolling();
  }
}
