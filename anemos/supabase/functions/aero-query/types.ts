// ─── Schema Names ─────────────────────────────────────────────────────────────

export type SchemaName =
  | "ThresholdAlert"
  | "TemporalAvoidance"
  | "ActivitySubstitution"
  | "HealthCorrelation"
  | "ConstraintResolution"

// ─── Schema Data Types ────────────────────────────────────────────────────────

export interface ThresholdAlertData {
  current_pm25: number
  user_threshold: number
  planned_activity: string
  activity_intensity: "low" | "medium" | "high"
}

export interface DailyPeak {
  time: string
  value: number
  likely_source?: string
}

export interface TemporalAvoidanceData {
  activity: string
  activity_duration_minutes: number
  schedule_flexibility: "very_flexible" | "somewhat_flexible" | "fixed"
  daily_peaks: DailyPeak[]
  cleanest_window: { time: string; value: number }
  user_threshold: number
}

export interface ActivitySubstitutionData {
  desired_activity: string
  current_pm25: number
  forecast_pm25: number
  user_threshold: number
  alternatives_available: string[]
  activity_outcome: string
}

export interface HealthCorrelationData {
  symptom: string
  symptom_instances: number
  symptom_pm25_threshold: number
  symptom_lag_minutes: number
  other_factors: string[]
  confidence: "high" | "medium"
}

export interface ConstraintResolutionData {
  conflicting_recommendation: string
  constraint: string
  constraint_type: "job" | "schedule" | "medical" | "equipment"
  constraint_is_negotiable: boolean
  alternatives: string[]
}

export interface SchemaDataMap {
  ThresholdAlert?: ThresholdAlertData
  TemporalAvoidance?: TemporalAvoidanceData
  ActivitySubstitution?: ActivitySubstitutionData
  HealthCorrelation?: HealthCorrelationData
  ConstraintResolution?: ConstraintResolutionData
}

// ─── Context Types (matching buildContext() in useAero.ts) ───────────────────

export interface DailyPeakHour {
  date: string
  peak_time: string
  peak_value: number
  best_time: string
  best_value: number
  likely_source?: string
}

export interface ExposureSummary {
  current: {
    pm1_0: number | null
    pm2_5: number | null
    pm10: number | null
    timestamp: string
  } | null
  today: {
    avg_pm2_5: number | null
    avg_pm1_0: number | null
    avg_pm10: number | null
    peak_pm2_5: number | null
    peak_hour: string | null
    best_hour: string | null
    daily_peak_hours?: DailyPeakHour[]
  }
  last7days: Array<{
    date: string
    avg_pm2_5: number
    avg_pm1_0: number
    avg_pm10: number
  }>
  who_guideline_pm2_5: number
}

export interface HealthLog {
  logged_at: string
  wellbeing: number
  symptoms: string[]
  activity: string | null
  pm2_5_snapshot: number | null
  notes_snippet: string | null
}

export interface HealthContext {
  recent_logs: HealthLog[]
  pattern_hints: {
    avg_wellbeing_7d: number | null
    most_common_symptoms: string[]
    worst_logged_pm2_5: number | null
    best_wellbeing_pm2_5: number | null
    total_logs_7d: number
  }
}

export interface UserProfileContext {
  age: number | null
  weight: number | null
  gender: string | null
  health_conditions: string[]
  allergies: string[]
  sensitivity_note: string | null
}

export interface Insights {
  current_vs_7d_avg_pct: number | null
  recent_symptom_at_this_level: boolean
  outdoor_activity_risk: "low" | "moderate" | "high" | "unknown"
  best_time_today: string | null
  who_exceedance_today: boolean
}

export interface AeroContext {
  exposure_summary: ExposureSummary
  health_context: HealthContext
  user_profile: UserProfileContext
  insights: Insights
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean
  failures: string[]
}
