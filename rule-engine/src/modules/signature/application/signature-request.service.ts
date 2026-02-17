import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SignatureRequest, Signature, SignatureRule, SignerGroup, Signer } from '../domain';
import { RuleEvaluator, GroupSignatureCounts } from '../domain/services/rule-evaluator.service';
import { SignatureRequestStatus } from '../domain/value-objects/signature-request-status.vo';
import { SignatureStatus } from '../domain/value-objects/signature-status.vo';
import {
  EntityNotFoundException,
  InactiveEntityException,
  InvalidStateException,
  DuplicateOperationException,
} from '../../../shared/exceptions';

export interface CreateSignatureRequestInput {
  idOrganization: string;
  idAccount: string;
  idFaculty: string;
  idRule: string;
  referenceId?: string;
  referenceType?: string;
  description?: string;
  expiresAt?: Date;
  createdBy?: string;
}

export interface AddSignatureInput {
  idSigner: string;
  idGroup: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignatureRequestResult {
  request: SignatureRequest;
  isCompleted: boolean;
  remainingRequired: GroupSignatureCounts | null;
  possibleCombinations: GroupSignatureCounts[];
}

/**
 * Application service for managing signature request lifecycle.
 *
 * Per signature-request-lifecycle skill:
 * - State transitions MUST be explicit
 * - COMPLETED is a terminal state
 * - Every state change SHOULD be auditable
 */
@Injectable()
export class SignatureRequestService {
  constructor(
    @InjectRepository(SignatureRequest)
    private readonly requestRepository: Repository<SignatureRequest>,
    @InjectRepository(Signature)
    private readonly signatureRepository: Repository<Signature>,
    @InjectRepository(SignatureRule)
    private readonly ruleRepository: Repository<SignatureRule>,
    @InjectRepository(SignerGroup)
    private readonly groupRepository: Repository<SignerGroup>,
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
  ) {}

  /**
   * Create a new signature request.
   */
  async create(input: CreateSignatureRequestInput): Promise<SignatureRequest> {
    // Load the rule to snapshot it
    const rule = await this.ruleRepository.findOne({
      where: {
        id: input.idRule,
        idOrganization: input.idOrganization,
      } as FindOptionsWhere<SignatureRule>,
    });

    if (!rule) {
      throw new EntityNotFoundException('SignatureRule', input.idRule);
    }

    if (!rule.isActive) {
      throw new InactiveEntityException('SignatureRule', input.idRule);
    }

    const request = this.requestRepository.create({
      idOrganization: input.idOrganization,
      idAccount: input.idAccount,
      idFaculty: input.idFaculty,
      idRule: input.idRule,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      description: input.description,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
      status: SignatureRequestStatus.CREATED,
      ruleSnapshot: rule.ruleDefinition, // Snapshot the rule
      signatures: [],
    });

    return this.requestRepository.save(request);
  }

  /**
   * Add a signature to a request and evaluate if it's now complete.
   */
  async addSignature(
    requestId: string,
    idOrganization: string,
    input: AddSignatureInput,
  ): Promise<SignatureRequestResult> {
    // Load request with signatures and groups
    const request = await this.requestRepository.findOne({
      where: {
        id: requestId,
        idOrganization,
      } as FindOptionsWhere<SignatureRequest>,
      relations: ['signatures', 'signatures.group'],
    });

    if (!request) {
      throw new EntityNotFoundException('SignatureRequest', requestId);
    }

    if (request.isTerminal()) {
      throw new InvalidStateException(
        `Cannot add signature to request with status ${request.status}`,
        request.status,
        [SignatureRequestStatus.CREATED, SignatureRequestStatus.IN_PROGRESS],
      );
    }

    // Validate signer exists and is active
    const signer = await this.signerRepository.findOne({
      where: {
        id: input.idSigner,
        idOrganization,
      } as FindOptionsWhere<Signer>,
    });

    if (!signer) {
      throw new EntityNotFoundException('Signer', input.idSigner);
    }

    // Validate group exists
    const group = await this.groupRepository.findOne({
      where: {
        id: input.idGroup,
        idOrganization,
      } as FindOptionsWhere<SignerGroup>,
    });

    if (!group) {
      throw new EntityNotFoundException('SignerGroup', input.idGroup);
    }

    // Check if signer already signed this request
    const existingSignature = request.signatures.find(
      (s) => s.idSigner === input.idSigner && s.status === SignatureStatus.SIGNED,
    );

    if (existingSignature) {
      throw new DuplicateOperationException(
        'Signer has already signed this request',
        'Signature',
        input.idSigner,
      );
    }

    // Create and sign the signature
    const signature = this.signatureRepository.create({
      idOrganization,
      idRequest: requestId,
      idSigner: input.idSigner,
      idGroup: input.idGroup,
      status: SignatureStatus.PENDING,
      createdBy: input.idSigner,
    });

    signature.sign(input.ipAddress, input.userAgent);
    await this.signatureRepository.save(signature);

    // Add group to signature for evaluation
    signature.group = group;
    request.signatures.push(signature);

    // Transition to IN_PROGRESS if this is the first signature
    if (request.status === SignatureRequestStatus.CREATED) {
      request.markInProgress();
    }

    // Evaluate if the rule is now satisfied
    const counts = this.buildGroupCounts(request.signatures);
    const isSatisfied = RuleEvaluator.evaluate(request.ruleSnapshot, counts);

    if (isSatisfied) {
      request.complete();
    }

    await this.requestRepository.save(request);

    return {
      request,
      isCompleted: isSatisfied,
      remainingRequired: isSatisfied
        ? null
        : RuleEvaluator.getRemainingRequired(request.ruleSnapshot, counts),
      possibleCombinations: RuleEvaluator.getPossibleCombinations(request.ruleSnapshot),
    };
  }

  /**
   * Get a signature request by ID.
   */
  async findById(id: string, idOrganization: string): Promise<SignatureRequest | null> {
    return this.requestRepository.findOne({
      where: {
        id,
        idOrganization,
      } as FindOptionsWhere<SignatureRequest>,
      relations: ['signatures', 'signatures.group', 'signatures.signer'],
    });
  }

  /**
   * Get the current status and remaining requirements for a request.
   */
  async getStatus(id: string, idOrganization: string): Promise<SignatureRequestResult | null> {
    const request = await this.findById(id, idOrganization);

    if (!request) {
      return null;
    }

    const counts = this.buildGroupCounts(request.signatures);
    const isCompleted = request.status === SignatureRequestStatus.COMPLETED;

    return {
      request,
      isCompleted,
      remainingRequired: isCompleted
        ? null
        : RuleEvaluator.getRemainingRequired(request.ruleSnapshot, counts),
      possibleCombinations: RuleEvaluator.getPossibleCombinations(request.ruleSnapshot),
    };
  }

  /**
   * Cancel a signature request.
   */
  async cancel(id: string, idOrganization: string): Promise<SignatureRequest> {
    const request = await this.requestRepository.findOne({
      where: {
        id,
        idOrganization,
      } as FindOptionsWhere<SignatureRequest>,
    });

    if (!request) {
      throw new EntityNotFoundException('SignatureRequest', id);
    }

    request.cancel();
    return this.requestRepository.save(request);
  }

  /**
   * Build group counts from signatures.
   */
  private buildGroupCounts(signatures: Signature[]): GroupSignatureCounts {
    const counts: GroupSignatureCounts = {};

    for (const sig of signatures) {
      if (sig.status === SignatureStatus.SIGNED && sig.group) {
        const groupCode = sig.group.code;
        counts[groupCode] = (counts[groupCode] || 0) + 1;
      }
    }

    return counts;
  }
}
