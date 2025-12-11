using Mafia.Enums;

namespace Mafia.DTOs;

/// <summary>
/// Модель игрока в комнате
/// </summary>
public class UserDTO
{
    /// <summary>
    /// Уникальный идентификатор игрока
    /// </summary>
    public string Id { get; set; }
    
    /// <summary>
    /// Имя игрока
    /// </summary>
    public string Name { get; set; }
    
    /// <summary>
    /// Статус игрока (админ, игрок, покинул)
    /// </summary>
    public UserStatus Status { get; set; }
    
    /// <summary>
    /// Жив ли игрок в текущей игре
    /// </summary>
    public bool IsAlive { get; set; } = true;
}