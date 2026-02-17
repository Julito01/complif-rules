import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SignatureRequestService } from '../../application';
import { CreateSignatureRequestDto, AddSignatureDto } from '../dto';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';
import { EntityNotFoundException } from '../../../../shared/exceptions';

/**
 * Controller for managing signature requests.
 * All endpoints require organization context via x-organization-id header.
 */
@ApiTags('Signature Requests')
@Controller('signature-requests')
@UseGuards(OrganizationGuard)
export class SignatureRequestController {
  constructor(private readonly signatureRequestService: SignatureRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create signature request',
    description: 'Creates a new signature request for an account, faculty, and rule',
  })
  @ApiCreatedResponse({ description: 'Signature request created' })
  async create(@OrgContext() ctx: OrganizationContext, @Body() dto: CreateSignatureRequestDto) {
    const request = await this.signatureRequestService.create({
      idOrganization: ctx.organizationId,
      idAccount: dto.idAccount,
      idFaculty: dto.idFaculty,
      idRule: dto.idRule,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
      description: dto.description,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy: ctx.userId,
    });

    return {
      success: true,
      data: request,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get signature request status',
    description:
      'Returns request details, completion status, remaining signatures, and possible combinations',
  })
  @ApiParam({ name: 'id', description: 'Signature request UUID' })
  @ApiOkResponse({ description: 'Signature request with completion status' })
  @ApiNotFoundResponse({ description: 'Signature request not found' })
  async findById(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const result = await this.signatureRequestService.getStatus(id, ctx.organizationId);

    if (!result) {
      throw new EntityNotFoundException('SignatureRequest', id);
    }

    return {
      success: true,
      data: {
        request: result.request,
        isCompleted: result.isCompleted,
        remainingRequired: result.remainingRequired,
        possibleCombinations: result.possibleCombinations,
      },
    };
  }

  @Post(':id/signatures')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add signature',
    description: 'Adds a signature to a request and checks if authorization is satisfied',
  })
  @ApiParam({ name: 'id', description: 'Signature request UUID' })
  @ApiOkResponse({ description: 'Signature added with updated completion status' })
  async addSignature(
    @OrgContext() ctx: OrganizationContext,
    @Param('id') id: string,
    @Body() dto: AddSignatureDto,
  ) {
    const result = await this.signatureRequestService.addSignature(id, ctx.organizationId, {
      idSigner: dto.idSigner,
      idGroup: dto.idGroup,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    return {
      success: true,
      data: {
        request: result.request,
        isCompleted: result.isCompleted,
        remainingRequired: result.remainingRequired,
        possibleCombinations: result.possibleCombinations,
      },
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel signature request',
    description: 'Cancels a pending signature request',
  })
  @ApiParam({ name: 'id', description: 'Signature request UUID' })
  @ApiOkResponse({ description: 'Cancelled signature request' })
  async cancel(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const request = await this.signatureRequestService.cancel(id, ctx.organizationId);

    return {
      success: true,
      data: request,
    };
  }
}
