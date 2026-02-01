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
/// Тесты ночных действий для всех ролей
/// </summary>
[Collection("GameTests")]
public class NightActionTests
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

    private RoomDTO CreateNightRoom(string playerId, Role role, NightPhase nightPhase)
    {
        return new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = playerId, Name = "Player", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "target1", Name = "Target", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { playerId, role },
                { "target1", Role.Citizen }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Night,
                CurrentNightPhase = nightPhase,
                NightActions = new Dictionary<string, string>(),
                ManiacSelfHealsLeft = 1
            }
        };
    }

    [Fact]
    public async Task NightAction_MafiaKill_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var mafiaId = "mafia1";
        var room = CreateNightRoom(mafiaId, Role.Mafia, NightPhase.Mafia);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "kill" };
        var result = await controller.NightAction(room.Id, mafiaId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(mafiaId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_DonCheck_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var donId = "don1";
        var room = CreateNightRoom(donId, Role.Don, NightPhase.Don);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "check" };
        var result = await controller.NightAction(room.Id, donId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(donId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_DonInMafiaPhase_ShouldSucceed()
    {
        var controller = CreateController(out _);
        var donId = "don1";
        var room = CreateNightRoom(donId, Role.Don, NightPhase.Mafia);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "kill" };
        var result = await controller.NightAction(room.Id, donId, action);

        Assert.IsType<OkObjectResult>(result);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_SheriffCheck_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var sheriffId = "sheriff1";
        var room = CreateNightRoom(sheriffId, Role.Sheriff, NightPhase.Sheriff);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "check" };
        var result = await controller.NightAction(room.Id, sheriffId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(sheriffId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_DoctorHeal_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var doctorId = "doctor1";
        var room = CreateNightRoom(doctorId, Role.Doctor, NightPhase.Doctor);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "heal" };
        var result = await controller.NightAction(room.Id, doctorId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(doctorId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_ManiacKill_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var maniacId = "maniac1";
        var room = CreateNightRoom(maniacId, Role.Maniac, NightPhase.Maniac);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "kill" };
        var result = await controller.NightAction(room.Id, maniacId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(maniacId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_ManiacHealSelf_ShouldDecrementHeals()
    {
        var controller = CreateController(out _);
        var maniacId = "maniac1";
        var room = CreateNightRoom(maniacId, Role.Maniac, NightPhase.Maniac);
        room.CurrentGameState!.ManiacSelfHealsLeft = 1;
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { ActionType = "heal_self" };
        var result = await controller.NightAction(room.Id, maniacId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, room.CurrentGameState.ManiacSelfHealsLeft);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_ProstituteProtect_ShouldRecordAction()
    {
        var controller = CreateController(out _);
        var prostituteId = "prostitute1";
        var room = CreateNightRoom(prostituteId, Role.Prostitute, NightPhase.Prostitute);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "protect" };
        var result = await controller.NightAction(room.Id, prostituteId, action);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(room.CurrentGameState!.NightActions.ContainsKey(prostituteId));
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_WrongPhase_ShouldReturnBadRequest()
    {
        var controller = CreateController(out _);
        var sheriffId = "sheriff1";
        var room = CreateNightRoom(sheriffId, Role.Sheriff, NightPhase.Mafia);
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "check" };
        var result = await controller.NightAction(room.Id, sheriffId, action);

        Assert.IsType<BadRequestObjectResult>(result);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_DeadPlayer_ShouldReturnBadRequest()
    {
        var controller = CreateController(out _);
        var mafiaId = "mafia1";
        var room = CreateNightRoom(mafiaId, Role.Mafia, NightPhase.Mafia);
        room.Users.First(u => u.Id == mafiaId).IsAlive = false;
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = "target1", ActionType = "kill" };
        var result = await controller.NightAction(room.Id, mafiaId, action);

        Assert.IsType<BadRequestObjectResult>(result);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_DonChecksSheriff_ShouldRevealRole()
    {
        var controller = CreateController(out var mockHubContext);
        var donId = "don1";
        var sheriffId = "sheriff1";
        
        var room = CreateNightRoom(donId, Role.Don, NightPhase.Don);
        // Добавляем шерифа в комнату
        room.Users.Add(new UserDTO { Id = sheriffId, Name = "Sheriff", IsAlive = true, Status = UserStatus.Player });
        room.PlayerRoles![sheriffId] = Role.Sheriff;
        room.CurrentGameState!.SheriffId = sheriffId;
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = sheriffId, ActionType = "check" };
        var result = await controller.NightAction(room.Id, donId, action);

        Assert.IsType<OkObjectResult>(result);
        
        // Проверяем что был отправлен SignalR ивент CardRevealed
        mockHubContext.Verify(
            h => h.Clients.Group(room.Id).SendCoreAsync(
                "CardRevealed",
                It.Is<object[]>(args => 
                    args.Length == 1 && 
                    args[0].ToString()!.Contains(sheriffId) && // Target ID
                    args[0].ToString()!.Contains("Sheriff")    // Role
                ),
                default),
            Times.Once);
            
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_SheriffChecksMafia_ShouldRevealRole()
    {
        var controller = CreateController(out var mockHubContext);
        var sheriffId = "sheriff1";
        var mafiaId = "mafia1";
        
        var room = CreateNightRoom(sheriffId, Role.Sheriff, NightPhase.Sheriff);
        // Добавляем мафию
        room.Users.Add(new UserDTO { Id = mafiaId, Name = "Mafia", IsAlive = true, Status = UserStatus.Player });
        room.PlayerRoles![mafiaId] = Role.Mafia;
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = mafiaId, ActionType = "check" };
        var result = await controller.NightAction(room.Id, sheriffId, action);

        Assert.IsType<OkObjectResult>(result);
        
        // Шериф нашел мафию -> карта раскрывается
        mockHubContext.Verify(
            h => h.Clients.Group(room.Id).SendCoreAsync(
                "CardRevealed",
                It.Is<object[]>(args => 
                    args.Length == 1 && 
                    args[0].ToString()!.Contains(mafiaId) &&
                    args[0].ToString()!.Contains("Mafia")
                ),
                default),
            Times.Once);
            
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightAction_SheriffChecksCitizen_ShouldNotRevealRole()
    {
        var controller = CreateController(out var mockHubContext);
        var sheriffId = "sheriff1";
        var citizenId = "citizen1";
        
        var room = CreateNightRoom(sheriffId, Role.Sheriff, NightPhase.Sheriff);
        // Гражданин уже есть в дефолтном CreateNightRoom как target1, используем его или добавим нового
        // CreateNightRoom создает "target1" с Role.Citizen.
        citizenId = "target1";
        
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        var action = new NightActionDTO { TargetId = citizenId, ActionType = "check" };
        var result = await controller.NightAction(room.Id, sheriffId, action);

        Assert.IsType<OkObjectResult>(result);
        
        // Шериф проверил мирного -> CardRevealed НЕ отправляется (по текущей логике)
        // Или отправляется? В коде: if (RoleInfo.GetTeam(targetRole) == Team.Evil) { SendAsync... }
        // Citizen - не Evil. Значит не отправляется.
        
        mockHubContext.Verify(
            h => h.Clients.Group(room.Id).SendCoreAsync(
                "CardRevealed",
                It.IsAny<object[]>(),
                default),
            Times.Never);
            
        Game.Rooms.Clear();
    }
}
