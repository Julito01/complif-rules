import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { TransactionEvaluationService } from '../../application';
import { CreateTransactionDto } from '../dto';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';
import { EntityNotFoundException } from '../../../../shared/exceptions';

/**
 * Controller for transaction ingestion and evaluation.
 *
 * POST /transactions  → ingest + evaluate
 * GET  /transactions  → list transactions
 * GET  /transactions/:id/evaluation → get evaluation result
 */
@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(OrganizationGuard)
export class TransactionController {
  constructor(private readonly transactionEvaluationService: TransactionEvaluationService) {}

  /**
   * Ingest a transaction and evaluate it against all active compliance rules.
   *
   * Returns the transaction, evaluation result (decision + triggered rules), and any alerts.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingest transaction',
    description:
      'Ingests a transaction, evaluates it against all active rules, and returns the decision and any alerts',
  })
  @ApiCreatedResponse({ description: 'Transaction ingested with evaluation result and alerts' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async ingest(@OrgContext() ctx: OrganizationContext, @Body() dto: CreateTransactionDto) {
    const result = await this.transactionEvaluationService.ingestAndEvaluate({
      idOrganization: ctx.organizationId,
      idAccount: dto.idAccount,
      type: dto.type,
      subType: dto.subType,
      amount: dto.amount,
      currency: dto.currency,
      amountNormalized: dto.amountNormalized,
      currencyNormalized: dto.currencyNormalized,
      datetime: new Date(dto.datetime),
      date: dto.date,
      country: dto.country,
      counterpartyId: dto.counterpartyId,
      channel: dto.channel,
      quantity: dto.quantity,
      asset: dto.asset,
      price: dto.price,
      isVoided: dto.isVoided,
      isBlocked: dto.isBlocked,
      isDeleted: dto.isDeleted,
      externalCode: dto.externalCode,
      data: dto.data,
      origin: dto.origin,
      deviceInfo: dto.deviceInfo,
      idTransactionLote: dto.idTransactionLote,
      metadata: dto.metadata,
      createdBy: ctx.userId,
    });

    return {
      success: true,
      data: {
        transaction: result.transaction,
        evaluation: {
          id: result.evaluationResult.id,
          decision: result.evaluationResult.decision,
          triggeredRules: result.evaluationResult.triggeredRules,
          evaluationDurationMs: result.evaluationResult.evaluationDurationMs,
        },
        alerts: result.alerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          category: a.category,
          status: a.status,
          message: a.message,
        })),
      },
    };
  }

  /**
   * List transactions with optional filters.
   */
  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description: 'Returns transactions with optional filters',
  })
  @ApiQuery({ name: 'idAccount', required: false, description: 'Filter by account UUID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results', example: '50' })
  @ApiOkResponse({ description: 'List of transactions' })
  async findAll(
    @OrgContext() ctx: OrganizationContext,
    @Query('idAccount') idAccount?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, totalCount } = await this.transactionEvaluationService.findTransactions(
      ctx.organizationId,
      {
        idAccount,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
    );

    return {
      success: true,
      data: items,
      count: items.length,
      totalCount,
    };
  }

  /**
   * Get evaluation results for a specific transaction or account.
   */
  @Get('evaluations')
  @ApiOperation({
    summary: 'List evaluation results',
    description: 'Returns evaluation results with optional filters',
  })
  @ApiQuery({ name: 'idTransaction', required: false, description: 'Filter by transaction UUID' })
  @ApiQuery({ name: 'idAccount', required: false, description: 'Filter by account UUID' })
  @ApiQuery({
    name: 'decision',
    required: false,
    description: 'Filter by decision (ALLOW/REVIEW/BLOCK)',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results', example: '50' })
  @ApiOkResponse({ description: 'List of evaluation results' })
  async findEvaluations(
    @OrgContext() ctx: OrganizationContext,
    @Query('idTransaction') idTransaction?: string,
    @Query('idAccount') idAccount?: string,
    @Query('decision') decision?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, totalCount } = await this.transactionEvaluationService.findEvaluationResults(
      ctx.organizationId,
      {
        idTransaction,
        idAccount,
        decision,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
    );

    return {
      success: true,
      data: items,
      count: items.length,
      totalCount,
    };
  }
}
