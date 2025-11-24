using Mafia.Enums;
using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.DTOs;
using Microsoft.AspNetCore.SignalR;
using Mafia.Hubs;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private readonly IHubContext<ChatHub> _hubContext;

    public GameController(IHubContext<ChatHub> hubContext)
    {
        _hubContext = hubContext;
    }

    [HttpPost("start")]
    public async Task<ActionResult> StartGame(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can start the game");
        
        if (room.Status != GameStatus.Created)
            return BadRequest("Game can only be started from Created status");
        
        // Переводим в статус выбора ролей
        room.Status = GameStatus.Waiting;
        
        // Уведомляем всех через SignalR
        await _hubContext.Clients.Group(roomId).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
        
        return Ok(new { message = "Game started, waiting for role selection", status = room.Status });
    }

    [HttpPost("select-roles")]
    public ActionResult SelectRoles(string roomId, string adminId, [FromBody] Dictionary<Role, int> roles)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can select roles");
        
        if (room.Status != GameStatus.Waiting)
            return BadRequest("Can only select roles in Waiting status");
        
        // Проверяем, что количество ролей совпадает с количеством активных игроков
        var activePlayersCount = room.Users.Count(u => u.Status != UserStatus.Leave);
        var totalRoles = roles.Values.Sum();
        
        if (totalRoles != activePlayersCount)
            return BadRequest($"Total roles ({totalRoles}) must equal active players count ({activePlayersCount})");
        
        // Сохраняем настройки ролей
        room.RoleSettings = roles;
        
        return Ok(new { message = "Roles selected", roleSettings = room.RoleSettings });
    }

    [HttpPost("distribute-roles")]
    public async Task<ActionResult> DistributeRoles(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can distribute roles");
        
        if (room.Status != GameStatus.Waiting)
            return BadRequest("Can only distribute roles in Waiting status");
        
        if (room.RoleSettings == null || room.RoleSettings.Count == 0)
            return BadRequest("Role settings not configured");
        
        // Получаем активных игроков
        var activePlayers = room.Users.Where(u => u.Status != UserStatus.Leave).ToList();
        
        // Создаем список ролей на основе настроек
        var rolesList = new List<Role>();
        foreach (var roleEntry in room.RoleSettings)
        {
            for (int i = 0; i < roleEntry.Value; i++)
            {
                rolesList.Add(roleEntry.Key);
            }
        }
        
        // Перемешиваем роли
        var random = new Random();
        rolesList = rolesList.OrderBy(x => random.Next()).ToList();
        
        // Раздаем роли игрокам
        room.PlayerRoles = new Dictionary<string, Role>();
        for (int i = 0; i < activePlayers.Count; i++)
        {
            room.PlayerRoles[activePlayers[i].Id] = rolesList[i];
        }
        
        // Переводим в статус игры
        room.Status = GameStatus.InProgress;
        
        // Уведомляем всех через SignalR о смене статуса
        await _hubContext.Clients.Group(roomId).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
        
        // Отправляем каждому игроку его роль через SignalR
        foreach (var player in activePlayers)
        {
            if (room.PlayerRoles.TryGetValue(player.Id, out var role))
            {
                // Отправляем роль конкретному пользователю
                await _hubContext.Clients.Group(roomId).SendAsync("RoleAssigned", new { 
                    userId = player.Id, 
                    role = role.ToString() 
                });
            }
        }
        
        return Ok(new { message = "Roles distributed, game started", status = room.Status });
    }

    [HttpPost("finish")]
    public async Task<ActionResult> FinishGame(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can finish the game");
        
        if (room.Status != GameStatus.InProgress)
            return BadRequest("Can only finish game in InProgress status");
        
        // Переводим в статус завершения
        room.Status = GameStatus.Finished;
        
        // Уведомляем всех через SignalR
        await _hubContext.Clients.Group(roomId).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
        
        // Раскрываем роли всех игроков
        if (room.PlayerRoles != null)
        {
            var rolesWithNames = room.PlayerRoles.Select(kvp => new
            {
                userId = kvp.Key,
                userName = room.Users.FirstOrDefault(u => u.Id == kvp.Key)?.Name,
                role = kvp.Value.ToString()
            }).ToDictionary(x => x.userName ?? x.userId, x => x.role);
            
            await _hubContext.Clients.Group(roomId).SendAsync("AllRolesRevealed", rolesWithNames);
        }
        
        return Ok(new { message = "Game finished", status = room.Status, playerRoles = room.PlayerRoles });
    }

    [HttpPost("reset")]
    public async Task<ActionResult> ResetGame(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can reset the game");
        
        if (room.Status != GameStatus.Finished)
            return BadRequest("Can only reset game in Finished status");
        
        // Удаляем игроков со статусом Leave
        room.Users.RemoveAll(u => u.Status == UserStatus.Leave);
        
        // Сбрасываем роли
        room.PlayerRoles = null;
        room.RoleSettings = null;
        
        // Переводим в начальный статус
        room.Status = GameStatus.Created;
        
        // Добавляем разделитель в общий чат
        var dividerMessage = new ChatMessageDTO
        {
            Id = Guid.NewGuid().ToString(),
            RoomId = roomId,
            UserId = "system",
            UserName = "Система",
            Message = "─────────── Новая игра ───────────",
            Timestamp = DateTime.UtcNow,
            IsMafiaChat = false
        };
        
        if (!Game.ChatMessages.ContainsKey(roomId))
        {
            Game.ChatMessages[roomId] = new List<ChatMessageDTO>();
        }
        Game.ChatMessages[roomId].Add(dividerMessage);
        await _hubContext.Clients.Group(roomId).SendAsync("ReceiveMessage", dividerMessage);
        
        // Добавляем разделитель в чат мафии
        var mafiaDividerMessage = new ChatMessageDTO
        {
            Id = Guid.NewGuid().ToString(),
            RoomId = roomId,
            UserId = "system",
            UserName = "Система",
            Message = "─────────── Новая игра ───────────",
            Timestamp = DateTime.UtcNow,
            IsMafiaChat = true
        };
        
        if (!Game.MafiaChatMessages.ContainsKey(roomId))
        {
            Game.MafiaChatMessages[roomId] = new List<ChatMessageDTO>();
        }
        Game.MafiaChatMessages[roomId].Add(mafiaDividerMessage);
        var mafiaGroupName = $"{roomId}_mafia";
        await _hubContext.Clients.Group(mafiaGroupName).SendAsync("ReceiveMafiaMessage", mafiaDividerMessage);
        
        // Уведомляем всех через SignalR
        await _hubContext.Clients.Group(roomId).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
        await _hubContext.Clients.Group(roomId).SendAsync("GameReset");
        
        // Обновляем список пользователей
        var activeUsers = room.Users.Where(u => u.Status != UserStatus.Leave).ToList();
        await _hubContext.Clients.Group(roomId).SendAsync("UpdateUserList", activeUsers);
        
        return Ok(new { message = "Game reset", status = room.Status });
    }

    [HttpGet("my-role")]
    public ActionResult GetMyRole(string roomId, string userId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return NotFound("User not found in room");
        
        if (room.Status != GameStatus.InProgress && room.Status != GameStatus.Finished)
            return BadRequest("Roles are only available during or after the game");
        
        if (room.PlayerRoles == null || !room.PlayerRoles.ContainsKey(userId))
            return NotFound("Role not assigned");
        
        return Ok(new { role = room.PlayerRoles[userId] });
    }

    [HttpGet("all-roles")]
    public ActionResult GetAllRoles(string roomId, string userId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");
        
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return NotFound("User not found in room");
        
        if (room.Status != GameStatus.Finished)
            return BadRequest("All roles are only revealed after the game");
        
        if (room.PlayerRoles == null)
            return NotFound("Roles not assigned");
        
        // Возвращаем роли с именами пользователей
        var rolesWithNames = room.PlayerRoles.Select(kvp => new
        {
            userId = kvp.Key,
            userName = room.Users.FirstOrDefault(u => u.Id == kvp.Key)?.Name,
            role = kvp.Value
        }).ToList();
        
        return Ok(rolesWithNames);
    }

    [HttpGet("available-roles")]
    public ActionResult GetAvailableRoles()
    {
        var roles = RoleInfo.GetAllRoles();
        return Ok(roles);
    }
}

