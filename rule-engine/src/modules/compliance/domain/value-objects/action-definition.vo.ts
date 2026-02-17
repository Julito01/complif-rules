/**
 * Action Definition - Value Object
 *
 * Describes an action to execute when a rule triggers.
 * Immutable value object — no identity, no mutation.
 */
export interface ActionDefinition {
  /** Action type: create_alert, block_transaction, webhook, publish_queue */
  type: string;
  /** Alert severity (for create_alert actions) */
  severity?: string;
  /** Alert category (for create_alert actions) */
  category?: string;
  /** Webhook URL (for webhook actions) */
  url?: string;
  /** Additional action-specific configuration */
  [key: string]: unknown;
}

/**
 * Decision - the final outcome of evaluating a transaction.
 */
export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK';

/**
 * Alert severity levels.
 */
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Alert categories.
 */
export type AlertCategory = 'AML' | 'FRAUD' | 'COMPLIANCE' | string;

/**
 * Transaction types.
 */
export type TransactionType = 'CASH_IN' | 'CASH_OUT' | 'DEBIT' | 'CREDIT';

/**
 * Aggregation types supported by the engine.
 */
export type AggregationType = 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN';
