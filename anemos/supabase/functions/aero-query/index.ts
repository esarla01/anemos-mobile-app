import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import type { AeroContext, SchemaName } from "./types.ts"
import { identifyApplicableSchemas } from "./utils/schemaIdentifier.ts"
import { prepareSchemaData } from "./utils/dataPreparation.ts"
import { buildSystemPrompt } from "./utils/systemPrompt.ts"
import { validateRecommendation } from "./utils/validation.ts"

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
const CLAUDE_MODEL = "claude-opus-4-6"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ─── Claude API Call ───────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error("Anthropic API error:", response.status, err)
    return { ok: false, error: `Anthropic ${response.status}: ${err}` }
  }

  const data = await response.json()
  const text: string = data?.content?.[0]?.text ?? ""
  return { ok: true, text }
}

// ─── Build User Message with Schema Context ────────────────────────────────────

function buildUserMessageWithSchemas(
  originalMessage: string,
  applicableSchemas: SchemaName[],
  schemaDataMap: ReturnType<typeof prepareSchemaData>
): string {
  if (applicableSchemas.length === 0) return originalMessage

  const schemaBlocks = applicableSchemas
    .map((schema) => {
      const data = schemaDataMap[schema]
      if (!data) return null
      return `### ${schema} Data\n${JSON.stringify(data, null, 2)}`
    })
    .filter(Boolean)
    .join("\n\n")

  return `${originalMessage}

---
[Schema context — use the data below to fill in the applicable schema templates]
Applicable schemas: ${applicableSchemas.join(", ")}

${schemaBlocks}`
}

// ─── Edge Function Entry Point ────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messages, context } = body as {
      messages: Array<{ role: string; content: string }>
      context?: AeroContext
    }

    // Fallback: no context → bare assistant, preserving existing behaviour
    if (!context) {
      const fallbackPrompt =
        "You are Aero, an AI assistant helping users understand their air quality exposure. Be concise and practical."
      const result = await callClaude(fallbackPrompt, messages)
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 200,
          headers: { ...corsHeaders, "content-type": "application/json" },
        })
      }
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: result.text }] }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      )
    }

    // ── Derive conversation history string (for constraint detection) ──────────
    const conversationHistory = messages
      .map((m) => m.content)
      .join("\n")
    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

    // ── Step 1: Identify applicable schemas (pre-generation) ──────────────────
    const preSchemas = identifyApplicableSchemas(
      latestUserMessage,
      context,
      conversationHistory
    )

    // ── Step 2: Prepare structured data blocks for each schema ────────────────
    const schemaDataMap = prepareSchemaData(
      preSchemas,
      latestUserMessage,
      context,
      conversationHistory
    )

    // ── Step 3: Build enhanced system prompt ──────────────────────────────────
    const systemPrompt = buildSystemPrompt(context, preSchemas)

    // ── Step 4: Augment user message with schema context data ─────────────────
    const augmentedMessages = messages.map((m, i) => {
      // Augment only the last user message
      if (i === messages.length - 1 && m.role === "user") {
        return {
          ...m,
          content: buildUserMessageWithSchemas(m.content, preSchemas, schemaDataMap),
        }
      }
      return m
    })

    // ── Step 5: Call Claude ───────────────────────────────────────────────────
    let result = await callClaude(systemPrompt, augmentedMessages)
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      })
    }

    let responseText = result.text ?? ""

    // ── Step 6: Validate response ─────────────────────────────────────────────
    const validation = validateRecommendation(responseText, context, conversationHistory)

    if (!validation.passed) {
      console.warn("Validation failures:", validation.failures)

      const hasConstraintFailure = validation.failures.some((f) =>
        f.startsWith("constraint_conflict")
      )

      // If there's a constraint conflict and Schema 5 wasn't already applied,
      // regenerate with Constraint Resolution schema included
      if (hasConstraintFailure && !preSchemas.includes("ConstraintResolution")) {
        const postSchemas = identifyApplicableSchemas(
          latestUserMessage,
          context,
          conversationHistory,
          responseText // pass generated recommendation for Schema 5 detection
        )

        if (postSchemas.includes("ConstraintResolution")) {
          const refinedDataMap = prepareSchemaData(
            postSchemas,
            latestUserMessage,
            context,
            conversationHistory,
            responseText
          )
          const refinedPrompt = buildSystemPrompt(context, postSchemas)
          const refinedMessages = augmentedMessages.map((m, i) => {
            if (i === augmentedMessages.length - 1 && m.role === "user") {
              return {
                ...m,
                content: buildUserMessageWithSchemas(
                  latestUserMessage,
                  postSchemas,
                  refinedDataMap
                ),
              }
            }
            return m
          })

          const refined = await callClaude(refinedPrompt, refinedMessages)
          if (refined.ok && refined.text) {
            responseText = refined.text
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ content: [{ type: "text", text: responseText }] }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    )
  } catch (e) {
    console.error("Edge function error:", e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }
})
