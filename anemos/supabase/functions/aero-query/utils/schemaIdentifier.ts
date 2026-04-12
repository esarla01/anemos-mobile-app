import type { SchemaName, AeroContext, HealthLog } from "../types.ts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the user's personal PM2.5 threshold from health log patterns.
 * Falls back to the WHO guideline (15 μg/m³) if no pattern is found.
 */
export function deriveUserThreshold(context: AeroContext): number {
  const { recent_logs, pattern_hints } = context.health_context

  // Build a complete picture using all 7-day logs via pattern_hints
  const symptomLogs = recent_logs.filter(
    (l) => l.pm2_5_snapshot !== null && l.symptoms.length > 0 && !l.symptoms.includes("No symptoms")
  )

  if (symptomLogs.length >= 2) {
    const snaps = symptomLogs.map((l) => l.pm2_5_snapshot as number)
    const minSymptomPm25 = Math.min(...snaps)
    // Round to nearest 5 for a clean threshold
    return Math.max(10, Math.round(minSymptomPm25 / 5) * 5)
  }

  // If good wellbeing was logged at specific PM levels, use that as upper bound
  if (pattern_hints.best_wellbeing_pm2_5 !== null) {
    return Math.round(pattern_hints.best_wellbeing_pm2_5 / 5) * 5
  }

  return context.exposure_summary.who_guideline_pm2_5 // 15 μg/m³
}

/**
 * Extracts an activity keyword from the user message.
 */
export function extractActivity(message: string): string {
  const activityPatterns: Array<[RegExp, string]> = [
    [/\brunning?\b|\bjog(ging)?\b/i, "running"],
    [/\bwalk(ing)?\b/i, "walking"],
    [/\bcycling?\b|\bbik(ing|e)\b/i, "cycling"],
    [/\byoga\b/i, "yoga"],
    [/\bhik(ing|e)\b/i, "hiking"],
    [/\bswimming?\b/i, "swimming"],
    [/\bworkout\b|\bexercis(e|ing)\b/i, "exercising"],
    [/\bgym\b/i, "gym session"],
    [/\btennis\b/i, "tennis"],
    [/\bsoccer\b|\bfootball\b/i, "football"],
    [/\bbasketball\b/i, "basketball"],
  ]
  for (const [pattern, name] of activityPatterns) {
    if (pattern.test(message)) return name
  }
  return "outdoor activity"
}

/**
 * Classifies the intensity of an activity.
 */
export function classifyActivityIntensity(
  activity: string
): "low" | "medium" | "high" {
  const highIntensity = /running|cycling|hiking|swimming|soccer|basketball|tennis/i
  const lowIntensity = /walking|yoga|stretching/i
  if (highIntensity.test(activity)) return "high"
  if (lowIntensity.test(activity)) return "low"
  return "medium"
}

/**
 * Classifies the likely outcome / benefit the user wants from an activity.
 */
export function classifyActivityOutcome(activity: string): string {
  if (/running|cycling|hiking|soccer|basketball|swimming/i.test(activity))
    return "cardio and endurance"
  if (/yoga|stretching/i.test(activity)) return "flexibility and stress relief"
  if (/walking/i.test(activity)) return "light movement and fresh air"
  if (/gym|workout|exercise/i.test(activity)) return "full-body strength and conditioning"
  return "physical activity and wellbeing"
}

/**
 * Checks if an outdoor activity was mentioned in the message.
 */
function mentionsOutdoorActivity(message: string): boolean {
  return /run|walk|jog|cycl|bike|exercise|workout|hike|yoga|tennis|soccer|football|basketball/i.test(
    message
  )
}

/**
 * Computes a simple Pearson-like correlation between PM2.5 and symptom presence
 * using the recent health logs. Returns a value between 0 and 1.
 */
export function computeSymptomCorrelation(logs: HealthLog[]): number {
  const validLogs = logs.filter((l) => l.pm2_5_snapshot !== null)
  if (validLogs.length < 3) return 0

  const n = validLogs.length
  const x = validLogs.map((l) => l.pm2_5_snapshot as number)
  const y = validLogs.map((l) =>
    l.symptoms.length > 0 && !l.symptoms.includes("No symptoms") ? 1 : 0
  )

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  if (denomX === 0 || denomY === 0) return 0
  return Math.abs(num / Math.sqrt(denomX * denomY))
}

/**
 * Returns the PM2.5 level at which symptoms reliably cluster.
 */
