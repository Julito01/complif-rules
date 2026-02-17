import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ComplianceList, ComplianceListEntry } from '../domain';
import { EntityNotFoundException, DuplicateOperationException } from '../../../shared/exceptions';
import { RedisCacheService } from '../../../shared/cache';
import { createHash } from 'crypto';

export interface ListMembershipFacts {
  /** Map of list code → boolean indicating if the value matched */
  blacklists: Record<string, boolean>;
  whitelists: Record<string, boolean>;
  /** Flat flags for quick rule referencing */
  isBlacklisted: boolean;
  isWhitelisted: boolean;
}

/**
 * Application service for managing compliance lists and computing
 * list membership facts for transaction evaluation.
 */
@Injectable()
export class ComplianceListService {
  private readonly logger = new Logger(ComplianceListService.name);

  constructor(
    @InjectRepository(ComplianceList)
    private readonly listRepository: Repository<ComplianceList>,
    @InjectRepository(ComplianceListEntry)
    private readonly entryRepository: Repository<ComplianceListEntry>,
    private readonly cacheService: RedisCacheService,
  ) {}

  // ─── List CRUD ──────────────────────────────────────────────────

  async createList(
    idOrganization: string,
    data: {
      code: string;
      name: string;
      description?: string;
      type: 'BLACKLIST' | 'WHITELIST';
      entityType: 'COUNTRY' | 'ACCOUNT' | 'COUNTERPARTY';
      isActive?: boolean;
      createdBy?: string;
    },
  ): Promise<ComplianceList> {
    const existing = await this.listRepository.findOne({
      where: { idOrganization, code: data.code },
    });
    if (existing) {
      throw new DuplicateOperationException(
        `Compliance list with code '${data.code}' already exists`,
        'ComplianceList',
        data.code,
      );
    }

    const list = this.listRepository.create({
      idOrganization,
      code: data.code,
      name: data.name,
      description: data.description || null,
      type: data.type,
      entityType: data.entityType,
      isActive: data.isActive ?? true,
      createdBy: data.createdBy || null,
    });

    return this.listRepository.save(list);
  }

  async findAllLists(
    idOrganization: string,
    filters?: { type?: string; entityType?: string; isActive?: boolean },
  ): Promise<ComplianceList[]> {
    const qb = this.listRepository
      .createQueryBuilder('cl')
      .where('cl.id_organization = :orgId', { orgId: idOrganization })
      .orderBy('cl.created_at', 'DESC');

    if (filters?.type) {
      qb.andWhere('cl.type = :type', { type: filters.type });
    }
    if (filters?.entityType) {
      qb.andWhere('cl.entity_type = :entityType', { entityType: filters.entityType });
    }
    if (filters?.isActive !== undefined) {
      qb.andWhere('cl.is_active = :isActive', { isActive: filters.isActive });
    }

    return qb.getMany();
  }

  async findListById(id: string, idOrganization: string): Promise<ComplianceList> {
    const list = await this.listRepository.findOne({
      where: { id, idOrganization },
      relations: ['entries'],
    });
    if (!list) {
      throw new EntityNotFoundException('ComplianceList', id);
    }
    return list;
  }

  async updateList(
    id: string,
    idOrganization: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ): Promise<ComplianceList> {
    const list = await this.findListById(id, idOrganization);
    Object.assign(list, data);
    const saved = await this.listRepository.save(list);
    await this.cacheService.invalidateListFacts(idOrganization);
    return saved;
  }

  async deleteList(id: string, idOrganization: string): Promise<void> {
    const list = await this.findListById(id, idOrganization);
    await this.listRepository.softRemove(list);
    await this.cacheService.invalidateListFacts(idOrganization);
  }

  // ─── Entry CRUD ─────────────────────────────────────────────────

  async addEntry(
    listId: string,
    idOrganization: string,
    data: { value: string; label?: string; metadata?: Record<string, unknown>; createdBy?: string },
  ): Promise<ComplianceListEntry> {
    // Validate list exists
    await this.findListById(listId, idOrganization);

    // Check for duplicate value in this list
    const existing = await this.entryRepository.findOne({
      where: { idList: listId, value: data.value },
    });
    if (existing) {
      throw new DuplicateOperationException(
        `Entry with value '${data.value}' already exists in list ${listId}`,
        'ComplianceListEntry',
        data.value,
      );
    }

    const entry = this.entryRepository.create({
      idOrganization,
      idList: listId,
      value: data.value,
      label: data.label || null,
      metadata: data.metadata || null,
      createdBy: data.createdBy || null,
    });

    const saved = await this.entryRepository.save(entry);
    await this.cacheService.invalidateListFacts(idOrganization);
    return saved;
  }

