import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../shared/cache';
import { MetricsService } from '../../shared/metrics';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Transaction,
  RuleTemplate,
  RuleVersion,
  EvaluationResult,
  Alert,
  ComplianceList,
  ComplianceListEntry,
} from './domain';
import {
  RuleTemplateService,
  RuleVersionService,
  TransactionEvaluationService,
  AlertService,
  ComplianceListService,
} from './application';
import { BehavioralBaselineService } from './application/behavioral-baseline.service';
import {
  TransactionController,
  RuleController,
  AlertController,
  ComplianceListController,
} from './infrastructure';
import { EvaluationGateway } from './infrastructure/gateways';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      RuleTemplate,
      RuleVersion,
      EvaluationResult,
      Alert,
      ComplianceList,
      ComplianceListEntry,
    ]),
  ],
  controllers: [TransactionController, RuleController, AlertController, ComplianceListController],
  providers: [
    RuleTemplateService,
    RuleVersionService,
    TransactionEvaluationService,
    AlertService,
    ComplianceListService,
    BehavioralBaselineService,
    RedisCacheService,
    MetricsService,
    EvaluationGateway,
  ],
  exports: [
    RuleTemplateService,
    RuleVersionService,
    TransactionEvaluationService,
    AlertService,
    ComplianceListService,
    BehavioralBaselineService,
  ],
})
export class ComplianceModule {}
