import type { AeroContext, ValidationResult } from "../types.ts"

// ─── Check: No Constraint Contradictions ──────────────────────────────────────

/**
 * Returns true if the recommendation tells a user to "avoid outdoors" but
 * their conversation history or profile indicates they cannot avoid it.
 */
export function hasConstraintConflict(
  recommendation: string,
  context: AeroContext,
  conversationHistory: string
): boolean {
  const avoidsOutdoors =
    /avoid (outside|outdoors|outdoor|going out)|stay inside|stay indoors|don.?t go outside/i.test(
      recommendation
    )
  if (!avoidsOutdoors) return false

  const historyLower = conversationHistory.toLowerCase()
  const conditionsLower = context.user_profile.health_conditions.join(" ").toLowerCase()

  return (
    /outdoor.*(job|work)|work.*(outside|outdoors)|construction|landscap|farm/i.test(historyLower) ||
    /outdoor.*(job|work)|work.*(outside|outdoors)/i.test(conditionsLower)
  )
}

// ─── Check: Specific Numbers / Times ──────────────────────────────────────────

/**
 * Returns true if the recommendation contains at least one specific PM2.5 value
 * or a time reference (e.g., "6am", "3:00pm", "before 8").
 */
export function hasSpecificValues(recommendation: string): boolean {
  const hasNumber = /\d+(\.\d+)?\s*(μg\/m³|µg\/m³|ug\/m3|μg|µg)/i.test(recommendation)
  const hasTime =
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b(before|after|around|by)\s+\d{1,2}(:\d{2})?\b|\b\d{1,2}:00\b/i.test(
      recommendation
    )
  return hasNumber || hasTime
}

// ─── Check: Actionable Without Research ───────────────────────────────────────

/**
 * Returns true if the recommendation contains at least one concrete action
 * the user can take without Googling further.
 */
export function isActionable(recommendation: string): boolean {
  return /\b(wear|use|take|avoid|go|try|switch|reschedule|stay|open|close|mask|air purifier|medication|inhaler|window|indoor|gym|home)\b/i.test(
    recommendation
  )
}

// ─── Full Validation ───────────────────────────────────────────────────────────

export function validateRecommendation(
  recommendation: string,
  context: AeroContext,
  conversationHistory: string
): ValidationResult {
  const failures: string[] = []

  if (hasConstraintConflict(recommendation, context, conversationHistory)) {
    failures.push("constraint_conflict: recommendation contradicts user's outdoor constraint")
  }

  if (!hasSpecificValues(recommendation)) {
    failures.push("no_specific_values: response lacks PM2.5 numbers or time references")
  }

  if (!isActionable(recommendation)) {
    failures.push("not_actionable: response contains no concrete actions")
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}
