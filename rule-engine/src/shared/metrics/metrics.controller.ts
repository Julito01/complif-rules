import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Prometheus metrics endpoint.
 *
 * GET /metrics — Returns all metrics in Prometheus exposition format.
 * Designed to be scraped by Prometheus every 15s.
 */
@ApiTags('Observability')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Prometheus metrics',
    description: 'Returns application metrics in Prometheus exposition format for scraping',
  })
  @ApiOkResponse({ description: 'Prometheus metrics in text format' })
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }
}
