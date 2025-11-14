using Mafia.Enums;


namespace Mafia.DTOs;


public class GameCreateDTO
{
    public List<string> PlayersNames { get; set; }
    public Dictionary<Role, int> Roles { get; set; }

    
}