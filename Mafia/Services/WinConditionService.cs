using Mafia.DTOs;
using Mafia.Enums;

namespace Mafia.Services;

/// <summary>
/// Сервис для проверки условий победы в игре
/// </summary>
public class WinConditionService
{
    /// <summary>
    /// Проверяет условия победы и возвращает команду-победителя, если игра окончена
    /// </summary>
    public static Team? CheckWinCondition(RoomDTO room)
    {
        var alivePlayers = room.Users.Where(u => u.Status != UserStatus.Leave && u.IsAlive).ToList();
        
        if (alivePlayers.Count == 0)
            return Team.Draw; // Ничья - никого не осталось
        
        var alivePlayersWithRoles = alivePlayers
            .Where(u => room.PlayerRoles != null && room.PlayerRoles.ContainsKey(u.Id))
            .ToList();
        
        if (alivePlayersWithRoles.Count == 0)
            return null;
        
        // Подсчитываем живых игроков по командам
        int mafiaCount = 0;
        int goodCount = 0;
        int maniacCount = 0;
        string? maniacId = null;
        
        foreach (var user in alivePlayersWithRoles)
        {
            var role = room.PlayerRoles![user.Id];
            var team = RoleInfo.GetTeam(role);
            
            if (team == Team.Evil)
                mafiaCount++;
            else if (team == Team.Good)
                goodCount++;
            else if (team == Team.Neutral)
            {
                maniacCount++;
                maniacId = user.Id;
            }
        }
        
        // Проверка победы маньяка
        if (maniacCount > 0)
        {
            // Маньяк побеждает, если остался один на один с кем-то или вообще один
            if (alivePlayersWithRoles.Count == 1)
                return Team.Neutral; // Маньяк один - победа
            if (alivePlayersWithRoles.Count == 2)
                return Team.Neutral; // Маньяк 1 на 1 - победа
        }
        
        // Проверка победы мирных
        if (mafiaCount == 0 && maniacCount == 0)
            return Team.Good; // Нет мафии и маньяка - победа мирных
        
        // Проверка победы мафии
        if (maniacCount == 0)
        {
            // Если нет маньяка, мафия побеждает когда их >= остальных
            if (mafiaCount >= goodCount)
                return Team.Evil;
        }
        else
        {
            // Если есть маньяк, мафия должна иметь перевес
            // Например: 2 мафии, 1 маньяк = победа мафии
            if (mafiaCount > goodCount + maniacCount)
                return Team.Evil;
        }
        
        return null; // Игра продолжается
    }
}

