namespace Mafia.Enums;

/// <summary>
/// Статус пользователя в комнате
/// </summary>
public enum UserStatus
{
    /// <summary>
    /// Активный игрок
    /// </summary>
    Player,
    
    /// <summary>
    /// Наблюдатель (устаревший статус)
    /// </summary>
    Spectator,
    
    /// <summary>
    /// Убитый игрок
    /// </summary>
    Dead,
    
    /// <summary>
    /// Администратор комнаты
    /// </summary>
    Admin,
    
    /// <summary>
    /// Игрок покинул комнату
    /// </summary>
    Leave
}