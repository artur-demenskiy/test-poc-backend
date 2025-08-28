import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { MonitoringService } from '../monitoring/monitoring.service';

/**
 * Кастомный health indicator для мониторинга состояния базы данных
 *
 * Проверяет:
 * - Доступность соединения с базой данных
 * - Время отклика на простой запрос
 * - Количество активных соединений
 *
 * Автоматически записывает метрики в Prometheus
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly monitoringService: MonitoringService) {
    super();
  }

  /**
   * Проверка состояния базы данных
   *
   * @param key Ключ для идентификации проверки
   * @returns Результат проверки здоровья БД
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Здесь должна быть реальная проверка БД
      // Для примера используем простую симуляцию
      await this.checkDatabaseConnection();

      const responseTime = Date.now() - startTime;

      // Записываем метрики производительности БД
      this.monitoringService.recordDatabaseQueryDuration(
        'HEALTH_CHECK',
        'system',
        responseTime / 1000 // конвертируем в секунды
      );

      // Симулируем количество активных соединений (в реальном приложении получаем из пула соединений)
      const activeConnections = this.getActiveConnectionsCount();
      this.monitoringService.setDatabaseConnections(activeConnections);

      const result = this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        activeConnections,
        status: 'up',
      });

      return result;
    } catch (error) {
      // Записываем ошибку в метрики
      this.monitoringService.incrementApplicationErrors('database_error', '/health');

      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : String(error),
          status: 'down',
        })
      );
    }
  }

  /**
   * Проверка соединения с базой данных
   * В реальном приложении здесь должен быть код для проверки БД
   */
  private async checkDatabaseConnection(): Promise<void> {
    // Симуляция проверки БД
    // В реальном приложении здесь должен быть код типа:
    // await this.databaseService.query('SELECT 1');

    await new Promise(resolve => globalThis.setTimeout(resolve, Math.random() * 100)); // случайная задержка 0-100ms

    // Симулируем редкие ошибки для демонстрации
    if (Math.random() < 0.01) {
      // 1% вероятность ошибки
      throw new Error('Database connection timeout');
    }
  }

  /**
   * Получение количества активных соединений
   * В реальном приложении получаем из пула соединений
   */
  private getActiveConnectionsCount(): number {
    // Симуляция количества соединений
    // В реальном приложении:
    // return this.databaseService.getConnectionPool().activeConnections;
    return Math.floor(Math.random() * 10) + 1; // 1-10 соединений
  }
}
