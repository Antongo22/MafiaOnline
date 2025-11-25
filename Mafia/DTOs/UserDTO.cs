using Mafia.Enums;

namespace Mafia.DTOs;

public class UserDTO
{
    public string Id { get; set; }
    public string Name { get; set; }
    public UserStatus Status { get; set; }
    public bool IsAlive { get; set; } = true; // Отдельное поле для отслеживания жизни игрока
}