using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Mafia.Services;

/// <summary>
/// Сервис для управления видеозвонками через LiveKit Admin API
/// </summary>
public class VideoCallService : IVideoCallService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<VideoCallService> _logger;

    public VideoCallService(HttpClient httpClient, ILogger<VideoCallService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Создать видеокомнату
    /// </summary>
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
                _logger.LogWarning($"Failed to create video room {roomName}: {response.StatusCode} - {error}");
                _logger.LogWarning("Game will continue without video functionality");
            }
            else
            {
                _logger.LogInformation($"Room {roomName} created in video service.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, $"Failed to create video room {roomName}. Game will continue without video functionality.");
        }
    }

    /// <summary>
    /// Управление аудио конкретного пользователя
    /// </summary>
    public async Task MuteUserAudioAsync(string roomName, string participantIdentity, bool muted)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/control-participant-audio",
                new
                {
                    room_name = roomName,
                    participant_identity = participantIdentity,
                    muted = muted
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to {(muted ? "mute" : "unmute")} audio for {participantIdentity} in room {roomName}: {response.StatusCode} - {error}");
            }
            else
            {
                _logger.LogDebug($"Audio {(muted ? "muted" : "unmuted")} for {participantIdentity} in room {roomName}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling audio for {participantIdentity} in {roomName}");
        }
    }

    /// <summary>
    /// Управление видео конкретного пользователя
    /// </summary>
    public async Task MuteUserVideoAsync(string roomName, string participantIdentity, bool muted)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/control-participant-video",
                new
                {
                    room_name = roomName,
                    participant_identity = participantIdentity,
                    muted = muted
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to {(muted ? "mute" : "unmute")} video for {participantIdentity} in room {roomName}: {response.StatusCode} - {error}");
            }
            else
            {
                _logger.LogDebug($"Video {(muted ? "muted" : "unmuted")} for {participantIdentity} in room {roomName}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling video for {participantIdentity} in {roomName}");
        }
    }

    /// <summary>
    /// Выключить микрофоны всем, кроме указанного пользователя
    /// </summary>
    public async Task MuteAllAudioAsync(string roomName, string? exceptUser = null)
    {
        try
        {
            // Сначала выключаем всем
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/mute-all-audio",
                new
                {
                    room_name = roomName,
                    muted = true
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to mute all audio in room {roomName}: {response.StatusCode} - {error}");
            }

            // Если указан пользователь-исключение, включаем ему микрофон
            if (!string.IsNullOrEmpty(exceptUser))
            {
                await MuteUserAudioAsync(roomName, exceptUser, false);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error muting all audio in {roomName}");
        }
    }

    /// <summary>
    /// Включить микрофоны всем
    /// </summary>
    public async Task UnmuteAllAudioAsync(string roomName)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/mute-all-audio",
                new
                {
                    room_name = roomName,
                    muted = false
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to unmute all audio in room {roomName}: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error unmuting all audio in {roomName}");
        }
    }

    /// <summary>
    /// Выключить камеры всем
    /// </summary>
    public async Task MuteAllVideoAsync(string roomName)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/mute-all-video",
                new
                {
                    room_name = roomName,
                    muted = true
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to mute all video in room {roomName}: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error muting all video in {roomName}");
        }
    }

    /// <summary>
    /// Включить камеры всем
    /// </summary>
    public async Task UnmuteAllVideoAsync(string roomName)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"api/admin/rooms/{roomName}/mute-all-video",
                new
                {
                    room_name = roomName,
                    muted = false
                });

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to unmute all video in room {roomName}: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error unmuting all video in {roomName}");
        }
    }

    /// <summary>
    /// Получить список участников комнаты
    /// </summary>
    public async Task<List<ParticipantInfo>> GetParticipantsAsync(string roomName)
    {
        try
        {
            var response = await _httpClient.GetAsync($"api/admin/rooms/{roomName}/participants");
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning($"Failed to get participants for room {roomName}: {response.StatusCode}");
                return new List<ParticipantInfo>();
            }

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var participants = new List<ParticipantInfo>();

            if (doc.RootElement.TryGetProperty("participants", out var parts))
            {
                foreach (var p in parts.EnumerateArray())
                {
                    var identity = p.TryGetProperty("identity", out var idProp) ? idProp.GetString() : null;
                    var name = p.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : identity;

                    if (!string.IsNullOrEmpty(identity))
                    {
                        participants.Add(new ParticipantInfo
                        {
                            Identity = identity!,
                            Name = name ?? identity!
                        });
                    }
                }
            }

            return participants;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get participants for {roomName}");
            return new List<ParticipantInfo>();
        }
    }
}

/// <summary>
/// Информация об участнике видеозвонка
/// </summary>
public class ParticipantInfo
{
    public string Identity { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
