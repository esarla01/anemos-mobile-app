export function getActivitySubstitutionInstructions(): string {
  return `### Schema 3: Activity Substitution

**Use when:** The user wants to do an outdoor activity today but current or forecast PM2.5 exceeds their threshold.

**Output structure (follow exactly):**

Not today: [activity] — PM2.5 is [current value] μg/m³ vs. your [threshold] μg/m³ limit
Instead: [specific indoor alternative, e.g., "yoga at home" or "treadmill at the gym"]
You still get: [the same outcome the user wanted, e.g., "the cardio hit without the lung load"]

**Rules:**
- Match the alternative closely to the desired outcome (cardio → indoor cardio, not stretching)
- Reference only alternatives that are listed as available in the data
- If no alternatives are available, say so honestly and suggest a protective fallback (mask + timing)
- Do not suggest "go outside anyway" or any advice that contradicts the threshold exceedance`
}
