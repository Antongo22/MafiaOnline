namespace Mafia.Enums;

public enum UserStatus
{
    Player,     // активный игрок
    Spectator,  // убитый игрок (устаревший)
    Dead,       // убитый игрок
    Admin,      // создатель комнаты
    Leave       // отключившийся игрок
}