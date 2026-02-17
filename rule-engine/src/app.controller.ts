import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Hello world', description: 'Returns a greeting message' })
  @ApiOkResponse({ description: 'Greeting string' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns API health status' })
  @ApiOkResponse({ description: 'Health status with timestamp' })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Performance metrics',
    description:
      'Returns latency percentiles (p50/p95/p99), throughput, active rule count, and alert count. ' +
      'Computed from persisted evaluation data within a configurable time window.',
  })
  @ApiQuery({
    name: 'windowMinutes',
    required: false,
    description: 'Time window in minutes for metric computation (default: 60)',
    type: Number,
  })
  @ApiOkResponse({ description: 'Performance metrics JSON' })
  async getMetrics(@Query('windowMinutes') windowMinutes?: string) {
    const window = parseInt(windowMinutes || '60', 10) || 60;
    return this.appService.getMetrics(window);
  }

  @Post('seed')
  @ApiOperation({
    summary: 'Seed database',
    description: 'Idempotent seed of reference data for both modules',
  })
  @ApiCreatedResponse({ description: 'Seed completed with entity IDs' })
  async seed() {
    const ids = await this.appService.seed();
    return {
      success: true,
      message: 'Database seeded (idempotent)',
      data: ids,
    };
  }
}
