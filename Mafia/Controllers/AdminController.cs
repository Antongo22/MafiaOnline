using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.Enums;
using Mafia.Helpers;

namespace Mafia.Controllers;

/// <summary>
/// Административные API для управления видеозвонками в игре
/// Требует MASTER_ADMIN_KEY для авторизации
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly VideoCallService _videoCallService;
    private readonly ILogger<AdminController> _logger;
    private readonly string _masterAdminKey;

    public AdminController(
        VideoCallService videoCallService,
        ILogger<AdminController> logger,
        IConfiguration configuration)
    {
        _videoCallService = videoCallService;
        _logger = logger;
        _masterAdminKey = configuration["MASTER_ADMIN_KEY"] ?? "dev_key_12345";
    }

    /// <summary>
    /// Проверка ключа администратора
    /// </summary>
    private bool ValidateAdminKey()
    {
        if (!Request.Headers.TryGetValue("X-API-Key", out var apiKey))
            return false;

        return apiKey == _masterAdminKey;
    }

    /// <summary>
    /// Выключить микрофоны всем игрокам в комнате
    /// </summary>
    [HttpPost("rooms/{roomId}/mute-all-audio")]
    public async Task<ActionResult> MuteAllAudio(string roomId, [FromBody] MuteAllRequest request)
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));

        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        try
        {
            if (request.Muted)
            {
                await _videoCallService.MuteAllAudioAsync(roomId);
                _logger.LogInformation($"Admin muted all audio in room {roomId}");
            }
            else
            {
                await _videoCallService.UnmuteAllAudioAsync(roomId);
                _logger.LogInformation($"Admin unmuted all audio in room {roomId}");
            }

            return Ok(new { message = $"All audio {(request.Muted ? "muted" : "unmuted")}", room = roomId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling audio in room {roomId}");
            return StatusCode(500, new { error = "Failed to control audio" });
        }
    }

    /// <summary>
    /// Выключить камеры всем игрокам в комнате
    /// </summary>
    [HttpPost("rooms/{roomId}/mute-all-video")]
    public async Task<ActionResult> MuteAllVideo(string roomId, [FromBody] MuteAllRequest request)
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));

        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        try
        {
            if (request.Muted)
            {
                await _videoCallService.MuteAllVideoAsync(roomId);
                _logger.LogInformation($"Admin muted all video in room {roomId}");
            }
            else
            {
                await _videoCallService.UnmuteAllVideoAsync(roomId);
                _logger.LogInformation($"Admin unmuted all video in room {roomId}");
            }

            return Ok(new { message = $"All video {(request.Muted ? "muted" : "unmuted")}", room = roomId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling video in room {roomId}");
            return StatusCode(500, new { error = "Failed to control video" });
        }
    }

    /// <summary>
    /// Управление микрофоном конкретного игрока
    /// </summary>
    [HttpPost("rooms/{roomId}/control-participant-audio")]
    public async Task<ActionResult> ControlParticipantAudio(string roomId, [FromBody] ControlParticipantRequest request)
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));
        ValidationHelper.ValidateNotEmpty(request.ParticipantIdentity, nameof(request.ParticipantIdentity));

        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        try
        {
            await _videoCallService.MuteUserAudioAsync(roomId, request.ParticipantIdentity, request.Muted);
            _logger.LogInformation($"Admin {(request.Muted ? "muted" : "unmuted")} audio for {request.ParticipantIdentity} in room {roomId}");

            return Ok(new
            {
                message = $"Audio {(request.Muted ? "muted" : "unmuted")}",
                participant = request.ParticipantIdentity,
                room = roomId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling audio for {request.ParticipantIdentity} in room {roomId}");
            return StatusCode(500, new { error = "Failed to control participant audio" });
        }
    }

    /// <summary>
    /// Управление камерой конкретного игрока
    /// </summary>
    [HttpPost("rooms/{roomId}/control-participant-video")]
    public async Task<ActionResult> ControlParticipantVideo(string roomId, [FromBody] ControlParticipantRequest request)
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));
        ValidationHelper.ValidateNotEmpty(request.ParticipantIdentity, nameof(request.ParticipantIdentity));

        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        try
        {
            await _videoCallService.MuteUserVideoAsync(roomId, request.ParticipantIdentity, request.Muted);
            _logger.LogInformation($"Admin {(request.Muted ? "muted" : "unmuted")} video for {request.ParticipantIdentity} in room {roomId}");

            return Ok(new
            {
                message = $"Video {(request.Muted ? "muted" : "unmuted")}",
                participant = request.ParticipantIdentity,
                room = roomId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error controlling video for {request.ParticipantIdentity} in room {roomId}");
            return StatusCode(500, new { error = "Failed to control participant video" });
        }
    }

    /// <summary>
    /// Получить список всех активных комнат
    /// </summary>
    [HttpGet("rooms")]
    public ActionResult GetAllRooms()
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        var rooms = Game.Rooms.Select(r => new
        {
            id = r.Id,
            name = r.Name,
            inviteCode = r.InviteCode,
            status = r.Status.ToString(),
            playerCount = r.Users.Count(u => u.Status != UserStatus.Leave),
            alivePlayers = r.Users.Count(u => u.Status != UserStatus.Leave && u.IsAlive),
            phase = r.CurrentGameState?.Phase.ToString(),
            dayNumber = r.CurrentGameState?.DayNumber
        }).ToList();

        return Ok(new { total_rooms = rooms.Count, rooms });
    }

    /// <summary>
    /// Получить участников комнаты
    /// </summary>
    [HttpGet("rooms/{roomId}/participants")]
    public ActionResult GetRoomParticipants(string roomId)
    {
        if (!ValidateAdminKey())
            return Unauthorized("Invalid admin key");

        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var participants = room.Users
            .Where(u => u.Status != UserStatus.Leave)
            .Select(u => new
            {
                userId = u.Id,
                name = u.Name,
                status = u.Status.ToString(),
                isAlive = u.IsAlive,
                role = room.PlayerRoles?.ContainsKey(u.Id) == true
                    ? room.PlayerRoles[u.Id].ToString()
                    : null
            })
            .ToList();

        return Ok(new
        {
            room = room.Name,
            roomId = room.Id,
            num_participants = participants.Count,
            participants
        });
    }
}

/// <summary>
/// Запрос на управление медиа всех участников
/// </summary>
public class MuteAllRequest
{
    public bool Muted { get; set; }
}

/// <summary>
/// Запрос на управление медиа конкретного участника
/// </summary>
public class ControlParticipantRequest
{
    public string ParticipantIdentity { get; set; } = string.Empty;
    public bool Muted { get; set; }
}
