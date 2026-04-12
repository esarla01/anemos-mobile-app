export function getHealthCorrelationInstructions(): string {
  return `### Schema 4: Health Correlation

**Use when:** The user's health logs show a symptom clustering at specific PM2.5 levels (5+ instances, confidence > 0.6).

**Output structure (follow exactly):**

Pattern: [symptom] clusters when PM2.5 is above [threshold] μg/m³
Why: [1-sentence mechanism — e.g., "particulates trigger airway inflammation, which compounds with [activity] breathing load"]
Your trigger level: [PM2.5 threshold where symptoms reliably appear]
Prevention: [specific, actionable step — e.g., "take [medication] 30 min before exposure" or "cut intensity by 50% above [X] μg/m³"]

**Rules:**
- Only state a correlation if confidence is "medium" or "high"
- Include lag time if relevant (e.g., "symptoms typically appear [X] min after exposure")
- Reference other contributing factors if present in the data (pollen, activity intensity)
- Do not over-claim causation — use "correlates with" or "clusters at", not "caused by"`
}
