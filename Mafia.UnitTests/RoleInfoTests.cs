using Mafia.Enums;
using Xunit;

namespace Mafia.UnitTests;

public class RoleInfoTests
{
    [Fact]
    public void GetRole_ShouldReturnCorrectRoleInfo()
    {
        // Act
        var (name, description, team, isUnique) = RoleInfo.GetRole(Role.Sheriff);

        // Assert
        Assert.Equal("Шериф", name);
        Assert.Contains("проверить", description);
        Assert.Equal(Team.Good, team);
        Assert.True(isUnique);
    }

    [Fact]
    public void GetTeam_ForCitizen_ShouldReturnGood()
    {
        // Act
        var team = RoleInfo.GetTeam(Role.Citizen);

        // Assert
        Assert.Equal(Team.Good, team);
    }

    [Fact]
    public void GetTeam_ForMafia_ShouldReturnEvil()
    {
        // Act
        var team = RoleInfo.GetTeam(Role.Mafia);

        // Assert
        Assert.Equal(Team.Evil, team);
    }

    [Fact]
    public void GetTeam_ForManiac_ShouldReturnNeutral()
    {
        // Act
        var team = RoleInfo.GetTeam(Role.Maniac);

        // Assert
        Assert.Equal(Team.Neutral, team);
    }

    [Fact]
    public void IsUnique_ForSheriff_ShouldReturnTrue()
    {
        // Act
        var isUnique = RoleInfo.IsUnique(Role.Sheriff);

        // Assert
        Assert.True(isUnique);
    }

    [Fact]
    public void IsUnique_ForCitizen_ShouldReturnFalse()
    {
        // Act
        var isUnique = RoleInfo.IsUnique(Role.Citizen);

        // Assert
        Assert.False(isUnique);
    }

    [Fact]
    public void GetAllRoles_ShouldReturnAllRoles()
    {
        // Act
        var roles = RoleInfo.GetAllRoles().ToList();

        // Assert
        Assert.NotEmpty(roles);
        Assert.Contains(roles, r => r.Name == "Шериф");
        Assert.Contains(roles, r => r.Name == "Мафия");
        Assert.Contains(roles, r => r.Name == "Мирный");
    }

    [Fact]
    public void GetAllRoles_ShouldHaveCorrectStructure()
    {
        // Act
        var roles = RoleInfo.GetAllRoles().ToList();

        // Assert
        foreach (var role in roles)
        {
            Assert.NotNull(role.RoleValue);
            Assert.NotNull(role.Name);
            Assert.NotNull(role.Description);
            Assert.NotNull(role.Team);
        }
    }
}
