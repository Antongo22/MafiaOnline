using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Models;
using Mafia.Services;
using Xunit;

namespace Mafia.UnitTests;

public class WinConditionAdvancedTests
{
    [Fact]
    public void CheckWinCondition_MafiaMoreThanGood_ShouldReturnEvil()
    {
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
                { "2", Role.Mafia },
                { "3", Role.Don }
            }
        };

        var winner = WinConditionService.CheckWinCondition(room);
        Assert.Equal(Team.Evil, winner);
    }

    [Fact]
    public void CheckWinCondition_ManiacVsMafia_GameContinues()
    {
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
                { "1", Role.Maniac },
                { "2", Role.Mafia },
                { "3", Role.Citizen }
            }
        };

        var winner = WinConditionService.CheckWinCondition(room);
        Assert.Null(winner);
    }

    [Fact]
    public void CheckWinCondition_DonAndMafiaVsCitizens_EvilWins()
    {
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "3", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "4", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Don },
                { "2", Role.Mafia },
                { "3", Role.Citizen },
                { "4", Role.Sheriff }
            }
        };

        var winner = WinConditionService.CheckWinCondition(room);
        Assert.Equal(Team.Evil, winner);
    }

    [Fact]
    public void CheckWinCondition_AllGoodDeadManiacVsMafia_ManiacWins()
    {
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = false, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "3", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Citizen },
                { "2", Role.Maniac },
                { "3", Role.Mafia }
            }
        };

        var winner = WinConditionService.CheckWinCondition(room);
        Assert.Equal(Team.Neutral, winner);
    }

    [Fact]
    public void CheckWinCondition_PlayersWhoLeft_ShouldBeExcluded()
    {
        var room = new RoomDTO
        {
            Users = new List<UserDTO>
            {
                new() { Id = "1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "2", IsAlive = true, Status = UserStatus.Leave },
                new() { Id = "3", IsAlive = false, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { "1", Role.Sheriff },
                { "2", Role.Mafia },
                { "3", Role.Citizen }
            }
        };

        var winner = WinConditionService.CheckWinCondition(room);
        Assert.Equal(Team.Good, winner);
    }
}