  async addEntriesBulk(
    listId: string,
    idOrganization: string,
    entries: Array<{ value: string; label?: string; metadata?: Record<string, unknown> }>,
  ): Promise<ComplianceListEntry[]> {
    await this.findListById(listId, idOrganization);

    const created: ComplianceListEntry[] = [];
    for (const data of entries) {
      const existing = await this.entryRepository.findOne({
        where: { idList: listId, value: data.value },
      });
      if (existing) continue; // skip duplicates silently in bulk

      const entry = this.entryRepository.create({
        idOrganization,
        idList: listId,
        value: data.value,
        label: data.label || null,
        metadata: data.metadata || null,
      });
      created.push(entry);
    }

    if (created.length > 0) {
      const saved = await this.entryRepository.save(created);
      await this.cacheService.invalidateListFacts(idOrganization);
      return saved;
    }
    return [];
  }

  async findEntries(listId: string, idOrganization: string): Promise<ComplianceListEntry[]> {
    await this.findListById(listId, idOrganization);
    return this.entryRepository.find({
      where: { idList: listId, idOrganization },
      order: { createdAt: 'DESC' },
    });
  }

  async removeEntry(listId: string, entryId: string, idOrganization: string): Promise<void> {
    await this.findListById(listId, idOrganization);
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, idList: listId, idOrganization },
    });
    if (!entry) {
      throw new EntityNotFoundException('ComplianceListEntry', entryId);
    }
    await this.entryRepository.softRemove(entry);
    await this.cacheService.invalidateListFacts(idOrganization);
  }

  /**
   * Resolve list membership facts for a transaction.
   *
   * Given the transaction's attribute values (country, account, counterparty),
   * checks all active lists in the organization and returns deterministic
   * membership facts.
   */
  async resolveListFacts(
    idOrganization: string,
    attributes: {
      country?: string | null;
      idAccount?: string | null;
      counterpartyId?: string | null;
    },
  ): Promise<ListMembershipFacts> {
    // Build deterministic cache key from attributes
    const attrHash = createHash('md5')
      .update(JSON.stringify(attributes))
      .digest('hex')
      .slice(0, 12);

    const cached = await this.cacheService.getListFacts<ListMembershipFacts>(
      idOrganization,
      attrHash,
    );
    if (cached) {
      return cached;
    }

    const activeLists = await this.listRepository.find({
      where: { idOrganization, isActive: true },
    });

    const blacklists: Record<string, boolean> = {};
    const whitelists: Record<string, boolean> = {};
    let isBlacklisted = false;
    let isWhitelisted = false;

    // Batch: collect all (listId, value) pairs we need to check
    const lookups: Array<{ list: ComplianceList; attrValue: string }> = [];
    for (const list of activeLists) {
      const attrValue = this.getAttributeValue(list.entityType, attributes);
      if (attrValue == null) {
        if (list.type === 'BLACKLIST') blacklists[list.code] = false;
        else whitelists[list.code] = false;
        continue;
      }
      lookups.push({ list, attrValue });
    }

    // Single batch query: find ALL matching entries at once (eliminates N+1)
    let matchedListIds = new Set<string>();
    if (lookups.length > 0) {
      const conditions = lookups.map((l) => ({
        idList: l.list.id,
        value: l.attrValue,
      }));
      // Use IN query with list IDs + values for a single round-trip
      const listIds = lookups.map((l) => l.list.id);
      const values = [...new Set(lookups.map((l) => l.attrValue))];

      const matches = await this.entryRepository
        .createQueryBuilder('e')
        .select(['e.id_list AS id_list'])
        .where('e.id_list IN (:...listIds)', { listIds })
        .andWhere('e.value IN (:...values)', { values })
        .getRawMany();

      matchedListIds = new Set(matches.map((m) => m.id_list));
    }

    for (const { list, attrValue } of lookups) {
      const hit = matchedListIds.has(list.id);
      if (list.type === 'BLACKLIST') {
        blacklists[list.code] = hit;
        if (hit) isBlacklisted = true;
      } else {
        whitelists[list.code] = hit;
        if (hit) isWhitelisted = true;
      }
    }

    const facts: ListMembershipFacts = { blacklists, whitelists, isBlacklisted, isWhitelisted };

    // Populate cache for next lookup
    await this.cacheService.setListFacts(idOrganization, attrHash, facts);

    return facts;
  }

  private getAttributeValue(
    entityType: string,
    attributes: {
      country?: string | null;
      idAccount?: string | null;
      counterpartyId?: string | null;
    },
  ): string | null {
    switch (entityType) {
      case 'COUNTRY':
        return attributes.country || null;
      case 'ACCOUNT':
        return attributes.idAccount || null;
      case 'COUNTERPARTY':
        return attributes.counterpartyId || null;
      default:
        return null;
    }
  }
}
