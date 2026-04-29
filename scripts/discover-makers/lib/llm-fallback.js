'use strict';

/**
 * llm-fallback — try CF Workers AI first; if it returns a "daily quota
 * exhausted" error, retry the same prompt + schema against Anthropic
 * Haiku 4.5 so registration doesn't stall the moment the 10,000-Neuron
 * window closes for the day. Both call sites already produce JSON via
 * structured-output (CF: response_format json_schema; Anthropic: tool_use
 * with input_schema), so the caller gets back a uniform `{ parsed, usage,
 * source }` shape.
 *
 * Anthropic is paid (no free tier), so we deliberately reach for it ONLY
 * when CF refuses — never as the primary backend.
 */

let _Anthropic = null;
function loadAnthropic() {
  if (_Anthropic) return _Anthropic;
  try { _Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk'); }
  catch { _Anthropic = null; }
  return _Anthropic;
}

const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Pattern-match the error body strings the three lib/* call sites already
 * recognise as quota-exhausted. Keeps detection in one place.
 */
function isCfQuotaError(msg) {
  if (!msg) return false;
  return /you have used up your daily free allocation/i.test(msg)
      || /\b10,?000\s*neurons?\b/i.test(msg)
      || /workers ai 429/i.test(msg)
      || /workers ai 503/i.test(msg);
}

/**
 * Call Anthropic Haiku 4.5 with structured output forced via tool_use.
 * `schema` is the same JSON-schema-shaped object {type:'object', properties:{...}, required:[...]}
 * the CF call already passes through `response_format`.
 */
async function callAnthropicWithSchema({ system, user, schema, maxTokens = 1500, temperature = 0.1, toolName = 'emit_structured_data' }) {
  const Anthropic = loadAnthropic();
  if (!Anthropic) {
    throw new Error('Anthropic fallback unavailable: @anthropic-ai/sdk not installed (npm install @anthropic-ai/sdk)');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic fallback unavailable: ANTHROPIC_API_KEY env var is required');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
    tools: [{
      name: toolName,
      description: 'Emit the structured fields the caller asked for.',
      input_schema: schema
    }],
    tool_choice: { type: 'tool', name: toolName }
  });

  // Pull the tool_use block — that's where the structured JSON lives
  const block = (res.content || []).find(c => c.type === 'tool_use' && c.name === toolName);
  if (!block) {
    throw new Error('Anthropic fallback: response did not contain the expected tool_use block');
  }
  return {
    parsed: block.input,
    usage: {
      input_tokens: (res.usage && res.usage.input_tokens) || 0,
      output_tokens: (res.usage && res.usage.output_tokens) || 0
    },
    source: 'anthropic-haiku-4-5'
  };
}

module.exports = { isCfQuotaError, callAnthropicWithSchema, FALLBACK_MODEL };
