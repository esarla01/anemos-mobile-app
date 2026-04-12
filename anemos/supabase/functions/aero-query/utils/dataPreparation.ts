import type {
  AeroContext,
  SchemaDataMap,
  SchemaName,
  ThresholdAlertData,
  TemporalAvoidanceData,
  ActivitySubstitutionData,
  HealthCorrelationData,
  ConstraintResolutionData,
  DailyPeak,
} from "../types.ts"
import {
  deriveUserThreshold,
  extractActivity,
  classifyActivityIntensity,
  classifyActivityOutcome,
  computeSymptomPm25Threshold,
} from "./schemaIdentifier.ts"

// ─── Schema 1: Threshold Alert ────────────────────────────────────────────────

function prepareThresholdAlertData(
  userMessage: string,
  context: AeroContext
): ThresholdAlertData {
  const current_pm25 =
    context.exposure_summary.current?.pm2_5 ??
    context.exposure_summary.today.avg_pm2_5 ??
    0
  const user_threshold = deriveUserThreshold(context)
  const planned_activity = extractActivity(userMessage)
  const activity_intensity = classifyActivityIntensity(planned_activity)

  return {
    current_pm25: Math.round(current_pm25 * 10) / 10,
    user_threshold,
    planned_activity,
    activity_intensity,
  }
}

// ─── Schema 2: Temporal Avoidance ─────────────────────────────────────────────

function prepareTemporalAvoidanceData(
  userMessage: string,
  context: AeroContext
): TemporalAvoidanceData {
  const dailyPeakHours = context.exposure_summary.today.daily_peak_hours ?? []
  const user_threshold = deriveUserThreshold(context)
  const activity = extractActivity(userMessage)

  // Build daily_peaks array from stored daily peak hours
  const daily_peaks: DailyPeak[] = dailyPeakHours.map((d) => ({
    time: d.peak_time,
    value: d.peak_value,
    likely_source: d.likely_source,
  }))

  // Find the cleanest window across all days (lowest average best_value)
  const cleanestEntry = dailyPeakHours.reduce(
    (best, cur) => (cur.best_value < best.best_value ? cur : best),
    dailyPeakHours[0]
  )

  const cleanest_window = {
    time: cleanestEntry?.best_time ?? context.exposure_summary.today.best_hour ?? "early morning",
    value: cleanestEntry?.best_value ?? context.exposure_summary.today.avg_pm2_5 ?? 0,
  }

  // Infer schedule flexibility from user message
  let schedule_flexibility: TemporalAvoidanceData["schedule_flexibility"] = "somewhat_flexible"
  if (/flexible|any time|whenever|anytime/i.test(userMessage)) {
    schedule_flexibility = "very_flexible"
  } else if (/have to|must|fixed|scheduled|only time|can.?t change/i.test(userMessage)) {
    schedule_flexibility = "fixed"
  }

  return {
    activity,
    activity_duration_minutes: 45, // reasonable default; could be extracted from message
    schedule_flexibility,
    daily_peaks,
    cleanest_window,
    user_threshold,
  }
}

// ─── Schema 3: Activity Substitution ──────────────────────────────────────────

function prepareActivitySubstitutionData(
  userMessage: string,
  context: AeroContext
): ActivitySubstitutionData {
  const current_pm25 =
    context.exposure_summary.current?.pm2_5 ??
    context.exposure_summary.today.avg_pm2_5 ??
    0
  // Forecast: use today's peak as a conservative estimate
  const forecast_pm25 =
    context.exposure_summary.today.peak_pm2_5 ?? current_pm25
  const user_threshold = deriveUserThreshold(context)
  const desired_activity = extractActivity(userMessage)
  const activity_outcome = classifyActivityOutcome(desired_activity)

  // Derive alternatives from user profile health conditions and message context
  // In a future iteration these could be stored as user preferences
  const alternatives_available: string[] = []
  if (/gym|fitness|studio/i.test(userMessage)) alternatives_available.push("gym")
  if (/home|house|apartment/i.test(userMessage)) alternatives_available.push("home workout")
  if (alternatives_available.length === 0) {
    // Sensible defaults — nearly everyone can do these
    alternatives_available.push("home workout", "indoor gym")
  }

  return {
    desired_activity,
    current_pm25: Math.round(current_pm25 * 10) / 10,
    forecast_pm25: Math.round(forecast_pm25 * 10) / 10,
    user_threshold,
    alternatives_available,
    activity_outcome,
  }
}

