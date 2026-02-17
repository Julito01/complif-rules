import {
  Controller,
  Get,
  Put,
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
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AlertService } from '../../application';
import { UpdateAlertDto, AlertQueryDto } from '../dto';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';
import { EntityNotFoundException } from '../../../../shared/exceptions';

/**
 * Controller for managing compliance alerts.
 *
 * GET  /alerts          → list alerts (with filters)
 * GET  /alerts/:id      → get alert
 * PUT  /alerts/:id      → update alert status
 */
@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(OrganizationGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({
    summary: 'List alerts',
    description: 'Returns compliance alerts with optional filters',
  })
  @ApiQuery({ name: 'idAccount', required: false, description: 'Filter by account UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    description: 'Filter by severity',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category',
    example: 'AML',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results', example: '50' })
  @ApiOkResponse({ description: 'List of alerts' })
  async findAll(
    @OrgContext() ctx: OrganizationContext,
    @Query('idAccount') idAccount?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const alerts = await this.alertService.findAll(ctx.organizationId, {
      idAccount,
      status,
      severity,
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      success: true,
      data: alerts,
      count: alerts.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiOkResponse({ description: 'Alert details' })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  async findById(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const alert = await this.alertService.findById(id, ctx.organizationId);

    if (!alert) {
      throw new EntityNotFoundException('Alert', id);
    }

    return { success: true, data: alert };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update alert status',
    description: 'Updates the status of an alert (e.g. ACKNOWLEDGED, RESOLVED)',
  })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiOkResponse({ description: 'Updated alert' })
  async updateStatus(
    @OrgContext() ctx: OrganizationContext,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    const alert = await this.alertService.updateStatus(
      id,
      ctx.organizationId,
      dto.status,
      ctx.userId,
    );

    return { success: true, data: alert };
  }
}
