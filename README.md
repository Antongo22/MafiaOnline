# Игра в Мафию

Многопользовательская игра в мафию с WebSocket чатом.

## Технологии

### Backend
- ASP.NET Core 9.0
- SignalR (WebSocket)
- In-memory хранилище

### Frontend
- React 19
- TypeScript
- Vite
- SignalR Client

## Запуск через Docker Compose

### Требования
- Docker
- Docker Compose

### Самый быстрый запуск

**Для новичков** (используйте интерактивный скрипт):
```bash
./start.sh
```

**С Makefile** (если установлен `make`):
```bash
make up          # Production режим
make dev-up      # Development режим с hot-reload
make down        # Остановить
make logs        # Показать логи
```

### Подробный запуск

1. Клонируйте репозиторий и перейдите в директорию проекта:
```bash
cd Mafia
```

2. Запустите все сервисы:

**Production режим:**
```bash
docker-compose up --build
```

**Development режим (с hot-reload):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

3. Откройте браузер:

**Production:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5141

**Development:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5141

### Остановка

```bash
docker-compose down
# или для dev режима
docker-compose -f docker-compose.dev.yml down
```

## Локальный запуск (для разработки)

### Backend

1. Перейдите в директорию backend:
```bash
cd Mafia
```

2. Восстановите зависимости:
```bash
dotnet restore
```

3. Запустите приложение:
```bash
dotnet run
```

Backend будет доступен на http://localhost:5141

### Frontend

1. Перейдите в директорию frontend:
```bash
cd mafia_fe
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите dev сервер:
```bash
npm run dev
```

Frontend будет доступен на http://localhost:5173

## Как играть

1. **Создайте комнату**: введите своё имя и название комнаты
2. **Поделитесь кодом**: получите код приглашения и отправьте друзьям
3. **Присоединяйтесь**: друзья могут присоединиться по коду
4. **Общайтесь**: используйте встроенный чат для общения в реальном времени

## Особенности

- Регистрация не требуется (только никнейм)
- Чат работает через WebSocket (SignalR)
- История сообщений сохраняется пока комната активна
- Автоматическое переподключение при разрыве соединения
- Изоляция чатов по комнатам

## Архитектура

```
┌─────────────┐         WebSocket (SignalR)         ┌─────────────┐
│   Browser   │ <──────────────────────────────────> │   ASP.NET   │
│  (React)    │                                      │    Core     │
└─────────────┘         HTTP REST API               └─────────────┘
                  (создание/присоединение)
```

## API Endpoints

### REST API
- `POST /api/Room/create` - Создать комнату
- `POST /api/Room/invite` - Присоединиться к комнате
- `GET /api/Room/my` - Получить свою комнату

### WebSocket Hub
- `/chatHub` - SignalR Hub для чата
  - `JoinRoom(roomId, userId)` - Присоединиться к чату комнаты
  - `SendMessage(roomId, userId, userName, message)` - Отправить сообщение

## Структура проекта

```
Mafia/
├── Mafia/                  # Backend (ASP.NET Core)
│   ├── Controllers/        # REST API контроллеры
│   ├── DTOs/              # Data Transfer Objects
│   ├── Enums/             # Перечисления
│   ├── Hubs/              # SignalR Hubs
│   ├── Services/          # Бизнес-логика
│   └── Program.cs         # Точка входа
├── mafia_fe/              # Frontend (React)
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы
│   │   └── services/      # Сервисы (SignalR)
│   └── package.json
├── docker-compose.yml     # Docker Compose конфигурация
└── README.md
```

## Разработка

### Переменные окружения

Frontend (`.env`):
```
VITE_API_URL=http://localhost:5141
```

Backend (`appsettings.Development.json`):
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

## Лицензия

MIT

