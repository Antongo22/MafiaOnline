using Mafia.Enums;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.DTOs;

namespace Mafia.Controllers;


[ApiController]
[Route("api/[controller]")]
public class Room : ControllerBase
{
    /// <summary>
    /// Присоединиться к комнате по инвайт-коду
    /// </summary>
    [HttpPost("invite")]
    public ActionResult<RoomDTO> Rooms(string inviteCode, string playerName)
    {
        var room = Game.Rooms.FirstOrDefault(x => x.InviteCode == inviteCode);
        if (room == null)
            return NotFound("Room not found");
        
        if (room.Users.Select(user => user.Name).Contains(playerName))
            return BadRequest("Player already in room");
        
        if (room.Status != GameStatus.Created)
            return BadRequest("Room is not in created state");
        
        var userId = Guid.NewGuid().ToString();
        room.Users.Add(new UserDTO { Id = userId, Name = playerName, Status = UserStatus.Player, IsAlive = true });
        
        return Ok(room);
    }


    /// <summary>
    /// Создать новую игровую комнату
    /// </summary>
    [HttpPost("create")]
    public ActionResult<RoomDTO> CreateRoom(string roomName, string playerName)
    {
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
        
        return Ok(room);
    }

    /// <summary>
    /// Получить информацию о комнате, в которой находится игрок
    /// </summary>
    [HttpGet("my")]
    public ActionResult<RoomDTO> GetMyRoom(string userId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == userId));
        if (room == null)
            return NotFound("Room not found");
        
        return Ok(room);
    }

    /// <summary>
    /// Покинуть комнату (если админ - комната расформируется)
    /// </summary>
    [HttpPost("leave")]
    public ActionResult LeaveRoom(string userId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == userId));
        if (room == null)
            return NotFound("Room not found");
        
        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return NotFound("User not found");
        
        // Если уходит админ - расформируем комнату
        if (user.Status == UserStatus.Admin)
        {
            // Удаляем комнату полностью
            Game.Rooms.Remove(room);
            // Удаляем историю чата комнаты
            if (Game.ChatMessages.ContainsKey(room.Id))
            {
                Game.ChatMessages.Remove(room.Id);
            }
            return Ok(new { message = "Room disbanded", disbanded = true });
        }
        
        // Обычный игрок просто покидает
        user.Status = UserStatus.Leave;
        
        return Ok(new { message = "Left room successfully", disbanded = false });
    }

    /// <summary>
    /// Выгнать игрока из комнаты (только админ)
    /// </summary>
    [HttpPost("kick")]
    public ActionResult KickPlayer(string adminId, string targetUserId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == adminId));
        if (room == null)
            return NotFound("Room not found");
        
        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can kick players");
        
        var targetUser = room.Users.FirstOrDefault(u => u.Id == targetUserId);
        if (targetUser == null)
            return NotFound("Target user not found");
        
        if (targetUser.Status == UserStatus.Admin)
            return BadRequest("Cannot kick admin");
        
        // Помечаем пользователя как покинувшего
        targetUser.Status = UserStatus.Leave;
        
        return Ok(new { message = "Player kicked successfully", kickedUserName = targetUser.Name });
    }
}