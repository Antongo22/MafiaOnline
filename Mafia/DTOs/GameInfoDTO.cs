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
    public string Id { get; set; }
    
    /// <summary>
    /// Название игры
    /// </summary>
    public string  Name { get; set; }
    
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
    public int AdminId { get; set; }
    
    /// <summary>
    /// Текущий статус игры
    /// </summary>
    public GameStatus Status { get; set; }
}