// ─── Schema 4: Health Correlation ─────────────────────────────────────────────

function prepareHealthCorrelationData(
  context: AeroContext
): HealthCorrelationData {
  const { recent_logs, pattern_hints } = context.health_context

  // Identify the most commonly logged symptom at high PM2.5 levels
  const topSymptom = pattern_hints.most_common_symptoms[0] ?? "symptoms"

  // Count symptom instances from recent logs (full 7d available via pattern_hints)
  const symptomInstances = recent_logs.filter(
    (l) => l.symptoms.length > 0 && !l.symptoms.includes("No symptoms")
  ).length

  const symptom_pm25_threshold = computeSymptomPm25Threshold(recent_logs)

  // Identify other contributing factors from logs
  const other_factors: string[] = []
  const hasHighIntensityActivity = recent_logs.some(
    (l) => l.activity && /run|cycling|hike|soccer|basketball/i.test(l.activity)
  )
  if (hasHighIntensityActivity) other_factors.push("high-intensity activity")
  if (context.user_profile.allergies.some((a) => /pollen|grass|tree/i.test(a))) {
    other_factors.push("pollen")
  }

  // Confidence: high if 8+ instances, medium if 5–7
  const confidence: "high" | "medium" = symptomInstances >= 8 ? "high" : "medium"

  return {
    symptom: topSymptom,
    symptom_instances: symptomInstances,
    symptom_pm25_threshold,
    symptom_lag_minutes: 60, // clinical estimate; not tracked in current logs
    other_factors,
    confidence,
  }
}

// ─── Schema 5: Constraint Resolution ──────────────────────────────────────────

function prepareConstraintResolutionData(
  generatedRecommendation: string,
  context: AeroContext,
  conversationHistory: string
): ConstraintResolutionData {
  const historyLower = conversationHistory.toLowerCase()

  // Detect constraint type
  let constraint = "outdoor exposure"
  let constraint_type: ConstraintResolutionData["constraint_type"] = "schedule"
  let constraint_is_negotiable = false

  if (/outdoor.*(job|work)|work.*(outside|outdoors)|construction|landscap|farm/i.test(historyLower)) {
    constraint = "outdoor job"
    constraint_type = "job"
    constraint_is_negotiable = false
  } else if (/mandatory|required|can.?t skip|must/i.test(historyLower)) {
    constraint = "mandatory outdoor commitment"
    constraint_type = "schedule"
    constraint_is_negotiable = false
  } else if (/asthma|COPD|heart/i.test(context.user_profile.health_conditions.join(" "))) {
    constraint = "pre-existing respiratory/cardiovascular condition"
    constraint_type = "medical"
    constraint_is_negotiable = false
  }

  const alternatives = [
    "N95/KN95 mask during peak exposure hours",
    "Schedule outdoor tasks in the cleanest window of the day",
    "Take breaks indoors when PM2.5 spikes",
    "Use air purifier during indoor recovery time",
  ]

  return {
    conflicting_recommendation: generatedRecommendation.split("\n")[0], // first line
    constraint,
    constraint_type,
    constraint_is_negotiable,
    alternatives,
  }
}

// ─── Main Preparation Function ────────────────────────────────────────────────

export function prepareSchemaData(
  schemas: SchemaName[],
  userMessage: string,
  context: AeroContext,
  conversationHistory: string,
  generatedRecommendation?: string
): SchemaDataMap {
  const dataMap: SchemaDataMap = {}

  for (const schema of schemas) {
    switch (schema) {
      case "ThresholdAlert":
        dataMap.ThresholdAlert = prepareThresholdAlertData(userMessage, context)
        break
      case "TemporalAvoidance":
        dataMap.TemporalAvoidance = prepareTemporalAvoidanceData(userMessage, context)
        break
      case "ActivitySubstitution":
        dataMap.ActivitySubstitution = prepareActivitySubstitutionData(userMessage, context)
        break
      case "HealthCorrelation":
        dataMap.HealthCorrelation = prepareHealthCorrelationData(context)
        break
      case "ConstraintResolution":
        if (generatedRecommendation) {
          dataMap.ConstraintResolution = prepareConstraintResolutionData(
            generatedRecommendation,
            context,
            conversationHistory
          )
        }
        break
    }
  }

  return dataMap
}
