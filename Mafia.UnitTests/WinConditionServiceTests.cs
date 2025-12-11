using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Services;
using Xunit;

namespace Mafia.UnitTests;

public class WinConditionServiceTests
{
    [Fact]
    public void CheckWinCondition_AllMafiaDeadAndNoManiac_ShouldReturnGood()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "3", IsAlive = false, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Citizen },
                { "2", Role.Sheriff },
                { "3", Role.Mafia }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Equal(Team.Good, winner);
    }

    [Fact]
    public void CheckWinCondition_MafiaEqualsGood_ShouldReturnEvil()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Citizen },
                { "2", Role.Mafia }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Equal(Team.Evil, winner);
    }

    [Fact]
    public void CheckWinCondition_ManiacAlone_ShouldReturnNeutral()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Maniac }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Equal(Team.Neutral, winner);
    }

    [Fact]
    public void CheckWinCondition_ManiacOneOnOne_ShouldReturnNeutral()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Maniac },
                { "2", Role.Citizen }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Equal(Team.Neutral, winner);
    }

    [Fact]
    public void CheckWinCondition_GameInProgress_ShouldReturnNull()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "3", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Citizen },
                { "2", Role.Sheriff },
                { "3", Role.Mafia }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Null(winner);
    }

    [Fact]
    public void CheckWinCondition_NoAlivePlayers_ShouldReturnGood()
    {
        // Arrange
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = false, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Citizen }
            }
        };

        // Act
        var winner = WinConditionService.CheckWinCondition(room);

        // Assert
        Assert.Equal(Team.Good, winner);
    }
}
