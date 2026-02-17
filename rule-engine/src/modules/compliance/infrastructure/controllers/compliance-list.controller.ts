import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { ComplianceListService } from '../../application';
import {
  CreateComplianceListDto,
  UpdateComplianceListDto,
  CreateComplianceListEntryDto,
  BulkCreateEntriesDto,
} from '../dto';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';

/**
 * Controller for managing compliance lists (blacklists / whitelists) and their entries.
 *
 * POST   /compliance-lists                      → create list
 * GET    /compliance-lists                      → list all lists
 * GET    /compliance-lists/:id                  → get list (with entries)
 * PUT    /compliance-lists/:id                  → update list
 * DELETE /compliance-lists/:id                  → soft-delete list
 *
 * POST   /compliance-lists/:id/entries          → add single entry
 * POST   /compliance-lists/:id/entries/bulk     → add entries in bulk
 * GET    /compliance-lists/:id/entries          → list entries
 * DELETE /compliance-lists/:id/entries/:entryId → remove entry
 */
@ApiTags('Compliance Lists')
@Controller('compliance-lists')
@UseGuards(OrganizationGuard)
export class ComplianceListController {
  constructor(private readonly complianceListService: ComplianceListService) {}

  // ─── List endpoints ─────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create compliance list',
    description: 'Create a new blacklist or whitelist',
  })
  @ApiCreatedResponse({ description: 'List created' })
  @ApiBadRequestResponse({ description: 'Validation error or duplicate code' })
  async createList(@OrgContext() ctx: OrganizationContext, @Body() dto: CreateComplianceListDto) {
    const list = await this.complianceListService.createList(ctx.organizationId, dto);
    return { success: true, data: list };
  }

  @Get()
  @ApiOperation({
    summary: 'List compliance lists',
    description: 'Returns all compliance lists with optional filters',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['BLACKLIST', 'WHITELIST'] })
  @ApiQuery({ name: 'entityType', required: false, enum: ['COUNTRY', 'ACCOUNT', 'COUNTERPARTY'] })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiOkResponse({ description: 'List of compliance lists' })
  async findAll(
    @OrgContext() ctx: OrganizationContext,
    @Query('type') type?: string,
    @Query('entityType') entityType?: string,
    @Query('isActive') isActive?: string,
  ) {
    const lists = await this.complianceListService.findAllLists(ctx.organizationId, {
      type,
      entityType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    return { success: true, data: lists, count: lists.length };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get compliance list', description: 'Returns a list with its entries' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiOkResponse({ description: 'List details with entries' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async findById(@OrgContext() ctx: OrganizationContext, @Param('id', ParseUUIDPipe) id: string) {
    const list = await this.complianceListService.findListById(id, ctx.organizationId);
    return { success: true, data: list };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update compliance list' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiOkResponse({ description: 'List updated' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async update(
    @OrgContext() ctx: OrganizationContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplianceListDto,
  ) {
    const list = await this.complianceListService.updateList(id, ctx.organizationId, dto);
    return { success: true, data: list };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete compliance list (soft)' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiNoContentResponse({ description: 'List deleted' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async delete(@OrgContext() ctx: OrganizationContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.complianceListService.deleteList(id, ctx.organizationId);
  }

  // ─── Entry endpoints ───────────────────────────────────────────

  @Post(':id/entries')
  @ApiOperation({ summary: 'Add entry to list' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiCreatedResponse({ description: 'Entry added' })
  @ApiBadRequestResponse({ description: 'Validation error or duplicate' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async addEntry(
    @OrgContext() ctx: OrganizationContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateComplianceListEntryDto,
  ) {
    const entry = await this.complianceListService.addEntry(id, ctx.organizationId, dto);
    return { success: true, data: entry };
  }

  @Post(':id/entries/bulk')
  @ApiOperation({
    summary: 'Add entries in bulk',
    description: 'Add multiple entries, skipping duplicates',
  })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiCreatedResponse({ description: 'Entries added' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async addEntriesBulk(
    @OrgContext() ctx: OrganizationContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkCreateEntriesDto,
  ) {
    const entries = await this.complianceListService.addEntriesBulk(
      id,
      ctx.organizationId,
      dto.entries,
    );
    return { success: true, data: entries, count: entries.length };
  }

  @Get(':id/entries')
  @ApiOperation({ summary: 'List entries in a compliance list' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiOkResponse({ description: 'List entries' })
  @ApiNotFoundResponse({ description: 'List not found' })
  async findEntries(
    @OrgContext() ctx: OrganizationContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const entries = await this.complianceListService.findEntries(id, ctx.organizationId);
    return { success: true, data: entries, count: entries.length };
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove entry from list' })
  @ApiParam({ name: 'id', description: 'List UUID' })
  @ApiParam({ name: 'entryId', description: 'Entry UUID' })
  @ApiNoContentResponse({ description: 'Entry removed' })
  @ApiNotFoundResponse({ description: 'List or entry not found' })
  async removeEntry(
    @OrgContext() ctx: OrganizationContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    await this.complianceListService.removeEntry(id, entryId, ctx.organizationId);
  }
}
