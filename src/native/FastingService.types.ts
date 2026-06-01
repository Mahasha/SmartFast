/**
 * Args for the native fasting foreground service. All times are epoch millis.
 */
export type FastingServiceConfig = {
  /** UTC epoch ms of the fast's start — the count-up anchor in overtime. */
  startTimeMillis: number;
  /** UTC epoch ms of the planned goal — the count-down target before the goal. */
  goalTimeMillis: number;
  /** Human-readable plan label shown in the notification (e.g. "16:8"). */
  planName: string;
};
