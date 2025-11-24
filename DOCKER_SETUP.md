# Docker Setup - Быстрый старт

## Требования

- Docker Desktop (Mac/Windows) или Docker Engine + Docker Compose (Linux)
- Минимум 4 GB RAM
- Порты 3000 и 5141 должны быть свободны

## Быстрый запуск с Makefile

Если у вас установлен `make`, вы можете использовать удобные команды:

```bash
make help          # Показать все доступные команды
make up            # Запустить production
make dev-up        # Запустить development
make down          # Остановить все сервисы
make logs          # Показать логи
make rebuild       # Пересобрать production
make dev-rebuild   # Пересобрать development
```

## Запуск проекта (без Makefile)

### 1. Production режим

Сборка и запуск:
```bash
docker-compose up --build
```

Эта команда:
- Соберет оптимизированные Docker образы
- Backend будет доступен на `http://localhost:5141`
- Frontend будет доступен на `http://localhost:3000`

В фоновом режиме:
```bash
docker-compose up -d --build
```

### 2. Development режим (с hot-reload)

Сборка и запуск:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

Эта команда:
- Соберет dev образы с поддержкой hot-reload
- Изменения в коде будут автоматически применяться
- Backend будет доступен на `http://localhost:5141`
- Frontend будет доступен на `http://localhost:5173`

В фоновом режиме:
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### 3. Просмотр логов

Все сервисы:
```bash
docker-compose logs -f
```

Только backend:
```bash
docker-compose logs -f backend
```

Только frontend:
```bash
docker-compose logs -f frontend
```

### 4. Остановка сервисов

```bash
docker-compose down
```

Остановка с удалением volumes:
```bash
docker-compose down -v
```

### 5. Перезапуск одного сервиса

```bash
docker-compose restart backend
# или
docker-compose restart frontend
```

### 6. Пересборка после изменений в коде

```bash
docker-compose up --build --force-recreate
```

## Проверка работоспособности

### Production режим

1. Откройте браузер и перейдите на `http://localhost:3000`
2. Создайте комнату или присоединитесь по коду
3. Откройте второе окно браузера (или режим инкогнито)
4. Присоединитесь к той же комнате по коду
5. Отправьте сообщения в чате - они должны появиться в обоих окнах

### Development режим

1. Откройте браузер и перейдите на `http://localhost:5173`
2. Следуйте тем же шагам, что и для production
3. Попробуйте изменить файл `mafia_fe/src/components/Chat.tsx` - изменения применятся автоматически

## Troubleshooting

### Проблема: Порт уже занят

```bash
# Проверить, что использует порт
lsof -i :3000
lsof -i :5141

# Изменить порты в docker-compose.yml
# Например: "3001:80" вместо "3000:80"
```

### Проблема: Образы не обновляются

```bash
# Очистить все образы и пересобрать
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Проблема: WebSocket не подключается

1. Проверьте логи backend: `docker-compose logs backend`
2. Убедитесь, что CORS настроен правильно
3. Проверьте, что оба сервиса запущены: `docker-compose ps`

### Проблема: Frontend не видит backend

1. Проверьте переменную окружения `VITE_API_URL` в `mafia_fe/.env`
2. Убедитесь, что backend доступен: `curl http://localhost:5141/api/Room/my?userId=test`

## Полезные команды

```bash
# Показать запущенные контейнеры
docker-compose ps

# Зайти внутрь контейнера
docker-compose exec backend bash
docker-compose exec frontend sh

# Удалить все остановленные контейнеры
docker-compose rm

# Показать использование ресурсов
docker stats
```

## Структура Docker

```
┌─────────────────────────────────────────┐
│         docker-compose.yml              │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
    ┌───▼────┐         ┌─────▼───┐
    │Backend │         │Frontend │
    │:5141   │◄────────┤:3000    │
    └────────┘         └─────────┘
     ASP.NET            React+Nginx
```

## Production deployment

Для production рекомендуется:

1. Использовать переменные окружения для настройки
2. Добавить reverse proxy (nginx/traefik)
3. Включить HTTPS
4. Настроить логирование
5. Добавить health checks
6. Использовать secrets для чувствительных данных

Пример production docker-compose:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./Mafia
      dockerfile: Dockerfile
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ASPNETCORE_URLS=https://+:443;http://+:80
    volumes:
      - ./certs:/https:ro
    
  frontend:
    build:
      context: ./mafia_fe
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=https://api.yourdomain.com
```