export function computeSymptomPm25Threshold(logs: HealthLog[]): number {
  const symptomLogs = logs.filter(
    (l) =>
      l.pm2_5_snapshot !== null &&
      l.symptoms.length > 0 &&
      !l.symptoms.includes("No symptoms")
  )
  if (symptomLogs.length === 0) return 25 // default
  const snaps = symptomLogs.map((l) => l.pm2_5_snapshot as number)
  return Math.round(Math.min(...snaps) / 5) * 5
}

/**
 * Detects an outdoor-work or mandatory-outdoor constraint from user profile,
 * conversation history, or the latest message.
 */
function detectConstraint(
  context: AeroContext,
  conversationHistory: string
): string | null {
  const conditions = context.user_profile.health_conditions.join(" ").toLowerCase()
  const history = conversationHistory.toLowerCase()

  if (/outdoor.*(job|work|worker)|work.*(outside|outdoors)|construction|landscap|farm/i.test(history))
    return "works outdoors"
  if (/outdoor.*(job|work|worker)|work.*(outside|outdoors)|construction|landscap|farm/i.test(conditions))
    return "works outdoors"
  if (/can.?t (avoid|skip|miss)|have to|must|mandatory|required/i.test(history))
    return "mandatory outdoor commitment"
  return null
}

/**
 * Checks for conflict between a recommendation and disclosed constraints.
 */
function hasConstraintConflict(
  recommendation: string,
  context: AeroContext,
  conversationHistory: string
): boolean {
  const constraint = detectConstraint(context, conversationHistory)
  if (!constraint) return false

  const avoidsOutdoors = /avoid (outside|outdoors|outdoor|going out)|stay inside|stay indoors/i.test(
    recommendation
  )
  return avoidsOutdoors && constraint.includes("outdoor")
}

// ─── Main Identification Function ─────────────────────────────────────────────

export function identifyApplicableSchemas(
  userMessage: string,
  context: AeroContext,
  conversationHistory: string,
  generatedRecommendation?: string
): SchemaName[] {
  const schemas: SchemaName[] = []
  const msg = userMessage.toLowerCase()

  // ── Schema 1: Threshold Alert ──────────────────────────────────────────────
  if (
    /safe|go outside|can i|is it ok|okay to|should i go|is it safe|okay outside/i.test(msg)
  ) {
    schemas.push("ThresholdAlert")
  }

  // ── Schema 2: Temporal Avoidance ───────────────────────────────────────────
  // Requires: outdoor activity in message + 3+ days of daily peak data
  const dailyPeaks = context.exposure_summary.today.daily_peak_hours ?? []
  if (mentionsOutdoorActivity(msg) && dailyPeaks.length >= 3) {
    // Check if peaks are consistent (all within a 4-hour window)
    const peakHours = dailyPeaks.map((p) => parseInt(p.peak_time.split(":")[0]))
    const minPeak = Math.min(...peakHours)
    const maxPeak = Math.max(...peakHours)
    if (maxPeak - minPeak <= 4) {
      schemas.push("TemporalAvoidance")
    }
  }

  // ── Schema 3: Activity Substitution ───────────────────────────────────────
  // Requires: activity in message + current PM2.5 > user threshold
  const currentPm25 =
    context.exposure_summary.current?.pm2_5 ??
    context.exposure_summary.today.avg_pm2_5 ??
    0
  const userThreshold = deriveUserThreshold(context)

  if (mentionsOutdoorActivity(msg) && currentPm25 > userThreshold) {
    // Don't apply if Schema 2 already covers it (Schema 2 = timing fix, Schema 3 = substitution)
    // Apply Schema 3 when Temporal Avoidance is NOT applicable (no consistent daily peak)
    if (!schemas.includes("TemporalAvoidance")) {
      schemas.push("ActivitySubstitution")
    }
  }

  // ── Schema 4: Health Correlation ──────────────────────────────────────────
  const totalLogs = context.health_context.pattern_hints.total_logs_7d
  const correlationStrength = computeSymptomCorrelation(
    context.health_context.recent_logs
  )
  if (totalLogs >= 5 && correlationStrength > 0.6) {
    schemas.push("HealthCorrelation")
  }

  // ── Schema 5: Constraint Resolution ───────────────────────────────────────
  // Applied post-generation when recommendation conflicts with a constraint
  if (
    generatedRecommendation &&
    hasConstraintConflict(generatedRecommendation, context, conversationHistory)
  ) {
    schemas.push("ConstraintResolution")
  }

  // Priority order: 1 > 5 > 2 > 3 > 4
  const priority: SchemaName[] = [
    "ThresholdAlert",
    "ConstraintResolution",
    "TemporalAvoidance",
    "ActivitySubstitution",
    "HealthCorrelation",
  ]
  return priority.filter((s) => schemas.includes(s))
}
