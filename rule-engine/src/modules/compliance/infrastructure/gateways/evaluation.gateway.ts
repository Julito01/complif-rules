import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway — Streams evaluation results in real time.
 *
 * Clients connect and join organization rooms to receive live evaluation events.
 *
 * Events emitted:
 *   - `evaluation:result`   — Full evaluation result after transaction ingestion
 *   - `evaluation:alert`    — Individual alert triggered by a rule
 *   - `evaluation:metrics`  — Periodic performance metrics snapshot
 *
 * Usage:
 *   const socket = io('http://localhost:3000/evaluations');
 *   socket.emit('subscribe', { organizationId: 'complif-001' });
 *   socket.on('evaluation:result', (data) => console.log(data));
 */
@WebSocketGateway({
  namespace: '/evaluations',
  cors: { origin: '*' },
})
export class EvaluationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EvaluationGateway.name);

  handleConnection(@ConnectedSocket() client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to an organization's evaluation stream.
   * Joins a Socket.IO room scoped to the org for multi-tenant isolation.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { organizationId: string },
  ): { event: string; data: { subscribed: boolean; organizationId: string } } {
    const { organizationId } = data;
    if (!organizationId) {
      return { event: 'error', data: { subscribed: false, organizationId: '' } };
    }

    client.join(`org:${organizationId}`);
    this.logger.log(`Client ${client.id} subscribed to org ${organizationId}`);

    return {
      event: 'subscribed',
      data: { subscribed: true, organizationId },
    };
  }

  /**
   * Client unsubscribes from an organization's stream.
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { organizationId: string },
  ): { event: string; data: { unsubscribed: boolean } } {
    const { organizationId } = data;
    client.leave(`org:${organizationId}`);
    this.logger.log(`Client ${client.id} unsubscribed from org ${organizationId}`);
    return { event: 'unsubscribed', data: { unsubscribed: true } };
  }

  // ─── Emit methods called by services ──────────────────────────

  /**
   * Broadcast an evaluation result to all subscribers of the organization.
   */
  emitEvaluationResult(organizationId: string, result: EvaluationEvent): void {
    this.server?.to(`org:${organizationId}`).emit('evaluation:result', result);
  }

  /**
   * Broadcast an alert to all subscribers of the organization.
   */
  emitAlert(organizationId: string, alert: AlertEvent): void {
    this.server?.to(`org:${organizationId}`).emit('evaluation:alert', alert);
  }

  /**
   * Broadcast a metrics snapshot.
   */
  emitMetrics(metrics: MetricsEvent): void {
    this.server?.emit('evaluation:metrics', metrics);
  }
}

// ─── Event types ──────────────────────────────────────────────────

export interface EvaluationEvent {
  transactionId: string;
  accountId: string;
  decision: string;
  triggeredRulesCount: number;
  totalRulesEvaluated: number;
  evaluationDurationMs: number | null;
  timestamp: string;
}

export interface AlertEvent {
  alertId: string;
  transactionId: string;
  severity: string;
  category: string;
  message: string | null;
  timestamp: string;
}

export interface MetricsEvent {
  throughput: number;
  avgLatencyMs: number;
  cacheHitRate: string;
  activeConnections: number;
  timestamp: string;
}
