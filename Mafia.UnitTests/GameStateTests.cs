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
public class GameStateTests
{
    private GameCycleController CreateController(out Mock<IHubContext<ChatHub>> mockHubContext)
    {
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        
        mockHubContext = new Mock<IHubContext<ChatHub>>();
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        
        var mockGameTimerService = new Mock<GameTimerService>(
            MockBehavior.Loose, 
            mockHubContext.Object, 
            Mock.Of<ILogger<GameTimerService>>(), 
            Mock.Of<IVideoCallService>());
            
        return new GameCycleController(
            mockHubContext.Object, 
            Mock.Of<ILogger<GameCycleController>>(), 
            mockGameTimerService.Object);
    }

    [Fact]
    public void GetGameState_RoomNotFound_ShouldReturnNotFound()
    {
        var controller = CreateController(out _);
        Game.Rooms.Clear();
        var result = controller.GetGameState("nonexistent");
        Assert.IsType<NotFoundObjectResult>(result);
        Game.Rooms.Clear();
    }

    [Fact]
    public void GetGameState_ActiveGame_ShouldReturnCurrentState()
    {
        var controller = CreateController(out _);
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Status = GameStatus.InProgress,
            CurrentGameState = new GameState { Phase = GamePhase.IndividualSpeech }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var result = controller.GetGameState(room.Id);
        Assert.IsType<OkObjectResult>(result);
        Game.Rooms.Clear();
    }
}
