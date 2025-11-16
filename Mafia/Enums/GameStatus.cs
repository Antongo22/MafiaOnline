namespace Mafia.Enums;

public enum GameStatus
{
    Created, // только создали комнату, набор людей. Только в этом состоянии кол-во участников может менятся.
    Waiting, // распределение ролей, настройки комнаты
    InProgress, // игра в процессе
    Finished // завершение игры, итоги 
}