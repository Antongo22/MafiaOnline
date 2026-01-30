using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mafia.DTOs;
using Mafia.Enums;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Mafia.IntegrationTests;

[Collection("IntegrationTests")]
public class GameControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions;

    public GameControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
    }

    /// <summary>
    /// Вспомогательный метод: создаёт комнату и добавляет нужное количество игроков
    /// </summary>
    private async Task<(RoomDTO room, string adminId)> CreateRoomWithPlayers(int playerCount = 3)
    {
        // Уникальный суффикс для избежания конфликтов имён
        var suffix = Guid.NewGuid().ToString()[..6];
        
        // Создаём комнату с админом
        var createResponse = await _client.PostAsync(
            $"/api/Room/create?roomName=TestRoom_{suffix}&playerName=Admin_{suffix}", 
            null);
        
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        
        var room = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        ArgumentNullException.ThrowIfNull(room);
        var adminId = room.Users[0].Id;

        // Добавляем остальных игроков
        for (int i = 2; i <= playerCount; i++)
        {
            var joinResponse = await _client.PostAsync(
                $"/api/Room/invite?inviteCode={room.InviteCode}&playerName=Player{i}_{suffix}", 
                null);
            
            Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);
            
            room = await joinResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
            ArgumentNullException.ThrowIfNull(room);
        }

        return (room, adminId);
    }

    [Fact]
    public async Task StartGame_WithValidAdmin_ShouldChangeStatusToWaiting()
    {
        // Arrange - создаём комнату с 3 игроками (минимум)
        var (room, adminId) = await CreateRoomWithPlayers(3);

        // Act - запускаем игру
        var startResponse = await _client.PostAsync(
            $"/api/Game/start?roomId={room.Id}&adminId={adminId}", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);
        
        // Проверяем статус комнаты
        var getRoomResponse = await _client.GetAsync($"/api/Room/my?userId={adminId}");
        var updatedRoom = await getRoomResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        Assert.Equal(GameStatus.Waiting, updatedRoom!.Status);
    }

    [Fact]
    public async Task StartGame_WithNonAdmin_ShouldReturnUnauthorized()
    {
        // Arrange - создаём комнату с 3 игроками
        var (room, _) = await CreateRoomWithPlayers(3);
        var playerId = room.Users[1].Id; // Не админ

        // Act - обычный игрок пытается запустить игру
        var startResponse = await _client.PostAsync(
            $"/api/Game/start?roomId={room.Id}&adminId={playerId}", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, startResponse.StatusCode);
    }

    [Fact]
    public async Task SelectRoles_WithValidData_ShouldSaveRoleSettings()
    {
        // Arrange - создаём комнату с 3 игроками и запускаем игру
        var (room, adminId) = await CreateRoomWithPlayers(3);
        await _client.PostAsync($"/api/Game/start?roomId={room.Id}&adminId={adminId}", null);

        // Подготавливаем роли (3 роли для 3 игроков)
        var roles = new Dictionary<Role, int>
        {
            { Role.Citizen, 2 },
            { Role.Mafia, 1 }
        };
        var content = new StringContent(
            JsonSerializer.Serialize(roles), 
            Encoding.UTF8, 
            "application/json");

        // Act - выбираем роли
        var selectResponse = await _client.PostAsync(
            $"/api/Game/select-roles?roomId={room.Id}&adminId={adminId}", 
            content);

        // Assert
        Assert.Equal(HttpStatusCode.OK, selectResponse.StatusCode);
    }

    [Fact]
    public async Task DistributeRoles_WithValidData_ShouldStartGame()
    {
        // Arrange - создаём комнату с 3 игроками, запускаем и выбираем роли
        var (room, adminId) = await CreateRoomWithPlayers(3);
        
        var startResponse = await _client.PostAsync(
            $"/api/Game/start?roomId={room.Id}&adminId={adminId}", null);
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var roles = new Dictionary<Role, int> 
        { 
            { Role.Citizen, 2 },
            { Role.Mafia, 1 }
        };
        var content = new StringContent(
            JsonSerializer.Serialize(roles), 
            Encoding.UTF8, 
            "application/json");
        
        var selectResponse = await _client.PostAsync(
            $"/api/Game/select-roles?roomId={room.Id}&adminId={adminId}", 
            content);
        Assert.Equal(HttpStatusCode.OK, selectResponse.StatusCode);

        // Act - распределяем роли
        var distributeResponse = await _client.PostAsync(
            $"/api/Game/distribute-roles?roomId={room.Id}&adminId={adminId}", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, distributeResponse.StatusCode);
        
        // Проверяем, что игра началась
        var getRoomResponse = await _client.GetAsync($"/api/Room/my?userId={adminId}");
        var updatedRoom = await getRoomResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        Assert.Equal(GameStatus.InProgress, updatedRoom!.Status);
    }
}
