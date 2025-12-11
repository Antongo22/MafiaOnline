using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Models;
using Mafia.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameCycleController : ControllerBase
{
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<GameCycleController> _logger;

    public GameCycleController(IHubContext<ChatHub> hubContext, ILogger<GameCycleController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Получить текущее состояние игры
    /// </summary>
    [HttpGet("state")]
    public ActionResult GetGameState(string roomId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        if (room.CurrentGameState == null)
            return Ok(new { 
                isActive = false,
                phase = "Lobby",
                gameStatus = room.Status.ToString()
            });

        var gameState = room.CurrentGameState;
        var elapsed = (DateTime.UtcNow - gameState.PhaseStartTime).TotalSeconds;
        var timeLeft = Math.Max(0, gameState.PhaseTimeSeconds - (int)elapsed);

        string? currentSpeakerName = null;
        string? currentSpeakerId = null;
        if (gameState.Phase == GamePhase.IndividualSpeech && gameState.CurrentSpeakerId != null)
        {
            var speaker = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentSpeakerId);
            currentSpeakerName = speaker?.Name;
            currentSpeakerId = speaker?.Id;
        }

        string? currentVoterName = null;
        string? currentVoterId = null;
        if (gameState.Phase == GamePhase.Voting && gameState.VoterOrder != null && gameState.VoterOrder.Any())
        {
            var voterId = gameState.VoterOrder[gameState.CurrentVoterIndex];
            var voter = room.Users.FirstOrDefault(u => u.Id == voterId);
            currentVoterName = voter?.Name;
            currentVoterId = voter?.Id;
        }

        return Ok(new {
            isActive = true,
            phase = gameState.Phase.ToString(),
            nightPhase = gameState.CurrentNightPhase?.ToString(),
            dayNumber = gameState.DayNumber,
            timeLeft = timeLeft,
            currentSpeakerName = currentSpeakerName,
            currentSpeakerId = currentSpeakerId,
            currentVoterName = currentVoterName,
            currentVoterId = currentVoterId,
            isPaused = gameState.IsPaused,
            gameStatus = room.Status.ToString()
        });
    }

    /// <summary>
    /// Поставить игру на паузу (только админ)
    /// </summary>
    [HttpPost("pause")]
    public async Task<ActionResult> PauseGame(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can pause the game");

        if (room.CurrentGameState == null)
            return BadRequest("Game is not started");

        if (room.CurrentGameState.IsPaused)
            return BadRequest("Game is already paused");

        // Сохраняем оставшееся время
        var elapsed = (DateTime.UtcNow - room.CurrentGameState.PhaseStartTime).TotalSeconds;
        room.CurrentGameState.RemainingTimeBeforePause = Math.Max(0, room.CurrentGameState.PhaseTimeSeconds - (int)elapsed);
        room.CurrentGameState.IsPaused = true;
        room.CurrentGameState.PauseStartTime = DateTime.UtcNow;

        await _hubContext.Clients.Group(roomId).SendAsync("GamePaused", new
        {
            pausedBy = admin.Name,
            remainingTime = room.CurrentGameState.RemainingTimeBeforePause
        });

        return Ok(new { message = "Game paused" });
    }

    /// <summary>
    /// Продолжить игру после паузы (только админ)
    /// </summary>
    [HttpPost("resume")]
    public async Task<ActionResult> ResumeGame(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can resume the game");

        if (room.CurrentGameState == null)
            return BadRequest("Game is not started");

        if (!room.CurrentGameState.IsPaused)
            return BadRequest("Game is not paused");

        // Восстанавливаем время
        room.CurrentGameState.PhaseStartTime = DateTime.UtcNow;
        room.CurrentGameState.PhaseTimeSeconds = room.CurrentGameState.RemainingTimeBeforePause;
        room.CurrentGameState.IsPaused = false;
        room.CurrentGameState.PauseStartTime = null;

        await _hubContext.Clients.Group(roomId).SendAsync("GameResumed", new
        {
            resumedBy = admin.Name,
            remainingTime = room.CurrentGameState.RemainingTimeBeforePause
        });

        return Ok(new { message = "Game resumed" });
    }

    /// <summary>
    /// Начать игровой цикл (только админ)
    /// </summary>
    [HttpPost("start")]
    public async Task<ActionResult> StartGameCycle(string roomId, string adminId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var admin = room.Users.FirstOrDefault(u => u.Id == adminId);
        if (admin == null || admin.Status != UserStatus.Admin)
            return Unauthorized("Only admin can start the game");

        if (room.Status != GameStatus.InProgress)
            return BadRequest("Game must be in InProgress status");

        if (room.PlayerRoles == null || !room.PlayerRoles.Any())
            return BadRequest("Roles must be distributed first");

        // Инициализируем игровое состояние
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && room.PlayerRoles.ContainsKey(u.Id))
            .Select(u => u.Id)
            .OrderBy(_ => Guid.NewGuid())
            .ToList();

        room.CurrentGameState = new GameState
        {
            Phase = GamePhase.IndividualSpeech,
            IsFirstCycle = true,
            DayNumber = 1,
            PhaseStartTime = DateTime.UtcNow,
            PhaseTimeSeconds = 30,
            SpeakerOrder = alivePlayers,
            CurrentSpeakerIndex = 0,
            CurrentSpeakerId = alivePlayers.FirstOrDefault(),
            SheriffId = room.PlayerRoles.FirstOrDefault(p => p.Value == Role.Sheriff).Key
        };

        await _hubContext.Clients.Group(roomId).SendAsync("GameCycleStarted", new
        {
            phase = "IndividualSpeech",
            speakerId = room.CurrentGameState.CurrentSpeakerId,
            speakerName = room.Users.FirstOrDefault(u => u.Id == room.CurrentGameState.CurrentSpeakerId)?.Name,
            timeSeconds = 30
        });

        return Ok(new { message = "Game cycle started" });
    }

    /// <summary>
    /// Проголосовать за игрока во время фазы голосования
    /// </summary>
    [HttpPost("vote")]
    public async Task<ActionResult> Vote(string roomId, string voterId, string targetId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var gameState = room.CurrentGameState;
        if (gameState == null || gameState.Phase != GamePhase.Voting)
            return BadRequest("Not in voting phase");

        if (gameState.CurrentVoterId != voterId)
            return BadRequest("Not your turn to vote");

        var voter = room.Users.FirstOrDefault(u => u.Id == voterId);
        if (voter == null || !voter.IsAlive || voter.Status == UserStatus.Leave)
            return BadRequest("You cannot vote");

        // Проверяем, что цель голосования жива
        var target = room.Users.FirstOrDefault(u => u.Id == targetId);
        if (target == null || !target.IsAlive || target.Status == UserStatus.Leave)
            return BadRequest("Cannot vote for dead or absent player");

        // Записываем голос
        gameState.Votes[voterId] = targetId;

        await _hubContext.Clients.Group(roomId).SendAsync("VoteReceived", new
        {
            voterId,
            // Не показываем за кого проголосовал
        });

        // Переходим к следующему голосующему
        gameState.CurrentVoterIndex++;
        if (gameState.CurrentVoterIndex < gameState.VoterOrder.Count)
        {
            gameState.CurrentVoterId = gameState.VoterOrder[gameState.CurrentVoterIndex];
            gameState.PhaseStartTime = DateTime.UtcNow;

            // Формируем список кандидатов (живые игроки)
            var alivePlayers = room.Users
                .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
                .Select(u => u.Id)
                .ToList();
            
            var candidates = alivePlayers.Select(id => new
            {
                userId = id,
                userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name
            }).ToList();

            await _hubContext.Clients.Group(roomId).SendAsync("VoterChanged", new
            {
                voterId = gameState.CurrentVoterId,
                voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
                candidates = candidates, // Список живых игроков для голосования
                timeSeconds = 15
            });
        }
        else
        {
            // Все проголосовали - завершаем фазу немедленно
            _logger.LogInformation($"Room {roomId}: All players voted, ending voting phase immediately");
            gameState.CurrentVoterId = null; // Сбрасываем текущего голосующего
            gameState.PhaseStartTime = DateTime.UtcNow.AddSeconds(-gameState.PhaseTimeSeconds);
            
            // Отправляем событие что голосование завершено
            await _hubContext.Clients.Group(roomId).SendAsync("AllVotesCompleted", new
            {
                message = "Все проголосовали, подсчитываем голоса..."
            });
        }

        return Ok(new { message = "Vote recorded" });
    }

    /// <summary>
    /// Выполнить ночное действие (убийство, проверка, лечение и т.д.)
    /// </summary>
    [HttpPost("night-action")]
    public async Task<ActionResult> NightAction(string roomId, string userId, [FromBody] NightActionDTO action)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var gameState = room.CurrentGameState;
        if (gameState == null || gameState.Phase != GamePhase.Night)
            return BadRequest("Not in night phase");

        var user = room.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null || !user.IsAlive || user.Status == UserStatus.Leave)
            return BadRequest("You cannot act");

        if (!room.PlayerRoles!.ContainsKey(userId))
            return BadRequest("You don't have a role");

        var userRole = room.PlayerRoles[userId];
        var currentNightPhase = gameState.CurrentNightPhase;

        // Проверяем, что игрок действует в свою фазу
        bool canAct = currentNightPhase switch
        {
            NightPhase.Don => userRole == Role.Don,
            NightPhase.Mafia => RoleInfo.GetTeam(userRole) == Team.Evil,
            NightPhase.Maniac => userRole == Role.Maniac,
            NightPhase.Sheriff => userRole == Role.Sheriff,
            NightPhase.Doctor => userRole == Role.Doctor,
            NightPhase.Prostitute => userRole == Role.Prostitute,
            _ => false
        };

        if (!canAct)
            return BadRequest("Not your turn");

        // Проверяем, что цель действия жива (если указана)
        if (!string.IsNullOrEmpty(action.TargetId))
        {
            var target = room.Users.FirstOrDefault(u => u.Id == action.TargetId);
            if (target == null || !target.IsAlive || target.Status == UserStatus.Leave)
                return BadRequest("Cannot target dead or absent player");
        }

        // Сохраняем текущую фазу перед обработкой действия
        var phaseBeforeAction = gameState.CurrentNightPhase;

        // Обрабатываем действие
        await ProcessNightAction(room, userId, userRole, action);
        
        // Завершаем таймер немедленно - переходим к следующей ночной фазе
        // Но только если фаза не изменилась (чтобы не сбросить таймер новой фазы)
        if (gameState.CurrentNightPhase == phaseBeforeAction)
        {
            _logger.LogInformation($"Room {roomId}: Player {userId} completed night action, ending phase immediately");
            gameState.PhaseStartTime = DateTime.UtcNow.AddSeconds(-gameState.PhaseTimeSeconds);
        }

        return Ok(new { message = "Action recorded" });
    }

    private async Task ProcessNightAction(RoomDTO room, string userId, Role role, NightActionDTO action)
    {
        var gameState = room.CurrentGameState!;

        switch (gameState.CurrentNightPhase)
        {
            case NightPhase.Don:
                // Дон проверяет игрока на шерифа
                if (!string.IsNullOrEmpty(action.TargetId))
                {
                    if (action.TargetId == gameState.SheriffId)
                    {
                        gameState.DonHasFoundSheriff = true;
                        
                        // Открываем карту шерифа для дона
                        if (!gameState.RevealedCards.ContainsKey(userId))
                            gameState.RevealedCards[userId] = new List<string>();
                        if (!gameState.RevealedCards[userId].Contains(gameState.SheriffId))
                            gameState.RevealedCards[userId].Add(gameState.SheriffId);

                        // Отправляем через группу комнаты с указанием targetUserId для фильтрации на фронтенде
                        await _hubContext.Clients.Group(room.Id).SendAsync("CardRevealed", new
                        {
                            targetUserId = userId, // Кому показывать
                            targetId = gameState.SheriffId,
                            role = Role.Sheriff.ToString(),
                            reason = "Don found Sheriff"
                        });
                    }
                }
                break;

            case NightPhase.Mafia:
                // Мафия голосует за убийство
                if (!string.IsNullOrEmpty(action.TargetId))
                {
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "kill", targetId = action.TargetId });
                }
                break;

            case NightPhase.Maniac:
                // Маньяк убивает или лечит себя
                if (action.ActionType == "heal_self" && gameState.ManiacSelfHealsLeft > 0)
                {
                    gameState.ManiacSelfHealsLeft--;
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "heal_self" });
                }
                else if (!string.IsNullOrEmpty(action.TargetId))
                {
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "kill", targetId = action.TargetId });
                }
                break;

            case NightPhase.Sheriff:
                // Шериф проверяет игрока
                if (!string.IsNullOrEmpty(action.TargetId))
                {
                    var targetRole = room.PlayerRoles![action.TargetId];
                    if (RoleInfo.GetTeam(targetRole) == Team.Evil)
                    {
                        // Открываем карту мафии для шерифа
                        if (!gameState.RevealedCards.ContainsKey(userId))
                            gameState.RevealedCards[userId] = new List<string>();
                        if (!gameState.RevealedCards[userId].Contains(action.TargetId))
                            gameState.RevealedCards[userId].Add(action.TargetId);

                        // Отправляем через группу комнаты с указанием targetUserId для фильтрации на фронтенде
                        await _hubContext.Clients.Group(room.Id).SendAsync("CardRevealed", new
                        {
                            targetUserId = userId, // Кому показывать
                            targetId = action.TargetId,
                            role = targetRole.ToString(),
                            reason = "Sheriff checked"
                        });
                    }
                }
                break;

            case NightPhase.Doctor:
                // Доктор лечит игрока
                if (!string.IsNullOrEmpty(action.TargetId))
                {
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "heal", targetId = action.TargetId });
                }
                break;

            case NightPhase.Prostitute:
                // Путана забирает игрока
                if (!string.IsNullOrEmpty(action.TargetId))
                {
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "protect", targetId = action.TargetId });
                }
                break;
        }

        // Автоматически переходим к следующей фазе (опционально, можно ждать всех)
        // gameState.PhaseStartTime = DateTime.UtcNow; // Сброс таймера
    }
}

public class NightActionDTO
{
    public string? TargetId { get; set; }
    public string? ActionType { get; set; } // "kill", "heal", "check", "protect", "heal_self"
}

