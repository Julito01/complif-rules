import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleTemplateService } from './rule-template.service';
import { RuleTemplate } from '../domain';
import { BusinessRuleException } from '../../../shared/exceptions';

const ORG = 'test-org';

const mockTemplateRepo = () => ({
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn((data) => ({ id: 'tpl-1', ...data })),
  save: jest.fn((entity) => Promise.resolve(entity)),
  find: jest.fn(),
});

describe('RuleTemplateService', () => {
  let service: RuleTemplateService;
  let templateRepo: jest.Mocked<Repository<RuleTemplate>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleTemplateService,
        { provide: getRepositoryToken(RuleTemplate), useFactory: mockTemplateRepo },
      ],
    }).compile();

    service = module.get(RuleTemplateService);
    templateRepo = module.get(getRepositoryToken(RuleTemplate));
  });

  describe('create baseline enforcement', () => {
    it('allows creating a baseline template when none exists', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      const result = await service.create({
        idOrganization: ORG,
        code: 'BASELINE_AML',
        name: 'Baseline AML',
        isSystem: true,
      });

      expect(templateRepo.count).not.toHaveBeenCalled();
      expect(result.code).toBe('BASELINE_AML');
      expect(result.isSystem).toBe(true);
    });

    it('rejects creating non-system template when baseline does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.count.mockResolvedValue(0);

      await expect(
        service.create({
          idOrganization: ORG,
          code: 'CUSTOM_AML',
          name: 'Custom AML',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('allows creating non-system template when baseline exists', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      templateRepo.count.mockResolvedValue(1);

      const result = await service.create({
        idOrganization: ORG,
        code: 'CUSTOM_AML',
        name: 'Custom AML',
      });

      expect(templateRepo.count).toHaveBeenCalledTimes(1);
      expect(result.code).toBe('CUSTOM_AML');
      expect(result.isSystem).toBe(false);
    });
  });

  describe('deactivate baseline enforcement', () => {
    it('rejects deactivating the last active baseline template', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 'baseline-1',
        idOrganization: ORG,
        code: 'BASELINE_AML',
        isActive: true,
        isSystem: true,
        parentTemplateId: null,
      } as RuleTemplate);
      templateRepo.count.mockResolvedValue(1);

      await expect(service.deactivate('baseline-1', ORG)).rejects.toThrow(BusinessRuleException);
    });

    it('allows deactivating a baseline when another baseline is active', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 'baseline-1',
        idOrganization: ORG,
        code: 'BASELINE_AML',
        isActive: true,
        isSystem: true,
        parentTemplateId: null,
      } as RuleTemplate);
      templateRepo.count.mockResolvedValue(2);

      const result = await service.deactivate('baseline-1', ORG);

      expect(templateRepo.save).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });
  });
});
