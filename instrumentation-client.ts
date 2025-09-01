import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: '2025-05-24',
  capture_exceptions: true, // This enables capturing exceptions using Error Tracking
  debug: process.env.NODE_ENV === "development",
  // Disable automatic pageview tracking until user is identified
  capture_pageview: false,
  // Keep session recording enabled but it will only work for identified users
  person_profiles: 'identified_only',
});
