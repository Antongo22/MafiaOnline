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

    [Fact]
    public async Task StartGame_WithValidAdmin_ShouldChangeStatusToWaiting()
    {
        // Arrange - создаём комнату
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var room = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var adminId = room!.Users[0].Id;

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
        // Arrange - создаём комнату и добавляем второго игрока
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var room = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        
        var joinResponse = await _client.PostAsync(
            $"/api/Room/invite?inviteCode={room!.InviteCode}&playerName=Player2", 
            null);
        var updatedRoom = await joinResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var playerId = updatedRoom!.Users[1].Id;

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
        // Arrange - создаём комнату и запускаем игру
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var room = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var adminId = room!.Users[0].Id;

        await _client.PostAsync($"/api/Game/start?roomId={room.Id}&adminId={adminId}", null);

        // Подготавливаем роли
        var roles = new Dictionary<Role, int>
        {
            { Role.Citizen, 1 }
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
        // Arrange - создаём комнату, запускаем и выбираем роли
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var room = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var adminId = room!.Users[0].Id;

        await _client.PostAsync($"/api/Game/start?roomId={room.Id}&adminId={adminId}", null);

        var roles = new Dictionary<Role, int> { { Role.Citizen, 1 } };
        var content = new StringContent(
            JsonSerializer.Serialize(roles), 
            Encoding.UTF8, 
            "application/json");
        await _client.PostAsync(
            $"/api/Game/select-roles?roomId={room.Id}&adminId={adminId}", 
            content);

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
