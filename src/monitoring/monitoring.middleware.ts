import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';

/**
 * Middleware для сбора HTTP метрик
 *
 * Автоматически собирает метрики для всех HTTP запросов:
 * - Количество запросов по методам, маршрутам и статус кодам
 * - Время выполнения запросов
 * - Счетчик ошибок
 *
 * Применяется глобально ко всем маршрутам приложения
 * для автоматического мониторинга без изменения бизнес-логики
 */
@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  constructor(private readonly monitoringService: MonitoringService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Получаем базовую информацию о запросе
    const method = req.method;
    const originalUrl = req.originalUrl || req.url;

    // Нормализуем маршрут для метрик (убираем query параметры и ID)
    const route = this.normalizeRoute(originalUrl);

    // Перехватываем завершение ответа
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000; // конвертируем в секунды
      const statusCode = res.statusCode;

      // Записываем метрики
      this.monitoringService.incrementHttpRequests(method, route, statusCode);
      this.monitoringService.recordHttpRequestDuration(method, route, statusCode, duration);

      // Записываем ошибки для статус кодов >= 400
      if (statusCode >= 400) {
        const errorType = this.getErrorType(statusCode);
        this.monitoringService.incrementApplicationErrors(errorType, route);
      }
    });

    next();
  }

  /**
   * Нормализует маршрут для метрик
   *
   * Убирает query параметры и заменяет числовые ID на плейсхолдеры
   * для уменьшения кардинальности метрик
   *
   * @param url Исходный URL
   * @returns Нормализованный маршрут
   */
  private normalizeRoute(url: string): string {
    // Убираем query параметры
    const pathWithoutQuery = url.split('?')[0];

    // Заменяем числовые ID на плейсхолдеры для снижения кардинальности
    const normalizedPath = pathWithoutQuery
      .replace(/\/\d+/g, '/:id') // /users/123 -> /users/:id
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid'); // UUID -> :uuid

    return normalizedPath || '/';
  }

  /**
   * Определяет тип ошибки по статус коду
   *
   * @param statusCode HTTP статус код
   * @returns Тип ошибки для метрик
   */
  private getErrorType(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    }
    if (statusCode >= 500) {
      return 'server_error';
    }
    return 'unknown_error';
  }
}
