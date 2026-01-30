using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Helpers;
using Xunit;

namespace Mafia.UnitTests;

/// <summary>
/// Тесты для RoleInfo хелпера
/// </summary>
public class RoleInfoTests
{
    [Theory]
    [InlineData(Role.Citizen, Team.Good)]
    [InlineData(Role.Sheriff, Team.Good)]
    [InlineData(Role.Doctor, Team.Good)]
    [InlineData(Role.Immortal, Team.Good)]
    [InlineData(Role.Prostitute, Team.Good)]
    [InlineData(Role.Mafia, Team.Evil)]
    [InlineData(Role.Don, Team.Evil)]
    [InlineData(Role.Maniac, Team.Neutral)]
    public void GetTeam_ShouldReturnCorrectTeam(Role role, Team expectedTeam)
    {
        // Act
        var team = RoleInfo.GetTeam(role);

        // Assert
        Assert.Equal(expectedTeam, team);
    }

    [Theory]
    [InlineData(Role.Citizen, "Мирный")]
    [InlineData(Role.Sheriff, "Шериф")]
    [InlineData(Role.Mafia, "Мафия")]
    [InlineData(Role.Don, "Дон мафии")]
    [InlineData(Role.Doctor, "Доктор")]
    [InlineData(Role.Maniac, "Маньяк")]
    [InlineData(Role.Prostitute, "Путана")]
    [InlineData(Role.Immortal, "Бессмертный")]
    public void GetRole_ShouldReturnCorrectName(Role role, string expectedName)
    {
        // Act
        var (name, _, _, _) = RoleInfo.GetRole(role);

        // Assert
        Assert.Equal(expectedName, name);
    }

    [Theory]
    [InlineData(Role.Citizen, false)]
    [InlineData(Role.Mafia, false)]
    [InlineData(Role.Don, true)]
    [InlineData(Role.Sheriff, true)]
    [InlineData(Role.Doctor, true)]
    [InlineData(Role.Maniac, true)]
    public void IsUnique_ShouldReturnCorrectValue(Role role, bool expectedUnique)
    {
        // Act
        var isUnique = RoleInfo.IsUnique(role);

        // Assert
        Assert.Equal(expectedUnique, isUnique);
    }

    [Fact]
    public void GetAllRoles_ShouldReturnAllDefinedRoles()
    {
        // Act
        var roles = RoleInfo.GetAllRoles().ToList();

        // Assert
        Assert.True(roles.Count >= 8); // Минимум 8 ролей определено
        Assert.Contains(roles, r => r.RoleValue == "Citizen");
        Assert.Contains(roles, r => r.RoleValue == "Mafia");
        Assert.Contains(roles, r => r.RoleValue == "Don");
        Assert.Contains(roles, r => r.RoleValue == "Sheriff");
    }
}
