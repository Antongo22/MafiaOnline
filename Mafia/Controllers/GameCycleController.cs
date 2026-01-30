using Microsoft.AspNetCore.Mvc;
using Mafia.Services;
using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Models;
using Mafia.Hubs;
using Mafia.Helpers;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameCycleController : ControllerBase
{
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<GameCycleController> _logger;
    private readonly GameTimerService _gameTimerService;

    public GameCycleController(IHubContext<ChatHub> hubContext, ILogger<GameCycleController> logger, GameTimerService gameTimerService)
    {
        _hubContext = hubContext;
        _logger = logger;
        _gameTimerService = gameTimerService;
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
            gameStatus = room.Status.ToString(),
            winningTeam = gameState.WinningTeam?.ToString()
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

        var settings = room.GameSettings ?? new GameSettings();
        room.CurrentGameState = new GameState
        {
            Phase = GamePhase.IndividualSpeech,
            IsFirstCycle = true,
            DayNumber = 1,
            PhaseStartTime = DateTime.UtcNow,
            PhaseTimeSeconds = settings.IndividualSpeechTime,
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
            timeSeconds = settings.IndividualSpeechTime
        });

        return Ok(new { message = "Game cycle started" });
    }

    /// <summary>
    /// Проголосовать за игрока во время фазы голосования
    /// </summary>
    [HttpPost("vote")]
    public async Task<ActionResult> Vote(string roomId, string voterId, string targetId)
    {
        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));
        ValidationHelper.ValidateNotEmpty(voterId, nameof(voterId));
        ValidationHelper.ValidateNotEmpty(targetId, nameof(targetId));
        
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

        // КРИТИЧЕСКАЯ ПРОВЕРКА: цель голосования должна быть жива
        var target = room.Users.FirstOrDefault(u => u.Id == targetId);
        if (target == null)
            return NotFound("Target player not found");
            
        if (!target.IsAlive)
            return BadRequest("Cannot vote for dead player");
            
        if (target.Status == UserStatus.Leave)
            return BadRequest("Cannot vote for player who left");

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

            var settings = room.GameSettings ?? new GameSettings();
            await _hubContext.Clients.Group(roomId).SendAsync("VoterChanged", new
            {
                voterId = gameState.CurrentVoterId,
                voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
                candidates = candidates, // Список живых игроков для голосования
                timeSeconds = settings.VotingTime
            });
        }
        else
        {
            // Все проголосовали - завершаем фазу немедленно
            _logger.LogInformation($"Room {roomId}: All players voted, forcing phase advance immediately");
            gameState.CurrentVoterId = null; // Сбрасываем текущего голосующего
            
            // Отправляем событие что голосование завершено
            await _hubContext.Clients.Group(roomId).SendAsync("AllVotesCompleted", new
            {
                message = "Все проголосовали, подсчитываем голоса..."
            });
            
            // Принудительно продвигаем фазу
            await _gameTimerService.ForceAdvancePhaseAsync(roomId);
        }

        return Ok(new { message = "Vote recorded" });
    }

    /// <summary>
    /// Проголосовать в разрешении ничьей (убить всех или помиловать всех)
    /// </summary>
    [HttpPost("tie-breaker-vote")]
    public async Task<ActionResult> TieBreakerVote(string roomId, string voterId, bool killAll)
    {
        ValidationHelper.ValidateNotEmpty(roomId, nameof(roomId));
        ValidationHelper.ValidateNotEmpty(voterId, nameof(voterId));
        
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room == null)
            return NotFound("Room not found");

        var gameState = room.CurrentGameState;
        if (gameState == null || gameState.Phase != GamePhase.TieBreaker)
            return BadRequest("Not in tie breaker phase");

        var voter = room.Users.FirstOrDefault(u => u.Id == voterId);
        if (voter == null || !voter.IsAlive || voter.Status == UserStatus.Leave)
            return BadRequest("You cannot vote");

        // Сохраняем голос
        gameState.TieBreakerVotes[voterId] = killAll;

        await _hubContext.Clients.Group(roomId).SendAsync("TieBreakerVoteReceived", new
        {
            voterId,
            voterName = voter.Name,
            decision = killAll ? "kill" : "pardon"
        });

        // Проверяем, все ли проголосовали (среди подключенных игроков)
        // Чтобы не ждать AFK/отключившихся, проверяем активные соединения
        var connectedUserIds = Game.UserConnections.Values
             .Where(v => v.RoomId == roomId)
             .Select(v => v.UserId)
             .ToHashSet();

        var activeConnectedPlayersCount = room.Users
            .Count(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id) && connectedUserIds.Contains(u.Id));
            
        // Если количество голосов >= количеству активных подключенных игроков -> завершаем
        if (gameState.TieBreakerVotes.Count >= activeConnectedPlayersCount)
        {
            _logger.LogInformation($"Room {roomId}: All connected players ({activeConnectedPlayersCount}) voted in TieBreaker, forcing phase advance immediately");
            await _gameTimerService.ForceAdvancePhaseAsync(roomId);
        }

        return Ok(new { message = "Tie breaker vote recorded" });
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
        
        // Проверяем, все ли игроки, которые должны походить в эту фазу, уже походили
        var potentialActors = room.Users
            .Where(u => u.IsAlive && u.Status != UserStatus.Leave && room.PlayerRoles!.ContainsKey(u.Id))
            .Where(u => 
            {
                 var r = room.PlayerRoles![u.Id];
                 return gameState.CurrentNightPhase switch
                 {
                    NightPhase.Don => r == Role.Don,
                    NightPhase.Mafia => RoleInfo.GetTeam(r) == Team.Evil, // Вся мафия (включая Дона) ходит
                    NightPhase.Maniac => r == Role.Maniac,
                    NightPhase.Sheriff => r == Role.Sheriff,
                    NightPhase.Doctor => r == Role.Doctor,
                    NightPhase.Prostitute => r == Role.Prostitute,
                    _ => false
                 };
            })
            .Select(u => u.Id)
            .ToList();

        var allActed = potentialActors.All(id => gameState.NightActions.ContainsKey(id));

        // Завершаем фазу немедленно, если все походили
        if (allActed && gameState.CurrentNightPhase == phaseBeforeAction)
        {
            _logger.LogInformation($"Room {roomId}: All players ({potentialActors.Count}) for phase {gameState.CurrentNightPhase} completed night action, forcing phase advance immediately");
            // Вызываем принудительное продвижение фазы вместо ожидания тика таймера
            await _gameTimerService.ForceAdvancePhaseAsync(roomId);
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
                    
                    // Записываем действие, чтобы отследить, что Дон походил
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "check", targetId = action.TargetId });
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
                    
                    // Записываем действие, чтобы отследить, что Шериф походил
                    gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "check", targetId = action.TargetId });
                }
                break;

            case NightPhase.Doctor:
                // Доктор лечит игрока
                if (action.ActionType == "heal_self")
                {
                   // Доктор лечит себя - записываем как обычное лечение с targetId = userId
                   gameState.NightActions[userId] = JsonSerializer.Serialize(new { action = "heal", targetId = userId });
                }
                else if (!string.IsNullOrEmpty(action.TargetId))
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

