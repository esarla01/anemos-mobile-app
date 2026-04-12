import { getThresholdAlertInstructions } from "./thresholdAlert.ts"
import { getTemporalAvoidanceInstructions } from "./temporalAvoidance.ts"
import { getActivitySubstitutionInstructions } from "./activitySubstitution.ts"
import { getHealthCorrelationInstructions } from "./healthCorrelation.ts"
import { getConstraintResolutionInstructions } from "./constraintResolution.ts"
import type { SchemaName } from "../types.ts"

export function getSchemaInstructions(schema: SchemaName): string {
  switch (schema) {
    case "ThresholdAlert":
      return getThresholdAlertInstructions()
    case "TemporalAvoidance":
      return getTemporalAvoidanceInstructions()
    case "ActivitySubstitution":
      return getActivitySubstitutionInstructions()
    case "HealthCorrelation":
      return getHealthCorrelationInstructions()
    case "ConstraintResolution":
      return getConstraintResolutionInstructions()
  }
}

export {
  getThresholdAlertInstructions,
  getTemporalAvoidanceInstructions,
  getActivitySubstitutionInstructions,
  getHealthCorrelationInstructions,
  getConstraintResolutionInstructions,
}
