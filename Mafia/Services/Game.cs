using Mafia.Enums;
using Mafia.DTOs;

namespace Mafia.Services;



public static class Game
{
    public static Dictionary<string, Role> ShufflePlayersWithRoles(GameCreateDTO game)
    {
        if (game.PlayersNames == null || game.Roles == null)
        {
            throw new ArgumentNullException(
                game.PlayersNames == null ? nameof(game.PlayersNames) : nameof(game.Roles),
                "Список игроков и ролей не могут быть null");
        }

        var rolesList = new List<Role>();
        foreach (var roleEntry in game.Roles)
        {
            for (int i = 0; i < roleEntry.Value; i++)
            {
                rolesList.Add(roleEntry.Key);
            }
        }

        if (rolesList.Count != game.PlayersNames.Count)
        {
            throw new InvalidOperationException(
                $"Количество ролей ({rolesList.Count}) не совпадает с количеством игроков ({game.PlayersNames.Count})");
        }

        var random = new Random();
        rolesList = rolesList.OrderBy(x => random.Next()).ToList();

        var result = new Dictionary<string, Role>();
        for (int i = 0; i < game.PlayersNames.Count; i++)
        {
            result[game.PlayersNames[i]] = rolesList[i];
        }

        return result;
    }
}