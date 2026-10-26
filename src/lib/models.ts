/**
 * ClinePass model definitions, dynamic discovery, and opencode.json config
 * generation.
 *
 * @module models
 */

import { resolveApiBase } from "./env.js"

/** Pi thinking levels that models map to provider-specific reasoning_effort. */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

/**
 * Maps every thinking level to a provider-specific `reasoning_effort` string
 * or `null` (unsupported). Every model must declare all six levels — there are
 * no implicit defaults.
 */
export type ThinkingLevelMap = Readonly<Record<ThinkingLevel, string | null>>

/** Default thinking level map for remote models without a static fallback. */
export const DEFAULT_THINKING_LEVEL_MAP: ThinkingLevelMap = {
  off: "none",
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
}

export interface ModelDef {
  id: string
  name: string
  context: number
  output: number
  /** Whether the model supports reasoning (extended thinking). */
  reasoning: boolean
  /**
   * Maps every thinking level to a provider-specific reasoning_effort string,
   * or `null` to mark a level as unsupported. All six levels must be declared.
   */
  thinkingLevelMap: ThinkingLevelMap
}

/** Model config shape produced by modelsToConfig / fetchRemoteModels. */
export interface ModelConfigEntry {
  name: string
  limit: { context: number; output: number }
  reasoning: boolean
  thinkingLevelMap: ThinkingLevelMap
}

/**
 * The 10 curated ClinePass models with reasoning capability matrices.
 *
 * Each model declares a `thinkingLevelMap` mapping all six pi thinking levels
 * (off/minimal/low/medium/high/xhigh) to the provider-specific `reasoning_effort`
 * values that Cline's OpenAI-compatible API expects. `openai-compatible` doesn't
 * natively support `reasoningEffort`, but this metadata is available for OpenCode
 * to use in model selection UI, auto-config, and future reasoning integration.
 */
export const MODELS: readonly ModelDef[] = [
  {
    id: "cline-pass/kimi-k3",
    name: "Kimi K3 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh" },
  },
  {
    id: "cline-pass/glm-5.2",
    name: "GLM-5.2 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh" },
  },
  {
    id: "cline-pass/kimi-k2.7-code",
    name: "Kimi K2.7 Code (ClinePass)",
    context: 262_144,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/kimi-k2.6",
    name: "Kimi K2.6 (ClinePass)",
    context: 262_144,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (ClinePass)",
    context: 1_000_000,
    output: 384_000,
    reasoning: true,
    // DeepSeek only supports high reasoning; off/minimal/low/medium are unsupported.
    thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: "high", xhigh: "high" },
  },
  {
    id: "cline-pass/deepseek-v4-flash",
    name: "DeepSeek V4 Flash (ClinePass)",
    context: 1_000_000,
    output: 384_000,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: "high", xhigh: "high" },
  },
  {
    id: "cline-pass/mimo-v2.5",
    name: "MiMo-V2.5 (ClinePass)",
    context: 262_144,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/mimo-v2.5-pro",
    name: "MiMo-V2.5-Pro (ClinePass)",
    context: 262_144,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/minimax-m3",
    name: "MiniMax M3 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/qwen3.7-max",
    name: "Qwen3.7 Max (ClinePass)",
    context: 262_144,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
  {
    id: "cline-pass/qwen3.7-plus",
    name: "Qwen3.7 Plus (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null },
  },
]

/** Pre-built Map for O(1) static model fallback lookups. */
const STATIC_MODELS_BY_ID = new Map(MODELS.map((m) => [m.id, m]))

/** Default limits used when neither API nor static data provides them. */
const FALLBACK_CONTEXT = 128_000
const FALLBACK_OUTPUT = 8_192

/** Extract the model array from the API response (handles both { data: [...] } and bare [...] formats). */
function extractModelList(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json
  if (typeof json !== "object" || json === null) return []
  const obj = json as Record<string, unknown>
  if (obj.data !== undefined && Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>
  return []
}

/** Build the opencode.json `provider.clinepass.models` object from MODELS. */
export function modelsToConfig(models: readonly ModelDef[] = MODELS): Record<string, ModelConfigEntry> {
  const out: Record<string, ModelConfigEntry> = {}
  for (const m of models) {
    out[m.id] = {
      name: m.name,
      limit: { context: m.context, output: m.output },
      reasoning: m.reasoning,
      thinkingLevelMap: m.thinkingLevelMap,
    }
  }
  return out
}

/**
 * Fetch the model list from the Cline API `/api/v1/models` endpoint (OpenAI-compatible
 * format: `{ data: [{ id, name, context_length, max_output_tokens, ... }] }`).
 * Returns a record keyed by model id, or `undefined` on any error (network, auth, parse).
 *
 * The returned objects carry enough fields for Opencode to use them as provider models
 * — name, limit, and api info. The caller should map these into the shape Opencode expects.
 */
export async function fetchRemoteModels(
  apiKey: string | undefined,
  options: { apiBase?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Promise<Record<string, ModelConfigEntry> | undefined> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const apiBase = options.apiBase ?? resolveApiBase()
  const timeoutMs = options.timeoutMs ?? 5_000

  if (!apiKey || !fetchFn) return undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(`${apiBase}/api/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })

    if (!response.ok) return undefined

    const json: unknown = await response.json()
    const rawList = extractModelList(json)

    if (rawList.length === 0) return undefined

    // Use the pre-built module-level Map for O(1) static fallback lookups
    const staticById = STATIC_MODELS_BY_ID

    // Only include models with the "cline-pass/" prefix
    const out: Record<string, ModelConfigEntry> = {}
    for (const raw of rawList) {
      const id = typeof raw.id === "string" ? raw.id : undefined
      if (!id || !id.startsWith("cline-pass/")) continue

      const name = typeof raw.name === "string" ? raw.name : id
      const context = typeof raw.context_length === "number" ? raw.context_length : undefined
      const output = typeof raw.max_output_tokens === "number" ? raw.max_output_tokens : undefined
      const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : undefined

      // Fall back to static data if the API doesn't provide these fields
      const staticFallback = staticById.get(id)
      out[id] = {
        name,
        limit: {
          context: context ?? staticFallback?.context ?? FALLBACK_CONTEXT,
          output: output ?? staticFallback?.output ?? FALLBACK_OUTPUT,
        },
        reasoning: reasoning ?? staticFallback?.reasoning ?? true,
        thinkingLevelMap: staticFallback?.thinkingLevelMap ?? DEFAULT_THINKING_LEVEL_MAP,
      }
    }

    return Object.keys(out).length > 0 ? out : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build the full `provider.clinepass` config block that the `config` hook
 * injects into opencode's config at startup. Exported for testing.
 */
export function buildProviderConfig(env: Record<string, string | undefined> = process.env): {
  npm: string
  name: string
  options: { baseURL: string }
  models: Record<string, ModelConfigEntry>
} {
  return {
    npm: "@ai-sdk/openai-compatible",
    name: "ClinePass",
    options: { baseURL: `${resolveApiBase(env)}/api/v1` },
    models: modelsToConfig(),
  }
}

/**
 * Inject the clinepass provider config into a config object (in-place), but
 * only if the user hasn't already declared a `clinepass` provider themselves.
 * Exported for testing the `config` hook logic without a plugin runtime.
 */
export function injectProviderConfig<T extends { provider?: Record<string, unknown> }>(
  input: T,
  env: Record<string, string | undefined> = process.env,
): void {
  const provider = input.provider ?? {}
  if (provider.clinepass) return // respect user's manual config
  provider.clinepass = buildProviderConfig(env)
  input.provider = provider
}
