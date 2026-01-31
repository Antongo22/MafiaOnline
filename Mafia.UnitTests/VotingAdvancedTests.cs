using Mafia.Controllers;
using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Hubs;
using Mafia.Models;
using Mafia.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Mafia.UnitTests;

[Collection("GameTests")]
public class VotingAdvancedTests
{
    private GameCycleController CreateController(out Mock<IHubContext<ChatHub>> mockHubContext, out Mock<GameTimerService> mockTimerService)
    {
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        
        mockHubContext = new Mock<IHubContext<ChatHub>>();
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        
        mockTimerService = new Mock<GameTimerService>(
            MockBehavior.Loose, 
            mockHubContext.Object, 
            Mock.Of<ILogger<GameTimerService>>(), 
            Mock.Of<IVideoCallService>());
            
        return new GameCycleController(
            mockHubContext.Object, 
            Mock.Of<ILogger<GameCycleController>>(), 
            mockTimerService.Object);
    }

    [Fact]
    public async Task Vote_ForSelf_ShouldSucceed()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO> { new() { Id = voterId, Name = "Voter", IsAlive = true, Status = UserStatus.Player } },
            PlayerRoles = new Dictionary<string, Role> { { voterId, Role.Citizen } },
            CurrentGameState = new GameState 
            { 
                Phase = GamePhase.Voting, 
                CurrentVoterId = voterId,
                CurrentVoterIndex = 0,
                VoterOrder = new List<string> { voterId },
                Votes = new Dictionary<string, string>()
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.Vote(room.Id, voterId, voterId);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(voterId, room.CurrentGameState.Votes[voterId]);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task Vote_AlreadyVoted_ShouldReturnBadRequest()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        var otherId = "other1";
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO> 
            { 
                new() { Id = voterId, IsAlive = true, Status = UserStatus.Player },
                new() { Id = otherId, IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { otherId, Role.Mafia }
            },
            CurrentGameState = new GameState 
            { 
                Phase = GamePhase.Voting, 
                VoterOrder = new List<string> { otherId, voterId },
                Votes = new Dictionary<string, string> { { voterId, otherId } } // Уже проголосовал
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Пытаемся проголосовать второй раз
        var result = await controller.Vote(room.Id, voterId, otherId);

        Assert.IsType<BadRequestObjectResult>(result);
        var badRequest = (BadRequestObjectResult)result;
        Assert.Equal("You have already voted", badRequest.Value);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task Vote_AllVoted_ShouldForceAdvancePhase()
    {
        var controller = CreateController(out _, out var mockTimerService);
        var voterId = "voter1";
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO> { new() { Id = voterId, Name = "Voter", IsAlive = true, Status = UserStatus.Player } },
            PlayerRoles = new Dictionary<string, Role> { { voterId, Role.Citizen } },
            CurrentGameState = new GameState 
            { 
                Phase = GamePhase.Voting, 
                CurrentVoterId = voterId,
                CurrentVoterIndex = 0,
                VoterOrder = new List<string> { voterId },
                Votes = new Dictionary<string, string>()
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.Vote(room.Id, voterId, voterId);

        Assert.IsType<OkObjectResult>(result);
        mockTimerService.Verify(s => s.ForceAdvancePhaseAsync(room.Id), Times.Once);
        Game.Rooms.Clear();
    }
}
