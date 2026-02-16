import 'reflect-metadata';
import cron from 'node-cron';
import app from './app';
import { AppDataSource } from './config/database';
import { config } from './config';
import logger from './utils/logger';
import { initializeSocketServer } from './socket/socketServer';
import { RainyDaySmsService } from './services/RainyDaySmsService';

// Refund kolonları eklendi - 10.12.2025

const startServer = async () => {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established successfully');

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API URL: http://localhost:${config.port}/api/v1`);
    });

    // Initialize Socket.io server
    initializeSocketServer(server);
    logger.info('Socket.io server initialized and ready for connections');

    // Yağmurlu gün SMS: Her gün 09:00 (Europe/Istanbul) çalışır
    const rainyDaySmsService = new RainyDaySmsService();
    cron.schedule(
      '0 9 * * *',
      async () => {
        try {
          logger.info('Yağmurlu gün SMS cron job başladı');
          const result = await rainyDaySmsService.runRainyDaySms();
          logger.info('Yağmurlu gün SMS tamamlandı', {
            citiesChecked: result.citiesChecked,
            rainyCitiesCount: result.rainyCitiesCount,
            smsSent: result.smsSent,
            rainyCities: result.rainyCities,
          });
          if (result.errors.length > 0) {
            logger.warn('Yağmurlu gün SMS hataları', { errors: result.errors });
          }
        } catch (err: any) {
          logger.error('Yağmurlu gün SMS cron hatası', { error: err?.message || err });
        }
      },
      { timezone: 'Europe/Istanbul' }
    );
    logger.info('Yağmurlu gün SMS cron scheduled (09:00 Europe/Istanbul)');

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await AppDataSource.destroy();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
