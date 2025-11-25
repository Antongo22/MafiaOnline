namespace Mafia.Enums;

public enum GamePhase
{
    Lobby,              // До начала игры
    IndividualSpeech,   // Индивидуальные выступления (30 сек каждый)
    FreeDiscussion,     // Свободное обсуждение (1.5 мин)
    Voting,             // Голосование (15 сек каждый)
    Night,              // Ночь (различные роли действуют)
    GameOver            // Игра окончена
}

public enum NightPhase
{
    Don,        // Дон ищет шерифа
    Mafia,      // Мафия голосует за убийство
    Maniac,     // Маньяк действует
    Sheriff,    // Шериф проверяет игрока
    Doctor,     // Доктор лечит
    Prostitute, // Путана забирает игрока
    Processing  // Обработка результатов ночи
}

