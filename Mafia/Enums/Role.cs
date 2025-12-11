namespace Mafia.Enums;

using Mafia.DTOs;

/// <summary>
/// Роли в игре Мафия
/// </summary>
public enum Role
{
    /// <summary>Мирный житель</summary>
    Citizen,
    
    /// <summary>Доктор - лечит игроков ночью</summary>
    Doctor,
    
    /// <summary>Шериф - проверяет игроков на принадлежность к мафии</summary>
    Sheriff,
    
    /// <summary>Бессмертный - не может быть убит ночью</summary>
    Immortal,
    
    /// <summary>Путана - забирает игрока к себе на ночь</summary>
    Prostitute,
    
    /// <summary>Дон мафии - главарь мафии, ищет шерифа</summary>
    Don,
    
    /// <summary>Мафия - убивает мирных жителей</summary>
    Mafia,
    
    /// <summary>Маньяк - нейтральная роль, играет сам за себя</summary>
    Maniac
}

/// <summary>
/// Команды в игре
/// </summary>
public enum Team
{
    /// <summary>Команда мирных жителей</summary>
    Good,
    
    /// <summary>Команда мафии</summary>
    Evil,
    
    /// <summary>Нейтральная команда</summary>
    Neutral
}

/// <summary>
/// Статический класс с информацией о ролях
/// </summary>
public static class RoleInfo
{
    private static Dictionary<Role, (string, string, Team, bool)> roles;
    
    static RoleInfo()
    {
        roles = new Dictionary<Role, (string, string, Team, bool)>
        {
            // Мирные жители (Good)
            // (Название, Описание, Команда, Уникальная)
            { Role.Citizen, ("Мирный", "Обычный игрок, его цель выжить", Team.Good, false) },
            { Role.Doctor, ("Доктор", "Задача каждую ночь лечить потенциальных жертв мафии", Team.Good, true) },
            { Role.Sheriff, ("Шериф", "Главный враг мафии, ведь он может проверить документы, и тем самым обнаруживать мафию", Team.Good, true) },
            { Role.Immortal, ("Бессмертный", "Его нельзя убить ночью, но на голосовании он не защищён", Team.Good, true) },
            { Role.Prostitute, ("Путана", "Ночью забирает одного игрока к себе. Если его пытались убить - он выживает. Однако если убьют путану, то игрок, которого забрали тоже умрёт", Team.Good, true) },
            // { Role.Thief, ("Вор", "Крадёт у игрока все его инструменты и голос. Ночью его действия не считаются, а так же днём он не может голосовать.", Team.Good, true) },
            // { Role.Spy, ("Наблюдатель", "Мирный игрок, которому не спиться. Просыпается вместе с мафией, и эмитирует что он тоже мафия.", Team.Good, true) },
            // { Role.Hunter, ("Охотник", "Мирный житель с немирными целями. Охотится на мафию и может убивать ночью. Но от ошибок никто не застрахован", Team.Good, true) },
            
            // Мафия (Evil)
            { Role.Don, ("Дон мафии", "Главарь мафии, который может искать шерифа. Так же его голос считается за 2", Team.Evil, true) },
            { Role.Mafia, ("Мафия", "Само зло. Цель - сделать так, чтобы в живых остались только члены мафии", Team.Evil, false) },
            // { Role.Ninja, ("Ниндзя", "Играет за мафию, и просыпается отдельно и с ними. В свой ход кидает сюрикен на жертву (все видят кого пометили). Если на игроке 2 сюрекена, то он умирает.", Team.Evil, true) },
            
            // Нейтралы (Neutral)
            { Role.Maniac, ("Маньяк", "Настоящий псих одиночка. Все ему враги и он враг всем. Если останется 1 на 1 с мафией/мирным, то он победил", Team.Neutral, true) }
        };
    }
    
    /// <summary>
    /// Получить полную информацию о роли
    /// </summary>
    public static (string, string, Team, bool) GetRole(Role role)
    {
        return roles[role];
    }

    /// <summary>
    /// Получить команду, к которой принадлежит роль
    /// </summary>
    public static Team GetTeam(Role role)
    {
        return roles[role].Item3;
    }

    /// <summary>
    /// Проверить, является ли роль уникальной
    /// </summary>
    public static bool IsUnique(Role role)
    {
        return roles[role].Item4;
    }

    /// <summary>
    /// Получить список всех доступных ролей
    /// </summary>
    public static IEnumerable<RolesDTO> GetAllRoles()
    {
        return roles.Select(role => new RolesDTO()
        {
            RoleValue = role.Key.ToString(),
            Name = role.Value.Item1,
            Description = role.Value.Item2,
            Team = role.Value.Item3.ToString(),
            IsUnique = role.Value.Item4
        });
    } 
    
}