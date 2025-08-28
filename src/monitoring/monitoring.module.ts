import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { MonitoringMiddleware } from './monitoring.middleware';

/**
 * Модуль мониторинга
 *
 * Предоставляет интеграцию с Prometheus для сбора метрик приложения.
 *
 * Включает:
 * - MonitoringService - сервис для работы с метриками
 * - MonitoringController - контроллер для эндпоинтов метрик
 * - MonitoringMiddleware - middleware для автоматического сбора HTTP метрик
 *
 * Автоматически собирает:
 * - HTTP метрики (запросы, время ответа, ошибки)
 * - Системные метрики Node.js (CPU, память, GC)
 * - Кастомные бизнес-метрики
 *
 * Использование:
 * 1. Импортировать модуль в AppModule
 * 2. Настроить Prometheus для scraping эндпоинта /metrics
 * 3. Настроить Grafana дашборды для визуализации
 */
@Module({
  providers: [MonitoringService],
  controllers: [MonitoringController],
  exports: [MonitoringService], // Экспортируем сервис для использования в других модулях
})
export class MonitoringModule implements NestModule {
  /**
   * Конфигурируем middleware для автоматического сбора HTTP метрик
   *
   * Применяется ко всем маршрутам кроме самого эндпоинта метрик
   * чтобы избежать рекурсивного сбора метрик
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MonitoringMiddleware)
      .exclude('metrics', 'metrics/json') // Исключаем эндпоинты метрик
      .forRoutes('*'); // Применяем ко всем остальным маршрутам
  }
}
