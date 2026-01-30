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

/// <summary>
/// Тесты TieBreaker голосования
/// </summary>
[Collection("GameTests")]
public class TieBreakerTests
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
    public async Task TieBreakerVote_KillAll_ShouldRecordVote()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = voterId, Name = "Voter", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "tied1", Name = "Tied1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "tied2", Name = "Tied2", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { "tied1", Role.Mafia },
                { "tied2", Role.Citizen }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.TieBreaker,
                TieBreakerCandidates = new List<string> { "tied1", "tied2" },
                TieBreakerVotes = new Dictionary<string, bool>()
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.TieBreakerVote(room.Id, voterId, true);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState.TieBreakerVotes.ContainsKey(voterId));
        Assert.True(room.CurrentGameState.TieBreakerVotes[voterId]);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task TieBreakerVote_Pardon_ShouldRecordVote()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = voterId, Name = "Voter", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "tied1", Name = "Tied1", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { "tied1", Role.Mafia }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.TieBreaker,
                TieBreakerCandidates = new List<string> { "tied1" },
                TieBreakerVotes = new Dictionary<string, bool>()
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.TieBreakerVote(room.Id, voterId, false);

        Assert.IsType<OkObjectResult>(result);
        Assert.False(room.CurrentGameState.TieBreakerVotes[voterId]);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task TieBreakerVote_NotInTieBreakerPhase_ShouldReturnBadRequest()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO> { new() { Id = voterId, IsAlive = true, Status = UserStatus.Player } },
            CurrentGameState = new GameState { Phase = GamePhase.Voting }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.TieBreakerVote(room.Id, voterId, true);

        Assert.IsType<BadRequestObjectResult>(result);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task TieBreakerVote_DeadPlayer_ShouldReturnBadRequest()
    {
        var controller = CreateController(out _, out _);
        var voterId = "voter1";
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO> { new() { Id = voterId, IsAlive = false, Status = UserStatus.Player } },
            CurrentGameState = new GameState { Phase = GamePhase.TieBreaker }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.TieBreakerVote(room.Id, voterId, true);

        Assert.IsType<BadRequestObjectResult>(result);
        Game.Rooms.Clear();
    }



    [Fact]
    public async Task TieBreakerVote_AllVoted_ShouldForceAdvancePhase()
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
                Phase = GamePhase.TieBreaker,
                TieBreakerVotes = new Dictionary<string, bool>()
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = await controller.TieBreakerVote(room.Id, voterId, true);

        Assert.IsType<OkObjectResult>(result);
        mockTimerService.Verify(s => s.ForceAdvancePhaseAsync(room.Id), Times.Once);
        Game.Rooms.Clear();
    }
}
