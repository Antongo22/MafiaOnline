using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Hubs;
using Mafia.Models;
using Mafia.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using System.Text.Json;
using System.Linq;

namespace Mafia.UnitTests;

/// <summary>
/// Тесты для GameTimerService
/// </summary>
[Collection("GameTests")]
public class GameTimerServiceTests
{
    private GameTimerService CreateService(out Mock<IHubContext<ChatHub>> mockHubContext)
    {
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        
        mockHubContext = new Mock<IHubContext<ChatHub>>();
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        
        return new GameTimerService(
            mockHubContext.Object,
            Mock.Of<ILogger<GameTimerService>>(),
            Mock.Of<IVideoCallService>());
    }

    [Fact]
    public async Task ForceAdvancePhaseAsync_RoomNotFound_ShouldNotThrow()
    {
        var service = CreateService(out _);
        Game.Rooms.Clear();
        await service.ForceAdvancePhaseAsync("nonexistent");
    }

    [Fact]
    public async Task ForceAdvancePhaseAsync_NoGameState_ShouldNotThrow()
    {
        var service = CreateService(out _);
        var room = new RoomDTO { Id = Guid.NewGuid().ToString(), CurrentGameState = null };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        await service.ForceAdvancePhaseAsync(room.Id);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task ForceAdvancePhaseAsync_IndividualSpeech_ShouldAdvanceToNextSpeaker()
    {
        var service = CreateService(out var mockHubContext);
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = "p1", Name = "Player1", IsAlive = true, Status = UserStatus.Player },
                new() { Id = "p2", Name = "Player2", IsAlive = true, Status = UserStatus.Player }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.IndividualSpeech,
                DayNumber = 1,
                CurrentSpeakerId = "p1",
                SpeakerOrder = new List<string> { "p1", "p2" },
                CurrentSpeakerIndex = 0,
                HasSpoken = new Dictionary<string, bool>(),
                PhaseStartTime = DateTime.UtcNow.AddSeconds(-60),
                PhaseTimeSeconds = 30
            }
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        await service.ForceAdvancePhaseAsync(room.Id);

        mockHubContext.Verify(
            h => h.Clients.Group(room.Id).SendCoreAsync(
                It.IsAny<string>(),
                It.IsAny<object[]>(),
                default),
            Times.AtLeastOnce);
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightResults_ProstituteKilledByMafia_ShouldKillBoth()
    {
        var service = CreateService(out _);
        var mafiaId = "mafia1";
        var prostituteId = "prostitute1";
        
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = mafiaId, Name = "Mafia", IsAlive = true, Status = UserStatus.Player },
                new() { Id = prostituteId, Name = "Prostitute", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { mafiaId, Role.Mafia },
                { prostituteId, Role.Prostitute }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Night,
                CurrentNightPhase = NightPhase.Prostitute, // Последняя фаза
                NightActions = new Dictionary<string, string>
                {
                    // Мафия убивает путану
                    { mafiaId, JsonSerializer.Serialize(new { action = "kill", targetId = prostituteId }) },
                    // Путана идет к мафии
                    { prostituteId, JsonSerializer.Serialize(new { action = "protect", targetId = mafiaId }) }
                },
                PendingDeaths = new List<string>()
            },
            GameSettings = new GameSettings()
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        await service.ForceAdvancePhaseAsync(room.Id);

        // Assert
        var mafia = room.Users.First(u => u.Id == mafiaId);
        var prostitute = room.Users.First(u => u.Id == prostituteId);

        Assert.False(prostitute.IsAlive, "Prostitute should be dead");
        Assert.False(mafia.IsAlive, "Mafia should be dead because Prostitute visited them and died");
        
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightResults_ImmortalAttacked_ShouldSurvive()
    {
        var service = CreateService(out _);
        var mafiaId = "mafia1";
        var immortalId = "immortal1";
        
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = mafiaId, Name = "Mafia", IsAlive = true, Status = UserStatus.Player },
                new() { Id = immortalId, Name = "Immortal", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { mafiaId, Role.Mafia },
                { immortalId, Role.Immortal }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Night,
                CurrentNightPhase = NightPhase.Prostitute, // Последняя фаза
                NightActions = new Dictionary<string, string>
                {
                    // Мафия убивает бессмертного
                    { mafiaId, JsonSerializer.Serialize(new { action = "kill", targetId = immortalId }) }
                },
                PendingDeaths = new List<string>()
            },
            GameSettings = new GameSettings()
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        await service.ForceAdvancePhaseAsync(room.Id);

        // Assert
        var immortal = room.Users.First(u => u.Id == immortalId);
        Assert.True(immortal.IsAlive, "Immortal should survive night attack");
        
        Game.Rooms.Clear();
    }

    [Fact]
    public async Task NightResults_DoctorHealsTarget_ShouldSurvive()
    {
        var service = CreateService(out _);
        var mafiaId = "mafia1";
        var doctorId = "doctor1";
        var citizenId = "citizen1";
        
        var room = new RoomDTO
        {
            Id = Guid.NewGuid().ToString(),
            Users = new List<UserDTO>
            {
                new() { Id = mafiaId, Name = "Mafia", IsAlive = true, Status = UserStatus.Player },
                new() { Id = doctorId, Name = "Doctor", IsAlive = true, Status = UserStatus.Player },
                new() { Id = citizenId, Name = "Citizen", IsAlive = true, Status = UserStatus.Player }
            },
            PlayerRoles = new Dictionary<string, Role>
            {
                { mafiaId, Role.Mafia },
                { doctorId, Role.Doctor },
                { citizenId, Role.Citizen }
            },
            CurrentGameState = new GameState
            {
                Phase = GamePhase.Night,
                CurrentNightPhase = NightPhase.Prostitute, // Последняя фаза для триггера итогов
                NightActions = new Dictionary<string, string>
                {
                    // Мафия убивает гражданина
                    { mafiaId, JsonSerializer.Serialize(new { action = "kill", targetId = citizenId }) },
                    // Доктор лечит гражданина
                    { doctorId, JsonSerializer.Serialize(new { action = "heal", targetId = citizenId }) }
                },
                PendingDeaths = new List<string>()
            },
            GameSettings = new GameSettings()
        };
        Game.Rooms.Clear();
        Game.Rooms.Add(room);

        // Act
        await service.ForceAdvancePhaseAsync(room.Id);

        // Assert
        var citizen = room.Users.First(u => u.Id == citizenId);
        Assert.True(citizen.IsAlive, "Citizen should survive because Doctor healed them");
        
        Game.Rooms.Clear();
    }
}

public class GameSettingsTests
{
    [Fact]
    public void GameSettings_DefaultValues_ShouldBeReasonable()
    {
        var settings = new GameSettings();
        Assert.True(settings.IndividualSpeechTime > 0);
        Assert.True(settings.VotingTime > 0);
    }
}

public class GameStateModelTests
{
    [Fact]
    public void GameState_Initialize_ShouldHaveDefaultValues()
    {
        var state = new GameState();
        Assert.NotNull(state.Votes);
        Assert.NotNull(state.NightActions);
        Assert.NotNull(state.HasSpoken);
    }

    [Fact]
    public void GameState_ManiacSelfHeals_ShouldStartWithOne()
    {
        var state = new GameState();
        Assert.Equal(1, state.ManiacSelfHealsLeft);
    }
}
