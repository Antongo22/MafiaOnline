namespace Mafia.DTOs;

/// <summary>
/// Настройки таймеров игры
/// </summary>
public class GameSettings
{
    /// <summary>
    /// Время на индивидуальное выступление (секунды)
    /// </summary>
    public int IndividualSpeechTime { get; set; } = 30;
    
    /// <summary>
    /// Время на свободное обсуждение (секунды)
    /// </summary>
    public int FreeDiscussionTime { get; set; } = 90;
    
    /// <summary>
    /// Время на голосование одного игрока (секунды)
    /// </summary>
    public int VotingTime { get; set; } = 15;
    
    /// <summary>
    /// Время на ночное действие (секунды)
    /// </summary>
    public int NightActionTime { get; set; } = 30;
}

