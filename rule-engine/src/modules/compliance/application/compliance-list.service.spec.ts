import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceListService } from './compliance-list.service';
import { ComplianceList, ComplianceListEntry } from '../domain';
import { DuplicateOperationException } from '../../../shared/exceptions';
import { RedisCacheService } from '../../../shared/cache';

// ─── Mock helpers ───────────────────────────────────────────────────

const mockListRepo = () => ({
  create: jest.fn((data) => ({ id: 'list-1', ...data })),
  save: jest.fn((entity) => Promise.resolve(entity)),
  findOne: jest.fn(),
  find: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockEntryRepo = () => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    create: jest.fn((data) => ({ id: 'entry-1', ...data })),
    save: jest.fn((entity) => Promise.resolve(Array.isArray(entity) ? entity : entity)),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    __qb: qb, // exposed for per-test customization
  };
};

const mockCacheService = () => ({
  getListFacts: jest.fn().mockResolvedValue(null),
  setListFacts: jest.fn().mockResolvedValue(undefined),
  invalidateListFacts: jest.fn().mockResolvedValue(undefined),
  invalidateListEntries: jest.fn().mockResolvedValue(undefined),
});

const ORG = 'test-org';

describe('ComplianceListService', () => {
  let service: ComplianceListService;
  let listRepo: jest.Mocked<Repository<ComplianceList>>;
  let entryRepo: jest.Mocked<Repository<ComplianceListEntry>> & { __qb: any };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceListService,
        { provide: getRepositoryToken(ComplianceList), useFactory: mockListRepo },
        { provide: getRepositoryToken(ComplianceListEntry), useFactory: mockEntryRepo },
        { provide: RedisCacheService, useFactory: mockCacheService },
      ],
    }).compile();

    service = module.get(ComplianceListService);
    listRepo = module.get(getRepositoryToken(ComplianceList));
    entryRepo = module.get(getRepositoryToken(ComplianceListEntry));
  });

  // ─── List CRUD ──────────────────────────────────────────────────

  describe('createList', () => {
    it('creates a new compliance list', async () => {
      listRepo.findOne.mockResolvedValue(null);
      const result = await service.createList(ORG, {
        code: 'SANCTIONED',
        name: 'Sanctioned Countries',
        type: 'BLACKLIST',
        entityType: 'COUNTRY',
      });
      expect(listRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SANCTIONED', type: 'BLACKLIST', entityType: 'COUNTRY' }),
      );
      expect(listRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('code', 'SANCTIONED');
    });

    it('rejects duplicate code in same org', async () => {
      listRepo.findOne.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.createList(ORG, {
          code: 'SANCTIONED',
          name: 'Dup',
          type: 'BLACKLIST',
          entityType: 'COUNTRY',
        }),
      ).rejects.toThrow(DuplicateOperationException);
    });
  });

  describe('findAllLists', () => {
    it('returns lists for organization', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'l1' }]),
      };
      listRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAllLists(ORG);
      expect(result).toHaveLength(1);
    });

    it('applies type filter', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      listRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAllLists(ORG, { type: 'BLACKLIST' });
      expect(qb.andWhere).toHaveBeenCalledWith('cl.type = :type', { type: 'BLACKLIST' });
    });
  });

  describe('findListById', () => {
    it('returns list with entries', async () => {
      listRepo.findOne.mockResolvedValue({ id: 'l1', entries: [] } as any);
      const result = await service.findListById('l1', ORG);
      expect(result.id).toBe('l1');
    });

    it('throws when not found', async () => {
      listRepo.findOne.mockResolvedValue(null);
      await expect(service.findListById('missing', ORG)).rejects.toThrow();
    });
  });

  describe('updateList', () => {
    it('updates name', async () => {
      const list = { id: 'l1', name: 'Old', entries: [] } as any;
      listRepo.findOne.mockResolvedValue(list);
      listRepo.save.mockResolvedValue({ ...list, name: 'New' });
      await service.updateList('l1', ORG, { name: 'New' });
      expect(listRepo.save).toHaveBeenCalled();
    });
  });

  describe('deleteList', () => {
    it('soft-removes list', async () => {
      const list = { id: 'l1', entries: [] } as any;
      listRepo.findOne.mockResolvedValue(list);
      await service.deleteList('l1', ORG);
      expect(listRepo.softRemove).toHaveBeenCalledWith(list);
    });
  });

  // ─── Entry CRUD ─────────────────────────────────────────────────

  describe('addEntry', () => {
    beforeEach(() => {
      listRepo.findOne.mockResolvedValue({ id: 'l1', entries: [] } as any);
    });

    it('adds an entry to a list', async () => {
      entryRepo.findOne.mockResolvedValue(null);
      await service.addEntry('l1', ORG, { value: 'IR', label: 'Iran' });
      expect(entryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ idList: 'l1', value: 'IR' }),
      );
      expect(entryRepo.save).toHaveBeenCalled();
    });

    it('rejects duplicate value in same list', async () => {
      entryRepo.findOne.mockResolvedValue({ id: 'existing' } as any);
      await expect(service.addEntry('l1', ORG, { value: 'IR' })).rejects.toThrow(
        DuplicateOperationException,
      );
    });
  });

  describe('addEntriesBulk', () => {
    it('adds multiple entries, skipping duplicates', async () => {
      listRepo.findOne.mockResolvedValue({ id: 'l1', entries: [] } as any);
      entryRepo.findOne
        .mockResolvedValueOnce(null) // IR → new
        .mockResolvedValueOnce({ id: 'x' } as any) // KP → dup
        .mockResolvedValueOnce(null); // SY → new
      entryRepo.save.mockImplementation((arr: any) => Promise.resolve(arr));
      const result = await service.addEntriesBulk('l1', ORG, [
        { value: 'IR' },
        { value: 'KP' },
        { value: 'SY' },
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe('removeEntry', () => {
    it('soft-removes an entry', async () => {
      listRepo.findOne.mockResolvedValue({ id: 'l1', entries: [] } as any);
      entryRepo.findOne.mockResolvedValue({ id: 'e1' } as any);
      await service.removeEntry('l1', 'e1', ORG);
      expect(entryRepo.softRemove).toHaveBeenCalled();
    });

    it('throws when entry not found', async () => {
      listRepo.findOne.mockResolvedValue({ id: 'l1', entries: [] } as any);
      entryRepo.findOne.mockResolvedValue(null);
      await expect(service.removeEntry('l1', 'missing', ORG)).rejects.toThrow();
    });
  });

  // ─── Fact Provider ──────────────────────────────────────────────

  describe('resolveListFacts', () => {
    const makeList = (overrides: Partial<ComplianceList>) =>
      ({
        id: 'l1',
        code: 'SANCTIONED',
        type: 'BLACKLIST',
        entityType: 'COUNTRY',
        isActive: true,
        ...overrides,
      }) as ComplianceList;

    it('detects blacklist hit on country', async () => {
      listRepo.find.mockResolvedValue([makeList({})]);
      entryRepo.__qb.getRawMany.mockResolvedValue([{ id_list: 'l1' }]);

      const facts = await service.resolveListFacts(ORG, { country: 'IR' });
      expect(facts.isBlacklisted).toBe(true);
      expect(facts.blacklists['SANCTIONED']).toBe(true);
    });

    it('no hit when country not in list', async () => {
      listRepo.find.mockResolvedValue([makeList({})]);
      entryRepo.__qb.getRawMany.mockResolvedValue([]);

      const facts = await service.resolveListFacts(ORG, { country: 'US' });
      expect(facts.isBlacklisted).toBe(false);
      expect(facts.blacklists['SANCTIONED']).toBe(false);
    });

    it('detects whitelist hit', async () => {
      listRepo.find.mockResolvedValue([makeList({ id: 'l2', code: 'TRUSTED', type: 'WHITELIST' })]);
      entryRepo.__qb.getRawMany.mockResolvedValue([{ id_list: 'l2' }]);

      const facts = await service.resolveListFacts(ORG, { country: 'US' });
      expect(facts.isWhitelisted).toBe(true);
      expect(facts.whitelists['TRUSTED']).toBe(true);
      expect(facts.isBlacklisted).toBe(false);
    });

    it('returns false when attribute is null', async () => {
      listRepo.find.mockResolvedValue([makeList({})]);
      const facts = await service.resolveListFacts(ORG, { country: null });
      expect(facts.isBlacklisted).toBe(false);
      expect(facts.blacklists['SANCTIONED']).toBe(false);
    });

    it('checks counterparty lists', async () => {
      listRepo.find.mockResolvedValue([
        makeList({ id: 'l3', code: 'BLOCKED_CP', entityType: 'COUNTERPARTY' }),
      ]);
      entryRepo.__qb.getRawMany.mockResolvedValue([{ id_list: 'l3' }]);

      const facts = await service.resolveListFacts(ORG, { counterpartyId: 'cp-bad' });
      expect(facts.isBlacklisted).toBe(true);
      expect(facts.blacklists['BLOCKED_CP']).toBe(true);
    });

    it('handles multiple lists simultaneously', async () => {
      listRepo.find.mockResolvedValue([
        makeList({ id: 'l1', code: 'BL_COUNTRY', type: 'BLACKLIST', entityType: 'COUNTRY' }),
        makeList({ id: 'l2', code: 'WL_COUNTRY', type: 'WHITELIST', entityType: 'COUNTRY' }),
      ]);
      // Only l1 has a matching entry
      entryRepo.__qb.getRawMany.mockResolvedValue([{ id_list: 'l1' }]);

      const facts = await service.resolveListFacts(ORG, { country: 'IR' });
      expect(facts.isBlacklisted).toBe(true);
      expect(facts.isWhitelisted).toBe(false);
      expect(facts.blacklists['BL_COUNTRY']).toBe(true);
      expect(facts.whitelists['WL_COUNTRY']).toBe(false);
    });
  });
});
