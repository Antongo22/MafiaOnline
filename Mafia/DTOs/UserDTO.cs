namespace Mafia.DTOs;

using Mafia.Enums;

/// <summary>
/// Информация о пользователе в комнате
/// </summary>
public class UserDTO
{
    /// <summary>
    /// Уникальный идентификатор игрока
    /// </summary>
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Имя игрока
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Статус игрока (админ, игрок, покинул)
    /// </summary>
    public UserStatus Status { get; set; }
    
    /// <summary>
    /// Жив ли игрок
    /// </summary>
    public bool IsAlive { get; set; } = true;
}