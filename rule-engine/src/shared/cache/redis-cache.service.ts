import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis Cache Service — Infrastructure-layer caching for hot evaluation paths.
 *
 * Provides:
 *  - Active rule version caching (TTL ~60s)
 *  - Compliance list membership caching (TTL ~30s)
 *  - Explicit invalidation on write paths
 *  - Graceful degradation when Redis is unavailable
 *
 * Cache keys are scoped by organization to enforce multi-tenant isolation.
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;
  private connected = false;

  // Configurable TTLs (seconds) — overrideable via env vars
  private readonly RULE_TTL = parseInt(process.env.CACHE_RULE_TTL || '60', 10);
  private readonly LIST_TTL = parseInt(process.env.CACHE_LIST_TTL || '30', 10);

  // Cache key prefixes
  private readonly PREFIX_RULES = 'rules:active:';
  private readonly PREFIX_LIST_FACTS = 'lists:facts:';
  private readonly PREFIX_LIST_ENTRIES = 'lists:entries:';

  // Metrics counters
  private hits = 0;
  private misses = 0;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis retry limit reached — operating without cache');
            return null; // stop retrying
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        connectTimeout: 3000,
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log('Redis connected');
      });

      this.client.on('error', (err) => {
        this.connected = false;
        this.logger.warn(`Redis error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.connected = false;
      });

      await this.client.connect();
      this.connected = true;
    } catch (err) {
      this.logger.warn(`Redis unavailable (${(err as Error).message}) — running without cache`);
      this.connected = false;
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore on shutdown
      }
    }
  }

  // ─── Generic get/set with graceful degradation ──────────────────

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.debug(`Cache get error for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.debug(`Cache set error for ${key}: ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.connected || !this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.debug(`Cache del error: ${(err as Error).message}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.debug(`Cache delByPrefix error: ${(err as Error).message}`);
    }
  }

  // ─── Active Rule Versions ──────────────────────────────────────

  activeRulesKey(orgId: string): string {
    return `${this.PREFIX_RULES}${orgId}`;
  }

  async getActiveRules<T>(orgId: string): Promise<T[] | null> {
    return this.get<T[]>(this.activeRulesKey(orgId));
  }

  async setActiveRules(orgId: string, rules: unknown[]): Promise<void> {
    await this.set(this.activeRulesKey(orgId), rules, this.RULE_TTL);
  }

  async invalidateActiveRules(orgId: string): Promise<void> {
    await this.del(this.activeRulesKey(orgId));
  }

  // ─── Compliance List Facts ──────────────────────────────────────

  listFactsKey(orgId: string, attributeHash: string): string {
    return `${this.PREFIX_LIST_FACTS}${orgId}:${attributeHash}`;
  }

  async getListFacts<T>(orgId: string, attributeHash: string): Promise<T | null> {
    return this.get<T>(this.listFactsKey(orgId, attributeHash));
  }

  async setListFacts(orgId: string, attributeHash: string, facts: unknown): Promise<void> {
    await this.set(this.listFactsKey(orgId, attributeHash), facts, this.LIST_TTL);
  }

  async invalidateListFacts(orgId: string): Promise<void> {
    await this.delByPrefix(`${this.PREFIX_LIST_FACTS}${orgId}:`);
  }

  // ─── List Entry Lookup (individual entry membership) ────────────

  listEntryKey(listId: string, value: string): string {
    return `${this.PREFIX_LIST_ENTRIES}${listId}:${value}`;
  }

  async getListEntry<T>(listId: string, value: string): Promise<T | null> {
    return this.get<T>(this.listEntryKey(listId, value));
  }

  async setListEntry(listId: string, value: string, entry: unknown): Promise<void> {
    await this.set(this.listEntryKey(listId, value), entry, this.LIST_TTL);
  }

  async invalidateListEntries(listId: string): Promise<void> {
    await this.delByPrefix(`${this.PREFIX_LIST_ENTRIES}${listId}:`);
  }

  // ─── Metrics ────────────────────────────────────────────────────

  getMetrics(): { hits: number; misses: number; hitRate: string; connected: boolean } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
      connected: this.connected,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }
}
