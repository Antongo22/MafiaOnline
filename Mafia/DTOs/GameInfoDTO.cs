using Mafia.Enums;


namespace Mafia.DTOs;


public class GameInfoDTO
{
    public string Id { get; set; }
    public string  Name { get; set; }
    public int PlayerCount { get; set; }
    public int RoleCount { get; set; }
    public int AdminId { get; set; }
    public GameStatus Status { get; set; }
}


