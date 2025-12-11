using Mafia.Enums;


namespace Mafia.DTOs;

/// <summary>
/// Модель для создания игры с распределением ролей
/// </summary>
public class GameCreateDTO
{
    /// <summary>
    /// Список имён игроков
    /// </summary>
    public List<string> PlayersNames { get; set; }
    
    /// <summary>
    /// Словарь ролей и их количества
    /// </summary>
    public Dictionary<Role, int> Roles { get; set; }

    
}