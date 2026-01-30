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

public class VotingProtectionTests
{
    [Fact]
    public async Task Vote_ForDeadPlayer_ShouldReturnBadRequest()
    {
        // Arrange
        var mockHubContext = new Mock<IHubContext<ChatHub>>();
        var mockGameTimerService = new Mock<GameTimerService>(MockBehavior.Loose, mockHubContext.Object, Mock.Of<ILogger<GameTimerService>>(), Mock.Of<VideoCallService>());
        var controller = new GameCycleController(mockHubContext.Object, Mock.Of<ILogger<GameCycleController>>(), mockGameTimerService.Object);
        
        var roomId = Guid.NewGuid().ToString();
        var voterId = "voter1";
        var deadPlayerId = "dead1";
        
        var room = new RoomDTO
        {
            Id = roomId,
            Users = new List<UserDTO>
            {
                new() { Id = voterId, IsAlive = true, Status = UserStatus.Player },
                new() { Id = deadPlayerId, IsAlive = false, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { deadPlayerId, Role.Mafia }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Voting,
                CurrentVoterId = voterId,
                VoterOrder = new List<string> { voterId },
                Votes = new Dictionary<string, string>()
            }
        };
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        var result = await controller.Vote(roomId, voterId, deadPlayerId);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Cannot vote for dead player", badRequestResult.Value);
        
        // Cleanup
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task Vote_ForPlayerWhoLeft_ShouldReturnBadRequest()
    {
        // Arrange
        var mockHubContext = new Mock<IHubContext<ChatHub>>();
        var mockGameTimerService = new Mock<GameTimerService>(MockBehavior.Loose, mockHubContext.Object, Mock.Of<ILogger<GameTimerService>>(), Mock.Of<VideoCallService>());
        var controller = new GameCycleController(mockHubContext.Object, Mock.Of<ILogger<GameCycleController>>(), mockGameTimerService.Object);
        
        var roomId = Guid.NewGuid().ToString();
        var voterId = "voter1";
        var leftPlayerId = "left1";
        
        var room = new RoomDTO
        {
            Id = roomId,
            Users = new List<UserDTO>
            {
                new() { Id = voterId, IsAlive = true, Status = UserStatus.Player },
                new() { Id = leftPlayerId, IsAlive = true, Status = UserStatus.Leave }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { leftPlayerId, Role.Sheriff }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Voting,
                CurrentVoterId = voterId,
                VoterOrder = new List<string> { voterId },
                Votes = new Dictionary<string, string>()
            }
        };
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        var result = await controller.Vote(roomId, voterId, leftPlayerId);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Cannot vote for player who left", badRequestResult.Value);
        
        // Cleanup
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task Vote_ForAlivePlayer_ShouldSucceed()
    {
        // Arrange
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        
        var mockHubContext = new Mock<IHubContext<ChatHub>>();
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        
        var mockGameTimerService = new Mock<GameTimerService>(MockBehavior.Loose, mockHubContext.Object, Mock.Of<ILogger<GameTimerService>>(), Mock.Of<VideoCallService>());
        var controller = new GameCycleController(mockHubContext.Object, Mock.Of<ILogger<GameCycleController>>(), mockGameTimerService.Object);
        
        var roomId = Guid.NewGuid().ToString();
        var voterId = "voter1";
        var targetId = "target1";
        
        var room = new RoomDTO
        {
            Id = roomId,
            Users = new List<UserDTO>
            {
                new() { Id = voterId, IsAlive = true, Status = UserStatus.Player },
                new() { Id = targetId, IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { voterId, Role.Citizen },
                { targetId, Role.Mafia }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Voting,
                CurrentVoterId = voterId,
                VoterOrder = new List<string> { voterId },
                CurrentVoterIndex = 0,
                Votes = new Dictionary<string, string>()
            }
        };
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        var result = await controller.Vote(roomId, voterId, targetId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
        
        // Проверяем, что голос записан
        Assert.True(room.CurrentGameState.Votes.ContainsKey(voterId));
        Assert.Equal(targetId, room.CurrentGameState.Votes[voterId]);
        
        // Cleanup
        Game.Rooms.Clear();
    }
}
