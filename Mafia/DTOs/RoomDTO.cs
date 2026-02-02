using Mafia.Enums;
using Mafia.Models;

namespace Mafia.DTOs;

/// <summary>
/// Информация о комнате для передачи клиенту
/// </summary>
public class RoomDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<UserDTO> Users { get; set; } = new();
    public string InviteCode { get; set; } = string.Empty;
    public GameStatus Status { get; set; }
    
    // Настройки видео
    public bool IsVideoEnabled { get; set; } = false;
    
    // Настройки игры
    public GameSettings? GameSettings { get; set; }
    public Dictionary<Role, int>? RoleSettings { get; set; }
    
    // Роли игроков (userId -> Role)
    public Dictionary<string, Role>? PlayerRoles { get; set; }
    
    // Текущее состояние игрового цикла (если игра начата)
    public GameState? CurrentGameState { get; set; }
}