import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-opus-4-6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildSystemPrompt(context: Record<string, unknown>): string {
  const { exposure_summary, health_context, user_profile, insights } = context as {
    exposure_summary: Record<string, unknown>
    health_context: Record<string, unknown>
    user_profile: Record<string, unknown>
    insights: Record<string, unknown>
  }

  return `You are Aero, a personal air quality health assistant.

You have access to the user's real-time and historical data. Use it to give specific, personalised answers — reference their actual numbers, conditions, and recent symptoms. Be warm and practical, not clinical. Keep responses to 2–3 sentences maximum. Only go longer if the user explicitly asks for detail. Do NOT speculate about data you don't have; if a field is null, skip it gracefully.

---

## Current Air Quality Data

${JSON.stringify(exposure_summary, null, 2)}

WHO daily guideline for PM2.5: 15 μg/m³

---

## User's Recent Health Logs

${JSON.stringify(health_context, null, 2)}

---

## User Risk Profile

${JSON.stringify(user_profile, null, 2)}

---

## Pre-computed Insight Triggers

${JSON.stringify(insights, null, 2)}

---

## Your role

1. Answer questions about air quality and health clearly and concisely.
2. Proactively mention relevant patterns or risks when they are significant (e.g. WHO exceedance, symptom correlation, bad outdoor conditions).
3. Give personalised advice — reference the user's specific conditions, recent symptoms, and exposure history.
4. Use exact numbers from the data (not vague statements like "air quality is elevated").
5. If the user asks what to do, give practical, actionable advice tailored to their profile.

## Follow-up suggestions

After every response, append exactly one line in this format (no deviations):
FOLLOW_UP: Question one? | Question two? | Question three?

Make the 3 questions short (under 8 words each), specific to this conversation and the user's data, and genuinely useful as next steps. Do not number them or add any other punctuation around them.`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messages, context } = body

    const systemPrompt = context
      ? buildSystemPrompt(context)
      : 'You are Aero, an AI assistant helping users understand their air quality exposure. Be concise and practical.'

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', response.status, err)
      // Return 200 so the client receives the body and can display the real error
      return new Response(JSON.stringify({ error: `Anthropic ${response.status}: ${err}` }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('Edge function error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})
