export function getTemporalAvoidanceInstructions(): string {
  return `### Schema 2: Temporal Avoidance

**Use when:** The user has a regular outdoor activity and 3+ days of hourly data show a consistent daily PM2.5 peak.

**Output structure (follow exactly):**

Avoid: [time window, e.g., "3pm–6pm"] because [source, e.g., "traffic emissions peak"]
Prefer: [alternative time window, e.g., "before 8am"] when [conditions, e.g., "PM2.5 averages [X] μg/m³"]
Why this matters for you: [1 sentence connecting to the user's specific activity or health context]

**Rules:**
- Use actual times and values from the daily_peaks data provided
- If the cleanest window conflicts with the user's schedule flexibility, acknowledge it and offer the next-best option
- Do not suggest a window without supporting data`
}
