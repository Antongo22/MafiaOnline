namespace Mafia.Enums;

/// <summary>
/// Статус игровой комнаты
/// </summary>
public enum GameStatus
{
    /// <summary>
    /// Комната создана, набор игроков
    /// </summary>
    Created,
    
    /// <summary>
    /// Ожидание распределения ролей и настройки комнаты
    /// </summary>
    Waiting,
    
    /// <summary>
    /// Игра в процессе
    /// </summary>
    InProgress,
    
    /// <summary>
    /// Игра завершена, подведение итогов
    /// </summary>
    Finished
}