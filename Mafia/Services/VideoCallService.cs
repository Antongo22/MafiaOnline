using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Mafia.Services;

public class VideoCallService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<VideoCallService> _logger;

    public VideoCallService(HttpClient httpClient, ILogger<VideoCallService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task CreateRoomAsync(string roomName, string creatorName)
    {
        try 
        {
            var response = await _httpClient.PostAsJsonAsync("api/rooms", new 
            {
                name = roomName,
                empty_timeout = 300,
                max_participants = 20,
                creator_name = creatorName
            });
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                var msg = $"Filed to create video room {roomName}: {response.StatusCode} - {error}";
                _logger.LogError(msg);
                throw new HttpRequestException(msg);
            }
            else
            {
                _logger.LogInformation($"Room {roomName} created in video service.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to create room {roomName}");
            throw;
        }
    }

    public async Task MuteUserAudioAsync(string roomName, string userName, bool muted)
    {
        var endpoint = muted ? "mute-audio" : "unmute-audio";
        await SendParticipantCommandAsync(roomName, endpoint, new { participant_identity = userName, muted = muted });
    }

    public async Task MuteUserVideoAsync(string roomName, string userName, bool muted)
    {
        var endpoint = muted ? "mute-video" : "unmute-video";
        await SendParticipantCommandAsync(roomName, endpoint, new { participant_identity = userName, muted = muted });
    }
    
    public async Task MuteAllAudioAsync(string roomName, string? exceptUser = null)
    {
        var participants = await GetParticipantsAsync(roomName);
        var tasks = participants
            .Where(p => p != exceptUser)
            .Select(p => MuteUserAudioAsync(roomName, p, true));
        
        await Task.WhenAll(tasks);
    }

    public async Task UnmuteAllAudioAsync(string roomName)
    {
        var participants = await GetParticipantsAsync(roomName);
        var tasks = participants.Select(p => MuteUserAudioAsync(roomName, p, false));
        await Task.WhenAll(tasks);
    }
    
    public async Task MuteAllVideoAsync(string roomName)
    {
        var participants = await GetParticipantsAsync(roomName);
        var tasks = participants.Select(p => MuteUserVideoAsync(roomName, p, true));
        await Task.WhenAll(tasks);
    }

    public async Task UnmuteAllVideoAsync(string roomName)
    {
       var participants = await GetParticipantsAsync(roomName);
       var tasks = participants.Select(p => MuteUserVideoAsync(roomName, p, false));
       await Task.WhenAll(tasks);
    }

    private async Task<List<string>> GetParticipantsAsync(string roomName)
    {
        try 
        {
            var response = await _httpClient.GetAsync($"api/participants/{roomName}");
            if (!response.IsSuccessStatusCode) 
            {
                _logger.LogWarning($"Failed to get participants: {response.StatusCode}");
                return new List<string>();
            }
            
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var participants = new List<string>();
            if (doc.RootElement.TryGetProperty("participants", out var parts))
            {
                foreach(var p in parts.EnumerateArray())
                {
                    if (p.TryGetProperty("identity", out var id))
                    {
                         var idStr = id.GetString();
                         if (!string.IsNullOrEmpty(idStr))
                            participants.Add(idStr);
                    }
                }
            }
            return participants;
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, $"Failed to get participants for {roomName}");
             return new List<string>();
        }
    }

    private async Task SendParticipantCommandAsync(string roomName, string action, object payload)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync($"api/participants/{roomName}/{action}", payload);
             if (!response.IsSuccessStatusCode)
             {
                 var err = await response.Content.ReadAsStringAsync();
                 _logger.LogWarning($"Failed to {action} for room {roomName}: {response.StatusCode} - {err}");
             }
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, $"Error executing {action} for {roomName}");
        }
    }
}
