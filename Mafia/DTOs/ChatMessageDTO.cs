namespace Mafia.DTOs;

/// <summary>
/// Модель сообщения в чате
/// </summary>
public class ChatMessageDTO
{
    /// <summary>
    /// Уникальный идентификатор сообщения
    /// </summary>
    public string Id { get; set; }
    
    /// <summary>
    /// ID комнаты, к которой относится сообщение
    /// </summary>
    public string RoomId { get; set; }
    
    /// <summary>
    /// ID пользователя-отправителя
    /// </summary>
    public string UserId { get; set; }
    
    /// <summary>
    /// Имя пользователя-отправителя
    /// </summary>
    public string UserName { get; set; }
    
    /// <summary>
    /// Текст сообщения
    /// </summary>
    public string Message { get; set; }
    
    /// <summary>
    /// Время отправки сообщения
    /// </summary>
    public DateTime Timestamp { get; set; }
    
    /// <summary>
    /// Роль отправителя (используется в чате мафии)
    /// </summary>
    public string? UserRole { get; set; }
    
    /// <summary>
    /// Принадлежит ли сообщение чату мафии
    /// </summary>
    public bool IsMafiaChat { get; set; }
}

