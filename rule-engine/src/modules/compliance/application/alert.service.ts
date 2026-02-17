import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Alert } from '../domain';
import {
  EntityNotFoundException,
  ValidationException,
  InvalidStateException,
} from '../../../shared/exceptions';

const VALID_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const;
type AlertStatus = (typeof VALID_STATUSES)[number];

/**
 * Valid status transitions:
 *   OPEN → ACKNOWLEDGED | RESOLVED | DISMISSED
 *   ACKNOWLEDGED → RESOLVED | DISMISSED
 *   RESOLVED → (terminal)
 *   DISMISSED → (terminal)
 */
const VALID_TRANSITIONS: Record<string, AlertStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

/**
 * Application service for managing alerts.
 */
@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async findById(id: string, idOrganization: string): Promise<Alert | null> {
    return this.alertRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<Alert>,
    });
  }

  async findAll(
    idOrganization: string,
    filters?: {
      idAccount?: string;
      status?: string;
      severity?: string;
      category?: string;
      limit?: number;
    },
  ): Promise<Alert[]> {
    const qb = this.alertRepository
      .createQueryBuilder('a')
      .where('a.id_organization = :orgId', { orgId: idOrganization })
      .orderBy('a.created_at', 'DESC')
      .limit(filters?.limit || 50);

    if (filters?.idAccount) {
      qb.andWhere('a.id_account = :accountId', { accountId: filters.idAccount });
    }
    if (filters?.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters?.severity) {
      qb.andWhere('a.severity = :severity', { severity: filters.severity });
    }
    if (filters?.category) {
      qb.andWhere('a.category = :category', { category: filters.category });
    }

    return qb.getMany();
  }

  async updateStatus(
    id: string,
    idOrganization: string,
    status: string,
    updatedBy?: string,
  ): Promise<Alert> {
    // Validate status value
    if (!VALID_STATUSES.includes(status as AlertStatus)) {
      throw new ValidationException(
        `Invalid alert status: "${status}". Valid statuses: ${VALID_STATUSES.join(', ')}`,
      );
    }

    const alert = await this.alertRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<Alert>,
    });

    if (!alert) {
      throw new EntityNotFoundException('Alert', id);
    }

    // Validate state transition
    const allowedTransitions = VALID_TRANSITIONS[alert.status] || [];
    if (!allowedTransitions.includes(status as AlertStatus)) {
      throw new InvalidStateException(
        `Cannot transition alert from "${alert.status}" to "${status}". ` +
          `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : '(none — terminal state)'}`,
        alert.status,
        allowedTransitions,
      );
    }

    alert.status = status;
    alert.updatedBy = updatedBy || null;

    if (status === 'RESOLVED' || status === 'DISMISSED') {
      alert.resolvedAt = new Date();
      alert.resolvedBy = updatedBy || null;
    }

    return this.alertRepository.save(alert);
  }
}
