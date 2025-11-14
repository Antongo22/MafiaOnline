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
        
        
        room.Users.Add(new User { Name = playerName });
        
        return Ok(room);
    }


    [HttpPost("create")]
    public ActionResult<RoomDTO> CreateRoom(string roomName, string playerName)
    {
        var room = new RoomDTO
        {
            Name = roomName,
            Users = new List<User> { new User { Name = playerName } },
            InviteCode = Guid.NewGuid().ToString().Substring(0, 6).ToUpper(),
            Status = GameStatus.Created
        };
        
        Game.Rooms.Add(room);
        
        return Ok(room);
    }
}