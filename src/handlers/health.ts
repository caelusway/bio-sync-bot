import { Request, Response } from 'express';
import { databaseService } from '@/services/database';
import { discordService } from '@/services/discord';
import { logger } from '@/utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      error: string | undefined;
    };
    discord: {
      status: 'healthy' | 'unhealthy';
      ready: boolean;
      error: string | undefined;
    };
  };
}

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Check database health
    const dbHealthResult = await databaseService.getHealthStatus();
    const dbHealth = {
      status: dbHealthResult.success ? 'healthy' as const : 'unhealthy' as const,
      error: dbHealthResult.error || undefined
    };

    // Check Discord bot health
    const discordReady = discordService.isReady();
    const discordHealth = {
      status: discordReady ? 'healthy' as const : 'unhealthy' as const,
      ready: discordReady,
      error: discordReady ? undefined : 'Discord bot not ready'
    };
    
    const overallHealth = dbHealth.status === 'healthy' && discordHealth.status === 'healthy' 
      ? 'healthy' as const 
      : 'unhealthy' as const;
    
    const healthStatus: HealthStatus = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        discord: discordHealth
      }
    };

    const responseTime = Date.now() - startTime;
    logger.debug(`Health check completed in ${responseTime}ms`);

    if (overallHealth === 'healthy') {
      res.status(200).json(healthStatus);
    } else {
      res.status(503).json(healthStatus);
    }
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
}

export async function readinessCheck(_req: Request, res: Response): Promise<void> {
  try {
    const isReady = discordService.isReady();
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Discord bot not ready'
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
}

export async function livenessCheck(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
} 