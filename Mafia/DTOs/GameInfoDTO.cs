using Mafia.Enums;

namespace Mafia.DTOs;

/// <summary>
/// Модель краткой информации об игре
/// </summary>
public class GameInfoDTO
{
    /// <summary>
    /// Уникальный идентификатор игры
    /// </summary>
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Название игры
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Количество игроков
    /// </summary>
    public int PlayerCount { get; set; }
    
    /// <summary>
    /// Количество ролей
    /// </summary>
    public int RoleCount { get; set; }
    
    /// <summary>
    /// ID администратора игры
    /// </summary>
    public string AdminId { get; set; } = string.Empty;
    
    /// <summary>
    /// Текущий статус игры
    /// </summary>
    public GameStatus Status { get; set; }
}
