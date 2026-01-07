using Microsoft.AspNetCore.SignalR;
using Mafia.DTOs;
using Mafia.Services;
using Microsoft.Extensions.Logging;

namespace Mafia.Hubs;

public class ChatHub : Hub
{
    private readonly VideoCallService _videoCallService;
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(VideoCallService videoCallService, ILogger<ChatHub> logger)
    {
        _videoCallService = videoCallService;
        _logger = logger;
    }

    public async Task JoinRoom(string roomId, string userId)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        // Проверяем, что пользователь в комнате
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            await Clients.Caller.SendAsync("Error", "User not in room");
            return;
        }

        // Добавляем пользователя в группу комнаты
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        // Сохраняем связь ConnectionId -> User
        Game.UserConnections.TryAdd(Context.ConnectionId, (roomId, userId));

        // Отправляем историю сообщений
        if (Game.ChatMessages.TryGetValue(roomId, out var messages))
        {
            await Clients.Caller.SendAsync("ReceiveMessageHistory", messages);
        }
        else
        {
            await Clients.Caller.SendAsync("ReceiveMessageHistory", new List<ChatMessageDTO>());
        }

        // Отправляем всем обновленный список пользователей
        var activeUsers = room.Users.Where(u => u.Status != Enums.UserStatus.Leave).ToList();
        await Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
        
        // Отправляем системное сообщение о входе
        await Clients.Group(roomId).SendAsync("UserJoined", new { userName = user.Name, userId = user.Id });
    }

    public async Task LeaveRoom(string roomId, string userId)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            return;
        }

        // Проверяем, что пользователь в комнате
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            return;
        }

        // Удаляем из группы SignalR
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

        // Отправляем всем обновленный список пользователей
        var activeUsers = room.Users.Where(u => u.Status != Enums.UserStatus.Leave).ToList();
        await Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
        
        // Отправляем системное сообщение о выходе
        await Clients.Group(roomId).SendAsync("UserLeft", new { userName = user.Name, userId = user.Id });
    }

    public async Task SendMessage(string roomId, string userId, string userName, string message)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        // Проверяем, что пользователь в комнате
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            await Clients.Caller.SendAsync("Error", "User not in room");
            return;
        }

        // Мертвые игроки не могут писать в чат
        if (!user.IsAlive)
        {
            await Clients.Caller.SendAsync("Error", "Dead players cannot send messages");
            return;
        }

        // Проверяем, может ли игрок писать в текущей фазе
        if (room.CurrentGameState != null)
        {
            var gameState = room.CurrentGameState;
            
            if (gameState.Phase == Enums.GamePhase.IndividualSpeech)
            {
                // Только текущий спикер может писать
                if (gameState.CurrentSpeakerId != userId)
                {
                    await Clients.Caller.SendAsync("Error", "Not your turn to speak");
                    return;
                }
                
                // Спикер может отправить только 1 сообщение
                if (gameState.HasSpoken.ContainsKey(userId) && gameState.HasSpoken[userId])
                {
                    await Clients.Caller.SendAsync("Error", "You have already spoken");
                    return;
                }
                
                // Помечаем что спикер отправил сообщение
                gameState.HasSpoken[userId] = true;
                
                // Завершаем таймер немедленно - переходим к следующему спикеру
                gameState.PhaseStartTime = DateTime.UtcNow.AddSeconds(-gameState.PhaseTimeSeconds);
            }
            else if (gameState.Phase == Enums.GamePhase.FreeDiscussion)
            {
                // Все могут писать
            }
            else if (gameState.Phase == Enums.GamePhase.Voting || 
                     gameState.Phase == Enums.GamePhase.Night || 
                     gameState.Phase == Enums.GamePhase.GameOver)
            {
                // Во время голосования и ночи чат заблокирован
                await Clients.Caller.SendAsync("Error", "Chat is disabled during this phase");
                return;
            }
        }

        // Создаем сообщение
        var chatMessage = new ChatMessageDTO
        {
            Id = Guid.NewGuid().ToString(),
            RoomId = roomId,
            UserId = userId,
            UserName = userName,
            Message = message,
            Timestamp = DateTime.UtcNow
        };

        // Сохраняем сообщение в кеше
        if (!Game.ChatMessages.ContainsKey(roomId))
        {
            Game.ChatMessages[roomId] = new List<ChatMessageDTO>();
        }
        Game.ChatMessages[roomId].Add(chatMessage);

        // Отправляем сообщение всем в группе комнаты
        await Clients.Group(roomId).SendAsync("ReceiveMessage", chatMessage);
    }

    public async Task JoinMafiaChat(string roomId, string userId)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        // Проверяем, что пользователь в комнате
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            await Clients.Caller.SendAsync("Error", "User not in room");
            return;
        }

        // Проверяем, что у пользователя есть роль и она относится к мафии
        if (room.PlayerRoles == null || !room.PlayerRoles.ContainsKey(userId))
        {
            await Clients.Caller.SendAsync("Error", "Role not assigned");
            return;
        }

        var userRole = room.PlayerRoles[userId];
        var team = Enums.RoleInfo.GetTeam(userRole);
        
        if (team != Enums.Team.Evil)
        {
            await Clients.Caller.SendAsync("Error", "Only mafia members can join mafia chat");
            return;
        }

        // Добавляем пользователя в группу чата мафии
        var mafiaGroupName = $"{roomId}_mafia";
        await Groups.AddToGroupAsync(Context.ConnectionId, mafiaGroupName);

        // Отправляем историю сообщений чата мафии
        if (Game.MafiaChatMessages.TryGetValue(roomId, out var mafiaMessages))
        {
            await Clients.Caller.SendAsync("ReceiveMafiaMessageHistory", mafiaMessages);
        }
        else
        {
            await Clients.Caller.SendAsync("ReceiveMafiaMessageHistory", new List<ChatMessageDTO>());
        }
    }

    public async Task SendMafiaMessage(string roomId, string userId, string userName, string message)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        // Проверяем, что пользователь в комнате
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            await Clients.Caller.SendAsync("Error", "User not in room");
            return;
        }

        // Мертвые игроки не могут писать в чат мафии
        if (!user.IsAlive)
        {
            await Clients.Caller.SendAsync("Error", "Dead players cannot send messages");
            return;
        }

        // Проверяем, что у пользователя есть роль и она относится к мафии
        if (room.PlayerRoles == null || !room.PlayerRoles.ContainsKey(userId))
        {
            await Clients.Caller.SendAsync("Error", "Role not assigned");
            return;
        }

        var userRole = room.PlayerRoles[userId];
        var team = Enums.RoleInfo.GetTeam(userRole);
        
        if (team != Enums.Team.Evil)
        {
            await Clients.Caller.SendAsync("Error", "Only mafia members can send messages to mafia chat");
            return;
        }

        // Получаем название роли
        var roleInfo = Enums.RoleInfo.GetRole(userRole);
        var roleName = roleInfo.Item1;

        // Создаем сообщение
        var chatMessage = new ChatMessageDTO
        {
            Id = Guid.NewGuid().ToString(),
            RoomId = roomId,
            UserId = userId,
            UserName = userName,
            UserRole = roleName,
            Message = message,
            Timestamp = DateTime.UtcNow,
            IsMafiaChat = true
        };

        // Сохраняем сообщение в кеше чата мафии
        if (!Game.MafiaChatMessages.ContainsKey(roomId))
        {
            Game.MafiaChatMessages[roomId] = new List<ChatMessageDTO>();
        }
        Game.MafiaChatMessages[roomId].Add(chatMessage);

        // Отправляем сообщение всем в группе чата мафии
        var mafiaGroupName = $"{roomId}_mafia";
        await Clients.Group(mafiaGroupName).SendAsync("ReceiveMafiaMessage", chatMessage);
    }

    public async Task KickPlayers(string roomId, string adminId, string[] targetUserIds)
    {
        // Проверяем существование комнаты
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        // Проверяем права админа
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != Enums.UserStatus.Admin)
        {
            await Clients.Caller.SendAsync("Error", "Only admin can kick players");
            return;
        }

        // Отправляем событие о кике для каждого игрока
        foreach (var targetUserId in targetUserIds)
        {
            var targetUser = room.Users.FirstOrDefault(u => u.Id == targetUserId);
            if (targetUser != null && targetUser.Status != Enums.UserStatus.Admin)
            {
                await Clients.Group(roomId).SendAsync("PlayerKicked", new { 
                    kickedUserId = targetUser.Id, 
                    kickedUserName = targetUser.Name,
                    kickedBy = admin.Name
                });
            }
        }

        // Отправляем обновленный список пользователей
        var activeUsers = room.Users.Where(u => u.Status != Enums.UserStatus.Leave).ToList();
        await Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
    }

    public async Task DisbandRoom(string roomId)
    {
        // Отправляем всем участникам комнаты событие о расформировании
        await Clients.Group(roomId).SendAsync("RoomDisbanded", new { roomId = roomId });
    }

    public async Task NotifyGameStatusChange(string roomId, string status, object? additionalData = null)
    {
        // Уведомляем всех в комнате о смене статуса игры
        await Clients.Group(roomId).SendAsync("GameStatusChanged", new { 
            status = status,
            data = additionalData
        });
    }

    public async Task NotifyRoleAssigned(string roomId, string userId, string role)
    {
        // Отправляем конкретному пользователю его роль
        var connectionIds = await GetUserConnectionIds(roomId, userId);
        foreach (var connectionId in connectionIds)
        {
            await Clients.Client(connectionId).SendAsync("RoleAssigned", new { role = role });
        }
    }

    public async Task NotifyAllRolesRevealed(string roomId, object rolesData)
    {
        // Отправляем всем роли всех игроков после завершения игры
        await Clients.Group(roomId).SendAsync("AllRolesRevealed", rolesData);
    }

    private async Task<List<string>> GetUserConnectionIds(string roomId, string userId)
    {
        // В реальном приложении здесь нужно хранить маппинг userId -> connectionId
        // Пока возвращаем пустой список, т.к. мы используем Groups
        return new List<string>();
    }

    public async Task SetVideoStatus(string roomId, bool isEnabled)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null) return;
        
        // TODO: Проверка на админа (можно добавить, но для простоты доверимся клиенту/UI)

        if (isEnabled)
        {
            try
            {
                // Гарантируем, что комната существует на видео-сервере.
                // Она могла протухнуть (таймаут 5 минут при простое), поэтому пересоздаем.
                var admin = room.Users.FirstOrDefault(u => u.Status == Enums.UserStatus.Admin);
                var creatorName = admin?.Name ?? "Admin";
                
                await _videoCallService.CreateRoomAsync(roomId, creatorName);
                _logger.LogInformation($"Video room {roomId} ensured/created when enabling video.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Failed to ensure video room {roomId} exists. Video will not be available.");
                // Не прерываем процесс, возможно комната уже есть или ошибка временная.
                // Если прервем, то UI может рассинхронизироваться.
            }
        }
        
        room.IsVideoEnabled = isEnabled;
        
        // Уведомляем всех об изменении статуса видео
        await Clients.Group(roomId).SendAsync("VideoStatusChanged", new { isVideoEnabled = isEnabled });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Game.UserConnections.TryRemove(Context.ConnectionId, out var userParams))
        {
            var (roomId, userId) = userParams;
            var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
            
            if (room != null)
            {
                var user = room.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    // Если отключился Админ - ничего не делаем, чтобы работала перезагрузка страницы
                    if (user.Status == Enums.UserStatus.Admin)
                    {
                        // Оставляем пустым: комната и админ остаются в памяти.
                    }
                    // Если обычный игрок и мы в Лобби - удаляем его сразу
                    else if (room.Status == Enums.GameStatus.Created)
                    {
                        room.Users.Remove(user);
                        
                        // Отправляем всем обновленный список пользователей
                        var activeUsers = room.Users.Where(u => u.Status != Enums.UserStatus.Leave).ToList();
                        await Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
                        await Clients.Group(roomId).SendAsync("UserLeft", new { userName = user.Name, userId = user.Id });
                    }
                    else
                    {
                        // Если игра идет - игрок умирает
                        if (user.IsAlive)
                        {
                            user.IsAlive = false;
                            
                            // Отправляем всем обновленный список пользователей (с пометкой о смерти)
                            var activeUsers = room.Users.Where(u => u.Status != Enums.UserStatus.Leave).ToList();
                            await Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
                            
                            // Системное сообщение
                            await Clients.Group(roomId).SendAsync("ReceiveMessage", new ChatMessageDTO 
                            { 
                                Id = Guid.NewGuid().ToString(),
                                RoomId = roomId,
                                UserId = "system",
                                UserName = "System",
                                Message = $"Игрок {user.Name} отключился и считается погибшим.",
                                Timestamp = DateTime.UtcNow
                            });
                        }
                    }
                }
            }
        }
        
        await base.OnDisconnectedAsync(exception);
    }
}

