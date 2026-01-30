using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mafia.DTOs;
using Mafia.Enums;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Mafia.IntegrationTests;

[Collection("IntegrationTests")]
public class RoomControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions;

    public RoomControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };
    }

    [Fact]
    public async Task CreateRoom_WithValidData_ShouldReturnOk()
    {
        // Act
        var response = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=TestPlayer", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        
        var room = await response.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        Assert.NotNull(room);
        Assert.Equal("TestRoom", room.Name);
        Assert.Single(room.Users);
        Assert.Equal("TestPlayer", room.Users[0].Name);
        Assert.Equal(UserStatus.Admin, room.Users[0].Status);
    }

    [Fact]
    public async Task CreateRoom_WithEmptyRoomName_ShouldReturnBadRequest()
    {
        // Act
        var response = await _client.PostAsync(
            "/api/Room/create?roomName=&playerName=TestPlayer", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinRoom_WithValidInviteCode_ShouldReturnOk()
    {
        // Arrange - создаём комнату
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var createdRoom = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        
        // Act - присоединяемся к комнате
        var joinResponse = await _client.PostAsync(
            $"/api/Room/invite?inviteCode={createdRoom!.InviteCode}&playerName=Player2", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);
        
        var joinedRoom = await joinResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        Assert.NotNull(joinedRoom);
        Assert.Equal(2, joinedRoom.Users.Count);
    }

    [Fact]
    public async Task JoinRoom_WithInvalidInviteCode_ShouldReturnNotFound()
    {
        // Act
        var response = await _client.PostAsync(
            "/api/Room/invite?inviteCode=INVALID&playerName=Player", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRoom_WithValidUserId_ShouldReturnRoom()
    {
        // Arrange - создаём комнату
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=TestPlayer", 
            null);
        var createdRoom = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var userId = createdRoom!.Users[0].Id;

        // Act
        var response = await _client.GetAsync($"/api/Room/my?userId={userId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        
        var room = await response.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        Assert.NotNull(room);
        Assert.Equal(createdRoom.Id, room.Id);
    }

    [Fact]
    public async Task LeaveRoom_AsAdmin_ShouldDisbandRoom()
    {
        // Arrange - создаём комнату
        var createResponse = await _client.PostAsync(
            "/api/Room/create?roomName=TestRoom&playerName=Admin", 
            null);
        var createdRoom = await createResponse.Content.ReadFromJsonAsync<RoomDTO>(_jsonOptions);
        var adminId = createdRoom!.Users[0].Id;

        // Act - админ покидает комнату
        var leaveResponse = await _client.PostAsync(
            $"/api/Room/leave?userId={adminId}", 
            null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, leaveResponse.StatusCode);
        
        // Проверяем, что комната расформирована
        var getRoomResponse = await _client.GetAsync($"/api/Room/my?userId={adminId}");
        Assert.Equal(HttpStatusCode.NotFound, getRoomResponse.StatusCode);
    }
}
