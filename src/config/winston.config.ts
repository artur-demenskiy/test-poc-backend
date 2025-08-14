import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

/**
 * Winston configuration for the application
 */
export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        nestWinstonModuleUtilities.format.nestLike('NestJS', {
          prettyPrint: true,
          colors: true,
        })
      ),
    }),
  ],
  level: process.env.LOG_LEVEL || 'info',
};
