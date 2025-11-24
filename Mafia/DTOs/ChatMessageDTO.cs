namespace Mafia.DTOs;

public class ChatMessageDTO
{
    public string Id { get; set; }
    public string RoomId { get; set; }
    public string UserId { get; set; }
    public string UserName { get; set; }
    public string Message { get; set; }
    public DateTime Timestamp { get; set; }
}

