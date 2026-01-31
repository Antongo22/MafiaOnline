namespace Mafia.DTOs;

/// <summary>
/// DTO для сообщений чата
/// </summary>
public class ChatMessageDTO
{
    /// <summary>
    /// Уникальный идентификатор сообщения
    /// </summary>
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// ID комнаты
    /// </summary>
    public string RoomId { get; set; } = string.Empty;
    
    /// <summary>
    /// ID пользователя
    /// </summary>
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// Имя пользователя
    /// </summary>
    public string UserName { get; set; } = string.Empty;
    
    /// <summary>
    /// Роль пользователя
    /// </summary>
    public string? UserRole { get; set; }
    
    /// <summary>
    /// Содержимое сообщения
    /// </summary>
    public string Message { get; set; } = string.Empty;
    
    /// <summary>
    /// Время отправки сообщения
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Является ли сообщение системным
    /// </summary>
    public bool IsSystem { get; set; }
    
    /// <summary>
    /// Является ли сообщение из чата мафии
    /// </summary>
    public bool IsMafiaChat { get; set; }
}
