namespace Mafia.Enums;

using Mafia.DTOs;

public enum Role
{
    Citizen, //  мирный
    Doctor, // доктор
    Sheriff, // шериф
    Immortal, // бессмертный 
    Prostitute, // путана/любовница
    Thief, // вор
    Spy, // Шпион
    Hunter, // Охотник
    
    Don, // дон мафии
    Mafia, // мафия
    Ninja,  // Ниндзя
    
    Maniac, // маньяк
}

public enum Team
{
    Good,    // Мирные жители
    Evil,    // Мафия
    Neutral  // Нейтральные (маньяк и т.д.)
}

public static class RoleInfo
{
    private static Dictionary<Role, (string, string, Team)> roles;
    
    static RoleInfo()
    {
        roles = new Dictionary<Role, (string, string, Team)>
        {
            // Мирные жители (Good)
            { Role.Citizen, ("Мирный", "Обычный игрок, его цель выжить", Team.Good) },
            { Role.Doctor, ("Доктор", "Задача каждую ночь лечить потенциальных жертв мафии", Team.Good) },
            { Role.Sheriff, ("Шериф", "Главный враг мафии, ведь он может проверить документы, и тем самым обнаруживать мафию", Team.Good) },
            { Role.Immortal, ("Бессмертный", "Его нельзя убить ночью, но на голосовании он не защищён", Team.Good) },
            { Role.Prostitute, ("Путана", "Ночью забирает одного игрока к себе. Если его пытались убить - он выживает. Однако если убьют путану, то игрок, которого забрали тоже умрёт", Team.Good) },
            { Role.Thief, ("Вор", "Крадёт у игрока все его инструменты и голос. Ночью его действия не считаются, а так же днём он не может голосовать.", Team.Good) },
            { Role.Spy, ("наблюдатель", "Мирный игрок, которому не спиться. Просыпается вместе с мафией, и эмитирует что он тоже мафия.", Team.Good) },
            { Role.Hunter, ("Охотник", "Мирный житель с немирными целями. Охотится на мафию и может убивать ночью. Но от ошибок никто не застрахован", Team.Good) },
            
            // Мафия (Evil)
            { Role.Don, ("Дон мафии", "Главарь мафии, который может искать шерифа. Так же его голос считается за 2", Team.Evil) },
            { Role.Mafia, ("Мафия", "Само зло. Цель - сделать так, чтобы в живых остались только члены мафии", Team.Evil) },
            { Role.Ninja, ("Ниндзя", "Играет за мафию, и просыпается отдельно и с ними. В свой ход кидает сюрикен на жертву (все видят кого пометили). Если на игроке 2 сюрекена, то он умирает.", Team.Evil) },
            
            // Нейтралы (Neutral)
            { Role.Maniac, ("Маньяк", "Настоящий псих одиночка. Все ему враги и он враг всем. Если останется 1 на 1 с мафией/мирным, то он победил", Team.Neutral) }
        };
    }
    
    public static (string, string, Team) GetRole(Role role)
    {
        return roles[role];
    }

    public static Team GetTeam(Role role)
    {
        return roles[role].Item3;
    }

    public static IEnumerable<RolesDTO> GetAllRoles()
    {
        return roles.Select(role => new RolesDTO()
        {
            RoleValue = role.Key.ToString(),
            Name = role.Value.Item1,
            Description = role.Value.Item2,
            Team = role.Value.Item3.ToString()
        });
    } 
    
}