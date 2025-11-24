using Microsoft.AspNetCore.SignalR;
using Mafia.DTOs;
using Mafia.Services;

namespace Mafia.Hubs;

public class ChatHub : Hub
{
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

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}

