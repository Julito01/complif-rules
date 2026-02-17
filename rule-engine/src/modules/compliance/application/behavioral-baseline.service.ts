import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../domain';

/**
 * Behavioral baseline metrics computed from an account's transaction history.
 */
export interface BehavioralBaseline {
  /** Number of historical transactions in the lookback window */
  historyCount: number;
  /** Average transaction amount */
  avgAmount: number | null;
  /** Standard deviation of transaction amounts */
  stdAmount: number | null;
  /** Set of unique countries seen */
  typicalCountries: string[];
  /** Set of unique channels seen */
  typicalChannels: string[];
  /** Average transactions per day over the lookback window */
  avgFrequencyPerDay: number | null;
  /** Whether the account is in cold-start state (< 5 transactions) */
  isColdStart: boolean;
}

/**
 * Deviation facts comparing current transaction to the behavioral baseline.
 */
export interface BehavioralDeviation {
  /** Current amount / historical average (>1 means above average) */
  amountRatio: number | null;
  /** (Current amount − mean) / stddev — classic z-score */
  amountZScore: number | null;
  /** true if transaction country has never been seen for this account */
  isNewCountry: boolean;
  /** true if transaction channel has never been seen for this account */
  isNewChannel: boolean;
  /** true if account has fewer than 5 transactions (baseline is unreliable) */
  isColdStart: boolean;
}

export interface BehavioralFacts {
  baseline: BehavioralBaseline;
  deviation: BehavioralDeviation;
}

/**
 * Computes behavioral baseline and deviation facts for an account's transaction
 * relative to its historical patterns.
 *
 * Lookback window defaults to 30 days but can be overridden.
 */
@Injectable()
export class BehavioralBaselineService {
  private static readonly DEFAULT_LOOKBACK_DAYS = 30;
  private static readonly COLD_START_THRESHOLD = 5;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Compute behavioral facts for a transaction.
   * Pure computation from historical data — no side effects.
   */
  async computeBehavioralFacts(
    transaction: Transaction,
    lookbackDays = BehavioralBaselineService.DEFAULT_LOOKBACK_DAYS,
  ): Promise<BehavioralFacts> {
    const baseline = await this.computeBaseline(
      transaction.idAccount,
      transaction.idOrganization,
      transaction.id,
      transaction.datetime,
      lookbackDays,
    );

    const deviation = this.computeDeviation(transaction, baseline);

    return { baseline, deviation };
  }

  /**
   * Compute baseline from historical transactions in the lookback window,
   * excluding the current transaction.
   */
  private async computeBaseline(
    idAccount: string,
    idOrganization: string,
    excludeTransactionId: string,
    referenceDate: Date,
    lookbackDays: number,
  ): Promise<BehavioralBaseline> {
    const lookbackStart = new Date(referenceDate);
    lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);

    // Single efficient query with aggregates
    const raw = await this.transactionRepository
      .createQueryBuilder('t')
      .select([
        'COUNT(*)::int AS count',
        'AVG(t.amount::numeric)::float AS avg_amount',
        'STDDEV_POP(t.amount::numeric)::float AS std_amount',
        `ARRAY_AGG(DISTINCT t.country) FILTER (WHERE t.country IS NOT NULL) AS countries`,
        `ARRAY_AGG(DISTINCT t.channel) FILTER (WHERE t.channel IS NOT NULL) AS channels`,
      ])
      .where('t.id_account = :idAccount', { idAccount })
      .andWhere('t.id_organization = :idOrganization', { idOrganization })
      .andWhere('t.datetime >= :start', { start: lookbackStart })
      .andWhere('t.datetime < :end', { end: referenceDate })
      .andWhere('t.id != :excludeId', { excludeId: excludeTransactionId })
      .getRawOne();

    const historyCount = raw?.count ?? 0;
    const isColdStart = historyCount < BehavioralBaselineService.COLD_START_THRESHOLD;

    // Frequency: transactions per day over the lookback window
    const windowDays = Math.max(lookbackDays, 1);
    const avgFrequencyPerDay =
      historyCount > 0 ? parseFloat((historyCount / windowDays).toFixed(4)) : null;

    return {
      historyCount,
      avgAmount: raw?.avg_amount ?? null,
      stdAmount: raw?.std_amount ?? null,
      typicalCountries: raw?.countries ?? [],
      typicalChannels: raw?.channels ?? [],
      avgFrequencyPerDay,
      isColdStart,
    };
  }

  /**
   * Compute deviation metrics comparing current transaction to baseline.
   */
  private computeDeviation(
    transaction: Transaction,
    baseline: BehavioralBaseline,
  ): BehavioralDeviation {
    const amount = Number(transaction.amount);

    // Amount ratio: current / average
    const amountRatio =
      baseline.avgAmount != null && baseline.avgAmount > 0
        ? parseFloat((amount / baseline.avgAmount).toFixed(4))
        : null;

    // Z-score: (current - mean) / stddev
    const amountZScore =
      baseline.stdAmount != null && baseline.stdAmount > 0 && baseline.avgAmount != null
        ? parseFloat(((amount - baseline.avgAmount) / baseline.stdAmount).toFixed(4))
        : null;

    // New country detection
    const isNewCountry =
      !!transaction.country &&
      baseline.typicalCountries.length > 0 &&
      !baseline.typicalCountries.includes(transaction.country);

    // New channel detection
    const isNewChannel =
      !!transaction.channel &&
      baseline.typicalChannels.length > 0 &&
      !baseline.typicalChannels.includes(transaction.channel);

    return {
      amountRatio,
      amountZScore,
      isNewCountry,
      isNewChannel,
      isColdStart: baseline.isColdStart,
    };
  }
}
