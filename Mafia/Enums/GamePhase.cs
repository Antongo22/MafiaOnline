namespace Mafia.Enums;

/// <summary>
/// Фазы игрового цикла
/// </summary>
public enum GamePhase
{
    /// <summary>
    /// Лобби, до начала игры
    /// </summary>
    Lobby,
    
    /// <summary>
    /// Индивидуальные выступления (30 секунд каждый)
    /// </summary>
    IndividualSpeech,
    
    /// <summary>
    /// Свободное обсуждение (1.5 минуты)
    /// </summary>
    FreeDiscussion,
    
    /// <summary>
    /// Голосование за исключение игрока (15 секунд каждый)
    /// </summary>
    Voting,
    
    /// <summary>
    /// Ночная фаза, роли выполняют свои действия
    /// </summary>
    Night,
    
    /// <summary>
    /// Игра завершена
    /// </summary>
    GameOver
}

/// <summary>
/// Фазы ночи (порядок действий ролей)
/// </summary>
public enum NightPhase
{
    /// <summary>
    /// Дон мафии ищет шерифа
    /// </summary>
    Don,
    
    /// <summary>
    /// Мафия голосует за убийство
    /// </summary>
    Mafia,
    
    /// <summary>
    /// Маньяк выбирает жертву или лечит себя
    /// </summary>
    Maniac,
    
    /// <summary>
    /// Шериф проверяет игрока
    /// </summary>
    Sheriff,
    
    /// <summary>
    /// Доктор лечит игрока
    /// </summary>
    Doctor,
    
    /// <summary>
    /// Путана забирает игрока к себе
    /// </summary>
    Prostitute,
    
    /// <summary>
    /// Обработка результатов ночи
    /// </summary>
    Processing
}

