using Mafia.Enums;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.DTOs;
using Mafia.Helpers;
using Microsoft.AspNetCore.SignalR;
using Mafia.Hubs;

namespace Mafia.Controllers;


[ApiController]
[Route("api/[controller]")]
public class Room : ControllerBase
{
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly VideoCallService _videoCallService;

    public Room(IHubContext<ChatHub> hubContext, VideoCallService videoCallService)
    {
        _hubContext = hubContext;
        _videoCallService = videoCallService;
    }
    /// <summary>
    /// Присоединиться к комнате по инвайт-коду
    /// </summary>
    [HttpPost("invite")]
    public async Task<ActionResult<RoomDTO>> Rooms(string inviteCode, string playerName)
    {
        ValidationHelper.ValidateNotEmpty(inviteCode, nameof(inviteCode));
        ValidationHelper.ValidateNotEmpty(playerName, nameof(playerName));
        ValidationHelper.ValidateMinLength(playerName, 2, nameof(playerName));
        
        var room = Game.Rooms.FirstOrDefault(x => x.InviteCode == inviteCode);
        if (room == null)
            return NotFound("Room not found");
        
        if (room.Users.Select(user => user.Name).Contains(playerName))
            return BadRequest("Player already in room");
        
        if (room.Status != GameStatus.Created)
            return BadRequest("Room is not in created state");
        
        var userId = Guid.NewGuid().ToString();
        room.Users.Add(new UserDTO { Id = userId, Name = playerName, Status = UserStatus.Player, IsAlive = true });
        
        // Отправляем обновленный список пользователей всем участникам комнаты
        var activeUsers = room.Users.Where(u => u.Status != UserStatus.Leave).ToList();
        await _hubContext.Clients.Group(room.Id).SendAsync("UpdateUserList", activeUsers);
        
        return Ok(room);
    }


    /// <summary>
    /// Создать новую игровую комнату
    /// </summary>
    [HttpPost("create")]
    public async Task<ActionResult<RoomDTO>> CreateRoom(string roomName, string playerName)
    {
        ValidationHelper.ValidateNotEmpty(roomName, nameof(roomName));
        ValidationHelper.ValidateNotEmpty(playerName, nameof(playerName));
        ValidationHelper.ValidateMinLength(playerName, 2, nameof(playerName));
        
        var userId = Guid.NewGuid().ToString();
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Name = roomName,
            Users = new List<UserDTO> { new UserDTO { Id = userId, Name = playerName, Status = UserStatus.Admin, IsAlive = true } },
            InviteCode = Guid.NewGuid().ToString().Substring(0, 6).ToUpper(),
            Status = GameStatus.Created
        };
        
        Game.Rooms.Add(room);
        
        // Create video room
        await _videoCallService.CreateRoomAsync(room.Id, playerName);
        
        return Ok(room);
    }

    /// <summary>
    /// Получить информацию о комнате, в которой находится игрок
    /// </summary>
    [HttpGet("my")]
    public ActionResult<RoomDTO> GetMyRoom(string userId)
    {
        ValidationHelper.ValidateNotEmpty(userId, nameof(userId));
        
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == userId));
        if (room == null)
            return NotFound("Room not found");
        
        return Ok(room);
    }

    /// <summary>
    /// Покинуть комнату (если админ - комната расформируется)
    /// </summary>
    [HttpPost("leave")]
    public async Task<ActionResult> LeaveRoom(string userId)
    {
        ValidationHelper.ValidateNotEmpty(userId, nameof(userId));
        
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == userId));
        if (room == null)
            return NotFound("Room not found");
        
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return NotFound("User not found");
        
        // Если уходит админ - расформируем комнату
        if (user.Status == UserStatus.Admin)
        {
            var roomId = room.Id;
            var roomUserIds = room.Users.Select(u => u.Id).ToHashSet();
            var participantConnectionIds = Game.UserConnections
                .Where(kvp => kvp.Value.RoomId == roomId && roomUserIds.Contains(kvp.Value.UserId))
                .Select(kvp => kvp.Key)
                .Distinct()
                .ToList();
            
            // Отправляем уведомление всем участникам о расформировании
            await _hubContext.Clients.Group(roomId).SendAsync("RoomDisbanded", new { roomId = roomId });
            
            // Дополнительно отправляем напрямую по connectionId (на случай потери membership в группе)
            foreach (var connectionId in participantConnectionIds)
            {
                await _hubContext.Clients.Client(connectionId).SendAsync("RoomDisbanded", new { roomId = roomId });
            }
            
            // Удаляем комнату полностью
            Game.Rooms.Remove(room);
            
            // Удаляем историю чата комнаты
            if (Game.ChatMessages.ContainsKey(roomId))
            {
                Game.ChatMessages.Remove(roomId);
            }
            
            // Удаляем историю чата мафии
            if (Game.MafiaChatMessages.ContainsKey(roomId))
            {
                Game.MafiaChatMessages.Remove(roomId);
            }
            
            return Ok(new { message = "Room disbanded", disbanded = true });
        }
        
        // Обычный игрок покидает комнату - удаляем его из списка
        room.Users.Remove(user);
        
        // Отправляем обновленный список пользователей всем участникам комнаты
        var activeUsers = room.Users.Where(u => u.Status != UserStatus.Leave).ToList();
        await _hubContext.Clients.Group(room.Id).SendAsync("UpdateUserList", activeUsers);
        
        return Ok(new { message = "Left room successfully", disbanded = false });
    }

    /// <summary>
    /// Выгнать игрока(ов) из комнаты (только админ)
    /// </summary>
    [HttpPost("kick")]
    public ActionResult KickPlayers(string adminId, [FromBody] string[] targetUserIds)
    {
        ValidationHelper.ValidateNotEmpty(adminId, nameof(adminId));
        ValidationHelper.ValidateNotNull(targetUserIds, nameof(targetUserIds));
        
        if (targetUserIds.Length == 0)
            return BadRequest("At least one target user ID is required");
        
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == adminId));
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can kick players");
        
        var kickedUsers = new List<string>();
        foreach (var targetUserId in targetUserIds)
        {
            var targetUser = room.Users.FirstOrDefault(u => u.Id == targetUserId);
            if (targetUser == null)
                continue;
            
            if (targetUser.Status == UserStatus.Admin)
                continue; // Пропускаем админа
            
            // Помечаем пользователя как покинувшего
            targetUser.Status = UserStatus.Leave;
            kickedUsers.Add(targetUser.Name);
        }
        
        if (kickedUsers.Count == 0)
            return BadRequest("No valid players to kick");
        
        return Ok(new { message = "Players kicked successfully", kickedUserNames = kickedUsers });
    }
}
