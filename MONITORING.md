# Система мониторинга приложения

Этот документ описывает систему мониторинга, интегрированную в NestJS boilerplate приложение. Система основана на стеке Prometheus + Grafana и предоставляет комплексный мониторинг производительности и здоровья приложения.

## 🚀 Быстрый старт

### 1. Запуск системы мониторинга

```bash
# Запуск только компонентов мониторинга
docker-compose -f docker-compose.monitoring.yml up -d

# Запуск приложения (в отдельном терминале)
pnpm run start:dev
```

### 2. Доступ к интерфейсам

- **Приложение**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
  - Логин: `admin`
  - Пароль: `admin123`
- **Node Exporter**: http://localhost:9100
- **cAdvisor**: http://localhost:8080

## 📊 Компоненты системы

### Prometheus
- **Порт**: 9090
- **Назначение**: Сбор и хранение метрик
- **Конфигурация**: `monitoring/prometheus/prometheus.yml`
- **Интервал сбора**: 15 секунд

### Grafana
- **Порт**: 3001
- **Назначение**: Визуализация метрик
- **Дашборды**: Автоматически загружаются из `monitoring/grafana/dashboards/`
- **Источники данных**: Автоматически настроенный Prometheus

### Node Exporter
- **Порт**: 9100
- **Назначение**: Системные метрики хоста (CPU, память, диск, сеть)

### cAdvisor
- **Порт**: 8080
- **Назначение**: Метрики Docker контейнеров

## 📈 Собираемые метрики

### HTTP метрики
- `http_requests_total` - Общее количество HTTP запросов
- `http_request_duration_seconds` - Время выполнения HTTP запросов

### Системные метрики приложения
- `nestjs_app_process_resident_memory_bytes` - Использование памяти
- `nestjs_app_process_cpu_user_seconds_total` - Использование CPU
- `nestjs_app_nodejs_gc_duration_seconds` - Время сборки мусора

### Метрики ошибок
- `application_errors_total` - Количество ошибок приложения

### Метрики соединений
- `active_connections` - Количество активных соединений
- `database_connections_active` - Активные соединения с БД

### Метрики базы данных
- `database_query_duration_seconds` - Время выполнения запросов к БД

## 🔧 Настройка

### Добавление кастомных метрик

1. Инжектируйте `MonitoringService` в ваш сервис:

```typescript
import { Injectable } from '@nestjs/common';
import { MonitoringService } from '../monitoring/monitoring.service';

@Injectable()
export class MyService {
  constructor(private readonly monitoringService: MonitoringService) {}

  async myMethod() {
    // Инкремент счетчика
    this.monitoringService.incrementHttpRequests('POST', '/api/users', 201);

    // Запись времени выполнения
    const startTime = Date.now();
    // ... ваша логика ...
    const duration = (Date.now() - startTime) / 1000;
    this.monitoringService.recordHttpRequestDuration('POST', '/api/users', 201, duration);

    // Запись ошибки
    this.monitoringService.incrementApplicationErrors('validation_error', '/api/users');
  }
}
```

2. Создайте кастомную метрику в `MonitoringService`:

```typescript
public readonly myCustomMetric = new Counter({
  name: 'my_custom_metric_total',
  help: 'Description of my custom metric',
  labelNames: ['label1', 'label2'],
  registers: [register],
});
```

### Настройка алертов

1. Создайте файл `monitoring/prometheus/alert_rules.yml`:

```yaml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(application_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"
```

2. Раскомментируйте секцию `rule_files` в `prometheus.yml`

### Создание кастомного дашборда

1. Создайте JSON файл в `monitoring/grafana/dashboards/`
2. Используйте существующий дашборд как шаблон
3. Перезапустите Grafana для загрузки нового дашборда

## 🔍 Мониторинг в production

### Рекомендации по настройке

1. **Retention**: Настройте время хранения метрик в Prometheus:
   ```yaml
   command:
     - '--storage.tsdb.retention.time=30d'
   ```

2. **Безопасность**: Измените пароли по умолчанию:
   ```yaml
   environment:
     - GF_SECURITY_ADMIN_PASSWORD=your_secure_password
   ```

3. **Ресурсы**: Выделите достаточно ресурсов для Prometheus:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '1.0'
   ```

### Интеграция с внешними системами

#### Kubernetes
```yaml
# prometheus-service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nestjs-app
spec:
  selector:
    matchLabels:
      app: nestjs-app
  endpoints:
  - port: http
    path: /metrics
```

#### AWS CloudWatch
Используйте [Prometheus CloudWatch exporter](https://github.com/prometheus/cloudwatch_exporter)

#### Slack уведомления
Настройте Alertmanager для отправки уведомлений в Slack

## 🐛 Отладка

### Проверка метрик

1. **Проверьте эндпоинт метрик**:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. **Проверьте targets в Prometheus**:
   - Откройте http://localhost:9090/targets
   - Убедитесь что все targets в состоянии "UP"

3. **Проверьте логи контейнеров**:
   ```bash
   docker-compose -f docker-compose.monitoring.yml logs prometheus
   docker-compose -f docker-compose.monitoring.yml logs grafana
   ```

### Частые проблемы

1. **Приложение не доступно из Docker**:
   - Убедитесь что используете правильный хост (`host.docker.internal` для Mac/Windows)
   - Проверьте что приложение запущено на порту 3000

2. **Метрики не отображаются**:
   - Проверьте что MonitoringMiddleware применен ко всем маршрутам
   - Убедитесь что делаете HTTP запросы к приложению

3. **Grafana не показывает данные**:
   - Проверьте подключение к Prometheus в настройках источников данных
   - Убедитесь что выбран правильный временной диапазон

## 📚 Дополнительные ресурсы

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)
- [Node.js Metrics Best Practices](https://nodejs.org/en/docs/guides/diagnostics/)

## 🤝 Разработка

### Добавление новых метрик

1. Определите тип метрики (Counter, Gauge, Histogram)
2. Добавьте метрику в `MonitoringService`
3. Добавьте метод для обновления метрики
4. Используйте метрику в бизнес-логике
5. Создайте визуализацию в Grafana
6. Добавьте тесты для новой метрики

### Тестирование

```bash
# Запуск тестов мониторинга
pnpm test -- --testPathPattern=monitoring

# Проверка метрик в тестовом режиме
curl http://localhost:3000/metrics/json | jq '.'
```

Система мониторинга готова к использованию и легко расширяется для специфичных потребностей вашего приложения.