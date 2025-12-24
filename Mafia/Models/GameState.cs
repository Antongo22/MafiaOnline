using Mafia.Enums;

namespace Mafia.Models;

/// <summary>
/// Модель состояния игрового цикла
/// </summary>
public class GameState
{
    // Текущая фаза игры
    public GamePhase Phase { get; set; } = GamePhase.Lobby;
    
    // Текущая ночная фаза (если Phase == Night)
    public NightPhase? CurrentNightPhase { get; set; }
    
    // Номер дня (цикла)
    public int DayNumber { get; set; } = 0;
    
    // Время начала текущей фазы
    public DateTime PhaseStartTime { get; set; }
    
    // Длительность текущей фазы в секундах
    public int PhaseTimeSeconds { get; set; }
    
    // Индивидуальные выступления
    public List<string> SpeakerOrder { get; set; } = new();
    public int CurrentSpeakerIndex { get; set; } = 0;
    public string? CurrentSpeakerId { get; set; }
    public Dictionary<string, bool> HasSpoken { get; set; } = new();
    
    // Голосование
    public List<string> VoterOrder { get; set; } = new();
    public int CurrentVoterIndex { get; set; } = 0;
    public string? CurrentVoterId { get; set; }
    public Dictionary<string, string> Votes { get; set; } = new(); // voterId -> targetId
    
    // Ночные действия
    public Dictionary<string, string> NightActions { get; set; } = new(); // userId -> actionData (JSON)
    public bool DonHasFoundSheriff { get; set; } = false;
    public string? SheriffId { get; set; }
    public int ManiacSelfHealsLeft { get; set; } = 1;
    
    // Открытые карты для конкретных игроков
    public Dictionary<string, List<string>> RevealedCards { get; set; } = new(); // userId -> List<revealedUserId>
    
    // Игроки, которые умерли в текущей ночи
    public List<string> PendingDeaths { get; set; } = new();
    
    // Первый цикл или нет
    public bool IsFirstCycle { get; set; } = true;
    
    // Первая ночь завершена
    public bool FirstNightCompleted { get; set; } = false;
    
    // Команда-победитель (если игра окончена)
    public Team? WinningTeam { get; set; }
    
    // Пауза (админ может поставить игру на паузу)
    public bool IsPaused { get; set; } = false;
    public DateTime? PauseStartTime { get; set; }
    public int RemainingTimeBeforePause { get; set; } = 0;
    
    // Разрешение ничьих при голосовании
    public List<string>? TieBreakerCandidates { get; set; }
    public Dictionary<string, bool> TieBreakerVotes { get; set; } = new(); // userId -> true=kill, false=pardon
}

