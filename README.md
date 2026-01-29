# 🎭 Mafia Online

Многопользовательская игра в мафию с видеозвонками и WebSocket чатом.

## 🚀 Технологии

### Backend
- ASP.NET Core 9.0
- SignalR (WebSocket)
- In-memory хранилище
- Интеграция с Trexon Calls (видеозвонки)

### Frontend
- React 19
- TypeScript
- Vite
- SignalR Client
- LiveKit (видеозвонки)

## 📹 Видеозвонки

Игра интегрирована с **Trexon Calls** для видео/аудио связи между игроками.

### Возможности:
- Автоматическое создание видеокомнаты при старте игры
- Управление микрофонами по фазам игры
- Подсветка активного спикера
- Уникальные имена участников

### Управление медиа по фазам:

| Фаза игры | Микрофоны | Камеры |
|-----------|-----------|--------|
| IndividualSpeech | Только у выступающего | У всех |
| FreeDiscussion | У всех | У всех |
| Voting | Выключены | У всех |
| Night | Выключены | Выключены |
| GameOver | У всех | У всех |

### Конфигурация (.env):
```bash
CALLS_API_URL=https://calls.trexon.ru/
MASTER_ADMIN_KEY=your_master_admin_key
```

## 🐳 Запуск через Docker Compose

### Требования
- Docker
- Docker Compose

### Подробный запуск

1. Клонируйте репозиторий и перейдите в директорию проекта:
```bash
cd Mafia
```

2. Настройте переменные окружения:
```bash
cp .env.example .env
# Отредактируйте .env
```

3. Запустите все сервисы:

**Production режим:**
```bash
docker-compose up --build
```

**Development режим (с hot-reload):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

4. Откройте браузер:

**Production:**
- Frontend: http://localhost
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

## 💻 Локальный запуск (для разработки)

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

## 🎮 Как играть

1. **Создайте комнату**: введите своё имя и название комнаты
2. **Поделитесь кодом**: получите код приглашения и отправьте друзьям
3. **Присоединяйтесь**: друзья могут присоединиться по коду
4. **Видеозвонок**: автоматически подключается при входе в комнату
5. **Играйте**: ведущий управляет игрой, микрофоны переключаются автоматически

## ✨ Особенности

- 📹 Встроенные видеозвонки
- 💬 Чат через WebSocket (SignalR)
- 🎤 Автоматическое управление микрофонами по фазам
- 👤 Регистрация не требуется (только никнейм)
- 🔄 Автоматическое переподключение при разрыве
- 🏠 Изоляция комнат
- 🗑️ Автоудаление пустых комнат через 5 минут

## 🧪 Тестирование

Проект покрыт автоматическими тестами (Unit и Integration).

- [Документация по тестированию](./docs/TESTING_REPORT.md)
- [Тест-кейсы (CSV)](./docs/test_cases.csv)
- [Mind Map](./docs/testing_mindmap.drawio)

### Запуск тестов
```bash
cd Mafia
dotnet test
```

## 🏗️ Архитектура

```
┌─────────────┐         WebSocket (SignalR)         ┌─────────────┐
│   Browser   │ <────────────────────────────────> │   ASP.NET   │
│  (React)    │                                     │    Core     │
└──────┬──────┘         HTTP REST API              └──────┬──────┘
       │                                                   │
       │  WebRTC                              REST API     │
       │                                                   │
       ▼                                                   ▼
┌─────────────┐                                   ┌─────────────┐
│  Trexon     │ <─────────────────────────────── │   Calls     │
│   Calls     │         Admin API                │   Backend   │
│  (LiveKit)  │                                   └─────────────┘
└─────────────┘
```

## 📡 API Endpoints

### REST API
- `POST /api/Room/create` - Создать комнату
- `POST /api/Room/invite` - Присоединиться к комнате
- `GET /api/Room/my` - Получить свою комнату

### WebSocket Hub
- `/chatHub` - SignalR Hub для чата
  - `JoinRoom(roomId, userId)` - Присоединиться к чату комнаты
  - `SendMessage(roomId, userId, userName, message)` - Отправить сообщение

### VideoCallService (внутренний)
- `CreateRoomAsync(roomName, creatorName)` - Создать видеокомнату
- `MuteAllAudioAsync(roomName, exceptUser)` - Выключить микрофоны всем
- `UnmuteAllAudioAsync(roomName)` - Включить микрофоны всем
- `MuteUserAudioAsync(roomName, identity, muted)` - Управление микрофоном игрока
- `MuteAllVideoAsync(roomName)` - Выключить камеры
- `UnmuteAllVideoAsync(roomName)` - Включить камеры

## 📁 Структура проекта

```
Mafia/
├── Mafia/                  # Backend (ASP.NET Core)
│   ├── Controllers/        # REST API контроллеры
│   ├── DTOs/              # Data Transfer Objects
│   ├── Enums/             # Перечисления
│   ├── Hubs/              # SignalR Hubs
│   ├── Services/          # Бизнес-логика
│   │   ├── GameService.cs         # Логика игры
│   │   ├── GameTimerService.cs    # Таймеры фаз
│   │   └── VideoCallService.cs    # Интеграция с Calls
│   └── Program.cs         # Точка входа
├── mafia_fe/              # Frontend (React)
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы
│   │   └── services/      # Сервисы (SignalR)
│   └── package.json
├── docker-compose.yml     # Docker Compose конфигурация
├── .env.example          # Пример переменных окружения
└── README.md
```

## ⚙️ Переменные окружения

### Backend (.env)
```bash
# Trexon Calls интеграция
CALLS_API_URL=https://calls.trexon.ru/
MASTER_ADMIN_KEY=your_master_admin_key

# Logging
ASPNETCORE_ENVIRONMENT=Production
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:5141
VITE_CALLS_URL=https://calls.trexon.ru
```

## 📝 Лицензия

MIT
