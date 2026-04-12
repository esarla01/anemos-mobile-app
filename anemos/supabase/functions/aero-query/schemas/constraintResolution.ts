export function getConstraintResolutionInstructions(): string {
  return `### Schema 5: Constraint Resolution

**Use when:** A recommendation conflicts with a user's disclosed constraint (e.g., "avoid outdoors" when user works outdoors, or "rest" when user has a mandatory event).

**Output structure (follow exactly):**

I see the conflict: [your recommendation] vs. [user's constraint]
The reality: [constraint is non-negotiable / partially flexible]
New strategy:
- [What can't change]: Accept it — mitigate with [specific action]
- [What can change]: [Adjust timing / route / intensity / duration]
- [What can protect]: [Mask type / medication timing / recovery protocol]

**Rules:**
- Never repeat the conflicting recommendation as-is
- Always provide at least one concrete mitigation for the non-negotiable constraint
- Frame the constraint with respect — the user disclosed it for a reason
- If the constraint is job-related, focus on protection during exposure (mask, timing, breaks), not avoidance`
}
