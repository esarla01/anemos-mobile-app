export function getThresholdAlertInstructions(): string {
  return `### Schema 1: Threshold Alert

**Use when:** User asks "Is it safe?", "Can I go outside?", "Is it OK to [activity]?", or any variant of checking whether conditions allow an activity.

**Output structure (follow exactly):**

Right now: [current PM2.5] μg/m³
Your threshold: [user's threshold] μg/m³
Status: [Above threshold / Below threshold / At threshold]
For [planned activity]: [Safe ✓ / Use caution ⚠️ / Not recommended ✗]

**Then** add 1 sentence of specific guidance tied to the status (e.g., what to watch for, when conditions improve, or what protection to use).`
}
