// import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
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
        winston.format.printf(({ timestamp, level, message, context, trace }) => {
          return `${timestamp} [${context || 'NestJS'}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
        })
      ),
    }),
  ],
  level: process.env.LOG_LEVEL || 'info',
};
