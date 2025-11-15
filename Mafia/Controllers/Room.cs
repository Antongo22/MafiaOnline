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
        room.Users.Add(new UserDTO { Id = userId, Name = playerName, Status = UserStatus.Player });
        
        return Ok(room);
    }


    [HttpPost("create")]
    public ActionResult<RoomDTO> CreateRoom(string roomName, string playerName)
    {
        var userId = Guid.NewGuid().ToString();
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Name = roomName,
            Users = new List<UserDTO> { new UserDTO { Id = userId, Name = playerName, Status = UserStatus.Admin } },
            InviteCode = Guid.NewGuid().ToString().Substring(0, 6).ToUpper(),
            Status = GameStatus.Created
        };
        
        Game.Rooms.Add(room);
        
        return Ok(room);
    }

    [HttpGet("my")]
    public ActionResult<RoomDTO> GetMyRoom(string userId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Users.Any(u => u.Id == userId));
        if (room == null)
            return NotFound("Room not found");
        
        return Ok(room);
    }
}