import arcjet, { shield, detectBot } from "@arcjet/node";

if (!process.env.ARCJET_KEY && process.env.NODE_ENV !== "test") {
    throw new Error(
      "ARCJET_KEY environment variable is required."
    );
  }

/** Comma-separated IPs/CIDRs of trusted load balancers so client IP uses X-Forwarded-For. */
const trustedProxies = process.env.ARCJET_TRUSTED_PROXIES
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const aj = arcjet({
    // Get your site key from https://app.arcjet.com and set it as an environment
    // variable rather than hard coding.
    key: process.env.ARCJET_KEY!,
    ...(trustedProxies?.length ? { proxies: trustedProxies } : {}),
    rules: [
      // Shield protects your app from common attacks e.g. SQL injection
      shield({ mode: "LIVE" }),
      // Create a bot detection rule
      detectBot({
        mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
        // Block all bots except the following
        allow: [
          "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
          // Uncomment to allow these other common bot categories
          // See the full list at https://arcjet.com/bot-list
          //"CATEGORY:MONITOR", // Uptime monitoring services
          "CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
        ],
      }),
    ],
  });

  export default aj;