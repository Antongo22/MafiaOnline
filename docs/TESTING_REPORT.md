# Отчет по тестированию: Mafia Online

## 1. Описание проекта

Mafia Online — веб-приложение для игры в "Мафию" онлайн с видеозвонками и чатом в реальном времени. Backend реализован на ASP.NET Core 9 с SignalR, frontend — на React/TypeScript.

## 2. Артефакты

- [Mind Map (draw.io)](./testing_mindmap.drawio)
- [Тест-кейсы (CSV)](./test_cases.csv)

## 3. Обоснование выбора инструментов

| Инструмент | Почему выбран |
|------------|---------------|
| xUnit | Стандарт для .NET, поддержка параллельного выполнения |
| Moq | Изоляция тестов через mock-объекты (SignalR Hub) |
| WebApplicationFactory | Интеграционные тесты HTTP API без внешнего сервера |

Выбраны Unit и Integration тесты, так как они покрывают критическую бизнес-логику (победа, голосование) и API endpoints.

## 4. Примеры тестов

### Тест 1: Победа мафии

```csharp
[Fact]
public void CheckWinCondition_MafiaEqualsGood_ShouldReturnEvil()
{
    var room = new RoomDTO
    {
        Users = new List<UserDTO>
        {
            new() { Id = "1", IsAlive = true },
            new() { Id = "2", IsAlive = true }
        },
        PlayerRoles = new Dictionary<string, Role>
        {
            { "1", Role.Citizen },
            { "2", Role.Mafia }
        }
    };

    var winner = WinConditionService.CheckWinCondition(room);

    Assert.Equal(Team.Evil, winner);
}
```

**Что проверяет:** Ключевое правило игры — мафия побеждает, когда их количество больше или равно количеству мирных жителей.

**Как работает:** Создается комната с 2 живыми игроками: 1 мирный и 1 мафия. Сервис проверяет баланс сил и должен вернуть победу команды Evil (мафия).

**Почему важен:** Ошибка в этой логике сломает всю игру — победитель будет определяться неверно.

### Тест 2: Защита голосования

```csharp
[Fact]
public void Vote_ForDeadPlayer_ShouldReturnBadRequest()
{
    var controller = new GameCycleController(
        Mock.Of<IHubContext<ChatHub>>(), 
        Mock.Of<ILogger<GameCycleController>>());

    var result = controller.Vote(roomId, voterId, deadPlayerId).Result;

    Assert.IsType<BadRequestObjectResult>(result);
}
```

**Что проверяет:** Нельзя голосовать за мертвого игрока.

**Как работает:** Используется Moq для создания mock-объектов SignalR Hub и Logger (изоляция теста от внешних зависимостей). Вызывается метод Vote с ID мертвого игрока. Ожидается ответ BadRequest.

**Почему важен:** Без этой проверки игроки могли бы голосовать за уже убитых, что нарушает правила игры.

### Тест 3: Создание комнаты (API)

```csharp
[Fact]
public async Task CreateRoom_WithValidData_ShouldReturnOk()
{
    var response = await _client.PostAsync(
        "/api/Room/create?roomName=Test&playerName=Player", null);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}
```

**Что проверяет:** Успешное создание игровой комнаты через REST API.

**Как работает:** WebApplicationFactory создает тестовый сервер в памяти. HTTP-клиент отправляет реальный POST-запрос. Проверяется, что сервер вернул статус 200 OK.

**Почему важен:** Это интеграционный тест — проверяет весь pipeline от HTTP-запроса до ответа: routing, валидация, контроллер, сервис, сериализация.

## 5. Запуск тестов

```bash
cd Mafia
dotnet test
```

## 6. Выводы

**Что дало тестирование:**
- Автоматическая проверка бизнес-логики при каждом изменении кода
- Документирование ожидаемого поведения системы

**Найденные дефекты:**
- Голосование за мертвых игроков не блокировалось
- Выход админа не расформировывал комнату

**Сложности:**
- Настройка mock-объектов для SignalR Hub
- Очистка состояния между тестами (статический Game.Rooms)
