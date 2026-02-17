/**
 * Rule Evaluation & Aggregation Explanation Tools
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRICT CONSTRAINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These tools are EXPLANATION-ONLY. They must:
 * - Be deterministic (same input → same output)
 * - Perform NO writes, NO side effects
 * - NOT reuse production evaluation code
 * - Return human-readable explanations
 *
 * They exist to help Claude understand:
 * - How a rule would evaluate a transaction
 * - How aggregations are computed over sliding windows
 * - Why a rule passes or fails
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AVAILABLE TOOLS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. explain_rule_evaluation  - Explain how a rule evaluates a transaction
 * 2. explain_aggregation      - Explain how an aggregation + window works
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const explanationTools: Tool[];
export declare function handleExplanationToolCall(name: string, args: Record<string, unknown>): Promise<string>;
//# sourceMappingURL=tools.d.ts.map