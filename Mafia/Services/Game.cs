using Mafia.Enums;
using Mafia.DTOs;


namespace Mafia.Services;

/// <summary>
/// Статический класс для хранения глобального состояния игры
/// </summary>
public static class Game
{
    /// <summary>
    /// Список всех активных игровых комнат
    /// </summary>
    public static List<RoomDTO> Rooms = new();
    
    /// <summary>
    /// История сообщений общего чата по комнатам
    /// </summary>
    public static Dictionary<string, List<ChatMessageDTO>> ChatMessages = new();
    
    /// <summary>
    /// История сообщений чата мафии по комнатам
    /// </summary>
    public static Dictionary<string, List<ChatMessageDTO>> MafiaChatMessages = new();
    
    /// <summary>
    /// Маппинг ConnectionId -> (RoomId, UserId) для отслеживания отключений
    /// </summary>
    public static System.Collections.Concurrent.ConcurrentDictionary<string, (string RoomId, string UserId)> UserConnections = new();
    
    /// <summary>
    /// Отложенные отключения (UserId -> CancellationTokenSource) для grace period при перезагрузке
    /// </summary>
    public static System.Collections.Concurrent.ConcurrentDictionary<string, CancellationTokenSource> PendingDisconnections = new();
    
    /// <summary>
    /// Распределяет роли случайным образом между игроками
    /// </summary>
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