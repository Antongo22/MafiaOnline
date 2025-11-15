using Mafia.Services;
using Mafia.Enums;

namespace Mafia.DTOs;

public class RoomDTO
{
    public string Id { get; set; }
    public string Name { get; set; }
    public List<UserDTO> Users { get; set; }
    public string InviteCode { get; set; }
    public GameStatus Status { get; set; }
}