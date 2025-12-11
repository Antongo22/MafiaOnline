using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Services;
using Xunit;

namespace Mafia.UnitTests;

public class GameServiceTests
{
    [Fact]
    public void ShufflePlayersWithRoles_WithValidInput_ShouldReturnCorrectNumberOfRoles()
    {
        // Arrange
        var gameCreate = new GameCreateDTO
        {
            PlayersNames = new List<string> { "Player1", "Player2", "Player3", "Player4" },
            Roles = new Dictionary<Role, int>
            {
                { Role.Citizen, 2 },
                { Role.Mafia, 1 },
                { Role.Sheriff, 1 }
            }
        };

        // Act
        var result = Game.ShufflePlayersWithRoles(gameCreate);

        // Assert
        Assert.Equal(4, result.Count);
        Assert.Equal(2, result.Values.Count(r => r == Role.Citizen));
        Assert.Equal(1, result.Values.Count(r => r == Role.Mafia));
        Assert.Equal(1, result.Values.Count(r => r == Role.Sheriff));
    }

    [Fact]
    public void ShufflePlayersWithRoles_WithNullPlayers_ShouldThrowArgumentNullException()
    {
        // Arrange
        var gameCreate = new GameCreateDTO
        {
            PlayersNames = null!,
            Roles = new Dictionary<Role, int> { { Role.Citizen, 1 } }
        };

        // Act & Assert
        Assert.Throws<ArgumentNullException>(() => Game.ShufflePlayersWithRoles(gameCreate));
    }

    [Fact]
    public void ShufflePlayersWithRoles_WithNullRoles_ShouldThrowArgumentNullException()
    {
        // Arrange
        var gameCreate = new GameCreateDTO
        {
            PlayersNames = new List<string> { "Player1" },
            Roles = null!
        };

        // Act & Assert
        Assert.Throws<ArgumentNullException>(() => Game.ShufflePlayersWithRoles(gameCreate));
    }

    [Fact]
    public void ShufflePlayersWithRoles_WithMismatchedCounts_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var gameCreate = new GameCreateDTO
        {
            PlayersNames = new List<string> { "Player1", "Player2" },
            Roles = new Dictionary<Role, int>
            {
                { Role.Citizen, 1 }
            }
        };

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => Game.ShufflePlayersWithRoles(gameCreate));
    }

    [Fact]
    public void ShufflePlayersWithRoles_ShouldAssignEachPlayerUniqueRole()
    {
        // Arrange
        var gameCreate = new GameCreateDTO
        {
            PlayersNames = new List<string> { "Player1", "Player2", "Player3" },
            Roles = new Dictionary<Role, int>
            {
                { Role.Citizen, 1 },
                { Role.Mafia, 1 },
                { Role.Sheriff, 1 }
            }
        };

        // Act
        var result = Game.ShufflePlayersWithRoles(gameCreate);

        // Assert
        Assert.Equal(3, result.Keys.Distinct().Count());
        Assert.All(gameCreate.PlayersNames, player => Assert.Contains(player, result.Keys));
    }
}
