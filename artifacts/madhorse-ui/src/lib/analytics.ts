type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void | Promise<unknown>;
    };
  }
}

/**
 * Replit's publishing proxy injects Umami when Publishing analytics is enabled.
 * Do not add a tracker script, website ID, or a second analytics transport here.
 * It is intentionally absent in local previews and analytics-disabled releases.
 * See https://docs.replit.com/features/publishing/project-analytics and
 * .local/skills/project-analytics/SKILL.md.
 * Optional telemetry must never interrupt an editor action.
 */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    void Promise.resolve(window.umami?.track(name, data)).catch(() => {});
  } catch {
    // Includes tracker errors and blocked/unavailable analytics.
  }
}
