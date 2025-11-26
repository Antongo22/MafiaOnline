using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace Mafia.Services;

public class GameTimerService : BackgroundService
{
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<GameTimerService> _logger;

    public GameTimerService(
        IHubContext<ChatHub> hubContext,
        ILogger<GameTimerService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("GameTimerService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessGameTimers();
                await Task.Delay(1000, stoppingToken); // Проверяем каждую секунду
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GameTimerService");
            }
        }
    }

    private async Task ProcessGameTimers()
    {
        var rooms = Game.Rooms.Where(r => r.Status == GameStatus.InProgress && r.CurrentGameState != null).ToList();

        foreach (var room in rooms)
        {
            var gameState = room.CurrentGameState!;
            
            // Если игра на паузе, не обрабатываем таймеры
            if (gameState.IsPaused)
            {
                await _hubContext.Clients.Group(room.Id).SendAsync("TimerUpdate", new
                {
                    phase = gameState.Phase.ToString(),
                    timeLeft = gameState.RemainingTimeBeforePause,
                    isPaused = true
                });
                continue;
            }
            
            var elapsed = (DateTime.UtcNow - gameState.PhaseStartTime).TotalSeconds;

            // Отправляем обновление таймера
            await _hubContext.Clients.Group(room.Id).SendAsync("TimerUpdate", new
            {
                phase = gameState.Phase.ToString(),
                timeLeft = Math.Max(0, gameState.PhaseTimeSeconds - (int)elapsed),
                isPaused = false
            });

            // Проверяем, истекло ли время
            if (elapsed >= gameState.PhaseTimeSeconds)
            {
                await AdvancePhase(room);
            }
        }
    }

    private async Task AdvancePhase(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        _logger.LogInformation($"[Room {room.Id}] AdvancePhase called. Current phase: {gameState.Phase}, IsFirstCycle: {gameState.IsFirstCycle}, FirstNightCompleted: {gameState.FirstNightCompleted}, DayNumber: {gameState.DayNumber}");
        
        switch (gameState.Phase)
        {
            case GamePhase.IndividualSpeech:
                _logger.LogInformation($"[Room {room.Id}] Advancing IndividualSpeech");
                await AdvanceIndividualSpeech(room);
                break;
            
            case GamePhase.FreeDiscussion:
                // Первый цикл: Обсуждение → Ночь → Обсуждение → Голосование
                // Последующие: Ночь → Обсуждение → Голосование
                // Если это первый цикл И первая ночь ещё не была - идём в ночь
                // Иначе - идём в голосование
                if (gameState.IsFirstCycle && !gameState.FirstNightCompleted)
                {
                    _logger.LogInformation($"[Room {room.Id}] FreeDiscussion -> Night (first cycle, before first night)");
                    await StartNight(room);
                }
                else
                {
                    _logger.LogInformation($"[Room {room.Id}] FreeDiscussion -> Voting");
                    await StartVoting(room);
                }
                break;
            
            case GamePhase.Voting:
                _logger.LogInformation($"[Room {room.Id}] Advancing Voting");
                await AdvanceVoting(room);
                break;
            
            case GamePhase.Night:
                _logger.LogInformation($"[Room {room.Id}] Advancing Night phase: {gameState.CurrentNightPhase}");
                await AdvanceNight(room);
                break;
        }
    }

    private async Task AdvanceIndividualSpeech(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        gameState.CurrentSpeakerIndex++;

        if (gameState.CurrentSpeakerIndex >= gameState.SpeakerOrder.Count)
        {
            // Все выступили, переходим к свободному обсуждению
            gameState.Phase = GamePhase.FreeDiscussion;
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = 5; // Для тестов: 5 секунд (обычно 90)
            gameState.CurrentSpeakerId = null;

            await _hubContext.Clients.Group(room.Id).SendAsync("PhaseChanged", new
            {
                phase = "FreeDiscussion",
                timeSeconds = 5
            });
        }
        else
        {
            // Следующий спикер
            gameState.CurrentSpeakerId = gameState.SpeakerOrder[gameState.CurrentSpeakerIndex];
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = 30;

            var speaker = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentSpeakerId);
            
            await _hubContext.Clients.Group(room.Id).SendAsync("SpeakerChanged", new
            {
                speakerId = gameState.CurrentSpeakerId,
                speakerName = speaker?.Name,
                timeSeconds = 30
            });
        }
    }

    private async Task StartVoting(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        gameState.Phase = GamePhase.Voting;
        gameState.Votes.Clear();
        gameState.CurrentVoterIndex = 0;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = 15;

        // Создаем порядок голосования (только живые игроки)
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
            .Select(u => u.Id)
            .ToList();
        
        gameState.VoterOrder = alivePlayers;
        gameState.CurrentVoterId = alivePlayers.FirstOrDefault();

        await _hubContext.Clients.Group(room.Id).SendAsync("VotingStarted", new
        {
            voterId = gameState.CurrentVoterId,
            voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
            timeSeconds = 15
        });
    }

    private async Task AdvanceVoting(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;

        // Если текущий игрок не проголосовал, голосует за себя
        if (gameState.CurrentVoterId != null && !gameState.Votes.ContainsKey(gameState.CurrentVoterId))
        {
            gameState.Votes[gameState.CurrentVoterId] = gameState.CurrentVoterId;
            _logger.LogInformation($"Player {gameState.CurrentVoterId} voted for themselves (timeout)");
        }

        gameState.CurrentVoterIndex++;

        if (gameState.CurrentVoterIndex >= gameState.VoterOrder.Count)
        {
            // Все проголосовали, обрабатываем результаты
            await ProcessVotingResults(room);
        }
        else
        {
            // Следующий голосующий
            gameState.CurrentVoterId = gameState.VoterOrder[gameState.CurrentVoterIndex];
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = 15;

            await _hubContext.Clients.Group(room.Id).SendAsync("VoterChanged", new
            {
                voterId = gameState.CurrentVoterId,
                voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
                timeSeconds = 15
            });
        }
    }

    private async Task ProcessVotingResults(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;

        // Подсчитываем голоса
        var voteCounts = gameState.Votes
            .GroupBy(v => v.Value)
            .Select(g => new { PlayerId = g.Key, Count = g.Count() })
            .ToList();

        if (voteCounts.Any())
        {
            var maxVotes = voteCounts.Max(v => v.Count);
            var eliminated = voteCounts.Where(v => v.Count == maxVotes).Select(v => v.PlayerId).ToList();

            // Проверяем: если все игроки получили равное количество голосов (поровну), никто не умирает
            var allPlayersEqualVotes = eliminated.Count == voteCounts.Count;

            if (!allPlayersEqualVotes)
            {
                // Убиваем игроков
                foreach (var playerId in eliminated)
                {
                    var player = room.Users.FirstOrDefault(u => u.Id == playerId);
                    if (player != null && player.IsAlive)
                    {
                        // Помечаем игрока как мертвого, но сохраняем его статус (Admin/Player)
                        player.IsAlive = false;
                        
                        // Получаем роль убитого игрока
                        var playerRole = room.PlayerRoles!.ContainsKey(playerId) 
                            ? room.PlayerRoles[playerId].ToString() 
                            : "Unknown";
                        
                        _logger.LogInformation($"[Room {room.Id}] Player {player.Name} ({playerId}) eliminated. Role: {playerRole}");
                        
                        // Отправляем отдельное событие о смерти игрока с его ролью
                        await _hubContext.Clients.Group(room.Id).SendAsync("PlayerEliminated", new
                        {
                            userId = playerId,
                            userName = player.Name,
                            role = playerRole,
                            reason = "voting"
                        });
                    }
                }
            }
            else
            {
                // Все получили поровну - никто не исключается
                eliminated.Clear();
            }

            // Преобразуем голоса в формат с именами для отображения
            var votesWithNames = gameState.Votes.Select(v => new
            {
                voterName = room.Users.FirstOrDefault(u => u.Id == v.Key)?.Name,
                targetName = room.Users.FirstOrDefault(u => u.Id == v.Value)?.Name
            }).ToList();

            // Подсчёт голосов по именам игроков
            var voteCountsByName = voteCounts.ToDictionary(
                v => room.Users.FirstOrDefault(u => u.Id == v.PlayerId)?.Name ?? "Unknown",
                v => v.Count
            );

            await _hubContext.Clients.Group(room.Id).SendAsync("VotingResults", new
            {
                votes = gameState.Votes,
                votesWithNames = votesWithNames,
                voteCounts = voteCountsByName,
                eliminated = eliminated.Select(id => new
                {
                    userId = id,
                    userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name,
                    role = room.PlayerRoles!.ContainsKey(id) ? room.PlayerRoles[id].ToString() : null
                }),
                tie = allPlayersEqualVotes // Флаг что была ничья
            });
        }

        // Проверяем условия победы
        var winner = WinConditionService.CheckWinCondition(room);
        if (winner != null)
        {
            _logger.LogInformation($"[Room {room.Id}] Game over! Winner: {winner}");
            await EndGame(room, winner.Value);
            return;
        }

        // Если это был первый цикл, сбрасываем флаг после голосования
        if (gameState.IsFirstCycle)
        {
            _logger.LogInformation($"[Room {room.Id}] First cycle completed, resetting IsFirstCycle flag");
            gameState.IsFirstCycle = false;
        }

        // После голосования всегда ночь
        _logger.LogInformation($"[Room {room.Id}] Voting completed -> Starting Night (Day {gameState.DayNumber + 1})");
        await StartNight(room);
    }

    private async Task StartNight(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        _logger.LogInformation($"[Room {room.Id}] StartNight called. Current day: {gameState.DayNumber}");
        
        gameState.Phase = GamePhase.Night;
        gameState.CurrentNightPhase = null; // Сбрасываем ночную фазу для новой ночи
        gameState.NightActions.Clear();
        gameState.PendingDeaths.Clear();
        gameState.DayNumber++;

        _logger.LogInformation($"[Room {room.Id}] Night started. Day number: {gameState.DayNumber}");

        // Определяем первую ночную фазу
        await AdvanceNight(room);
    }

    private async Task AdvanceNight(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;

        // Обрабатываем текущую ночную фазу
        if (gameState.CurrentNightPhase != null)
        {
            // Здесь можно добавить обработку автоматических действий (если игрок не успел)
        }

        // Переходим к следующей ночной фазе
        var nextPhase = GetNextNightPhase(room, gameState.CurrentNightPhase);

        if (nextPhase == null)
        {
            // Ночь окончена, обрабатываем результаты
            await ProcessNightResults(room);
        }
        else
        {
            gameState.CurrentNightPhase = nextPhase;
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = 30;

            await _hubContext.Clients.Group(room.Id).SendAsync("NightPhaseChanged", new
            {
                nightPhase = nextPhase.ToString(),
                timeSeconds = 30
            });
        }
    }

    private NightPhase? GetNextNightPhase(RoomDTO room, NightPhase? currentPhase)
    {
        var availableRoles = room.PlayerRoles!.Values.Distinct().ToList();
        var alivePlayers = room.Users.Where(u => u.Status != UserStatus.Leave && u.IsAlive).ToList();
        var aliveRoles = alivePlayers
            .Where(u => room.PlayerRoles.ContainsKey(u.Id))
            .Select(u => room.PlayerRoles[u.Id])
            .ToHashSet();

        var nightPhases = new[] 
        {
            NightPhase.Don,
            NightPhase.Mafia,
            NightPhase.Maniac,
            NightPhase.Sheriff,
            NightPhase.Doctor,
            NightPhase.Prostitute
        };

        var startIndex = currentPhase == null ? 0 : Array.IndexOf(nightPhases, currentPhase.Value) + 1;

        for (int i = startIndex; i < nightPhases.Length; i++)
        {
            var phase = nightPhases[i];
            
            switch (phase)
            {
                case NightPhase.Don:
                    if (aliveRoles.Contains(Role.Don) && !room.CurrentGameState!.DonHasFoundSheriff)
                        return phase;
                    break;
                
                case NightPhase.Mafia:
                    if (aliveRoles.Any(r => RoleInfo.GetTeam(r) == Team.Evil))
                        return phase;
                    break;
                
                case NightPhase.Maniac:
                    if (aliveRoles.Contains(Role.Maniac))
                        return phase;
                    break;
                
                case NightPhase.Sheriff:
                    if (aliveRoles.Contains(Role.Sheriff))
                        return phase;
                    break;
                
                case NightPhase.Doctor:
                    if (aliveRoles.Contains(Role.Doctor))
                        return phase;
                    break;
                
                case NightPhase.Prostitute:
                    if (aliveRoles.Contains(Role.Prostitute))
                        return phase;
                    break;
            }
        }

        return null;
    }

    private async Task ProcessNightResults(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        var killed = new List<string>();
        var saved = new List<string>();

        // Обрабатываем действия
        var mafiaVotes = new Dictionary<string, int>(); // targetId -> vote count
        var attackTargets = new HashSet<string>(); // Все, кого пытаются убить
        var healed = new HashSet<string>(); // Кого вылечили
        var protectedPlayers = new HashSet<string>(); // Кого защитили
        var prostituteTarget = (string?)null; // Кого забрала путана
        var maniacSelfHealed = false;

        // 1. Обрабатываем действия мафии (голосование)
        var mafiaActions = new List<(string userId, string targetId)>();
        foreach (var actionEntry in gameState.NightActions)
        {
            var userId = actionEntry.Key;
            if (!room.PlayerRoles!.ContainsKey(userId))
                continue;

            var userRole = room.PlayerRoles[userId];
            var actionJson = actionEntry.Value;
            
            try
            {
                var actionData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(actionJson);
                if (actionData == null || !actionData.ContainsKey("action"))
                    continue;

                var actionType = actionData["action"].GetString();
                var targetId = actionData.ContainsKey("targetId") ? actionData["targetId"].GetString() : null;

                // Голосование мафии
                if (RoleInfo.GetTeam(userRole) == Team.Evil && actionType == "kill" && !string.IsNullOrEmpty(targetId))
                {
                    mafiaActions.Add((userId, targetId!));
                    if (!mafiaVotes.ContainsKey(targetId!))
                        mafiaVotes[targetId!] = 0;
                    mafiaVotes[targetId!]++;
                }
                // Действие маньяка
                else if (userRole == Role.Maniac)
                {
                    if (actionType == "heal_self")
                    {
                        maniacSelfHealed = true;
                    }
                    else if (actionType == "kill" && !string.IsNullOrEmpty(targetId))
                    {
                        attackTargets.Add(targetId!);
                    }
                }
                // Действие доктора
                else if (userRole == Role.Doctor && actionType == "heal" && !string.IsNullOrEmpty(targetId))
                {
                    healed.Add(targetId!);
                }
                // Действие путаны
                else if (userRole == Role.Prostitute && actionType == "protect" && !string.IsNullOrEmpty(targetId))
                {
                    prostituteTarget = targetId!;
                    protectedPlayers.Add(targetId!);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to parse night action for user {userId}: {actionJson}");
            }
        }

        // 2. Выбираем жертву мафии (по большинству голосов, при ничьей - рандом)
        string? mafiaTarget = null;
        if (mafiaVotes.Any())
        {
            var maxVotes = mafiaVotes.Max(v => v.Value);
            var candidates = mafiaVotes.Where(v => v.Value == maxVotes).Select(v => v.Key).ToList();
            
            if (candidates.Count == 1)
            {
                mafiaTarget = candidates[0];
            }
            else if (candidates.Count > 1)
            {
                // Ничья - выбираем рандомно
                var random = new Random();
                mafiaTarget = candidates[random.Next(candidates.Count)];
            }

            if (mafiaTarget != null)
            {
                attackTargets.Add(mafiaTarget);
            }
        }

        // 3. Проверяем защиту путаны (если путану убили, её цель тоже умирает)
        var prostituteKilled = false;
        if (prostituteTarget != null && attackTargets.Contains(prostituteTarget))
        {
            // Если цель путаны была атакована, путана её защищает
            protectedPlayers.Add(prostituteTarget);
        }

        // Проверяем, убили ли саму путану
        var prostituteUserId = room.PlayerRoles.FirstOrDefault(p => p.Value == Role.Prostitute).Key;
        if (!string.IsNullOrEmpty(prostituteUserId) && attackTargets.Contains(prostituteUserId))
        {
            prostituteKilled = true;
            // Если путану убили, её цель тоже умирает
            if (prostituteTarget != null && !protectedPlayers.Contains(prostituteTarget))
            {
                attackTargets.Add(prostituteTarget);
            }
        }

        // 4. Применяем лечение маньяка (если он лечил себя)
        if (maniacSelfHealed)
        {
            var maniacUserId = room.PlayerRoles.FirstOrDefault(p => p.Value == Role.Maniac).Key;
            if (!string.IsNullOrEmpty(maniacUserId) && attackTargets.Contains(maniacUserId))
            {
                healed.Add(maniacUserId);
            }
        }

        // 5. Проверяем бессмертного (нельзя убить ночью)
        var immortalUserId = room.PlayerRoles.FirstOrDefault(p => p.Value == Role.Immortal).Key;
        if (!string.IsNullOrEmpty(immortalUserId) && attackTargets.Contains(immortalUserId))
        {
            protectedPlayers.Add(immortalUserId);
        }

        // 6. Определяем убитых (атакованные, но не вылеченные и не защищенные)
        var finalKilled = attackTargets.Except(healed).Except(protectedPlayers).ToList();
        gameState.PendingDeaths.AddRange(finalKilled);

        // 7. Применяем смерти
        foreach (var playerId in gameState.PendingDeaths.Distinct())
        {
            var player = room.Users.FirstOrDefault(u => u.Id == playerId);
            if (player != null && player.IsAlive)
            {
                // Помечаем игрока как мертвого, но сохраняем его статус
                player.IsAlive = false;
                killed.Add(playerId);
                
                // Получаем роль убитого игрока
                var playerRole = room.PlayerRoles!.ContainsKey(playerId) 
                    ? room.PlayerRoles[playerId].ToString() 
                    : "Unknown";
                
                _logger.LogInformation($"[Room {room.Id}] Player {player.Name} ({playerId}) died at night. Role: {playerRole}");
                
                // Отправляем отдельное событие о смерти игрока с его ролью
                await _hubContext.Clients.Group(room.Id).SendAsync("PlayerDied", new
                {
                    userId = playerId,
                    userName = player.Name,
                    role = playerRole,
                    reason = "night"
                });
            }
        }

        await _hubContext.Clients.Group(room.Id).SendAsync("NightResults", new
        {
            killed = killed.Select(id => new
            {
                userId = id,
                userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name,
                role = room.PlayerRoles!.ContainsKey(id) ? room.PlayerRoles[id].ToString() : null
            }),
            saved
        });

        // Проверяем условия победы
        var winner = WinConditionService.CheckWinCondition(room);
        if (winner != null)
        {
            _logger.LogInformation($"[Room {room.Id}] Game over after night! Winner: {winner}");
            await EndGame(room, winner.Value);
            return;
        }

        // Если это была первая ночь, отмечаем это
        if (gameState.IsFirstCycle && !gameState.FirstNightCompleted)
        {
            _logger.LogInformation($"[Room {room.Id}] First night completed, setting FirstNightCompleted flag");
            gameState.FirstNightCompleted = true;
        }

        // Начинаем новый день
        _logger.LogInformation($"[Room {room.Id}] Night completed -> Starting IndividualSpeech (Day {gameState.DayNumber})");
        await StartIndividualSpeech(room);
    }

    private async Task StartIndividualSpeech(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        _logger.LogInformation($"[Room {room.Id}] StartIndividualSpeech called. Day: {gameState.DayNumber}");
        
        gameState.Phase = GamePhase.IndividualSpeech;
        gameState.HasSpoken.Clear();
        gameState.CurrentSpeakerIndex = 0;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = 30;

        // Создаем порядок выступлений (только живые игроки, случайный порядок)
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
            .Select(u => u.Id)
            .OrderBy(_ => Guid.NewGuid())
            .ToList();
        
        gameState.SpeakerOrder = alivePlayers;
        gameState.CurrentSpeakerId = alivePlayers.FirstOrDefault();

        _logger.LogInformation($"[Room {room.Id}] IndividualSpeech started. Alive players: {alivePlayers.Count}, First speaker: {gameState.CurrentSpeakerId}");

        await _hubContext.Clients.Group(room.Id).SendAsync("IndividualSpeechStarted", new
        {
            speakerId = gameState.CurrentSpeakerId,
            speakerName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentSpeakerId)?.Name,
            speakerOrder = alivePlayers,
            timeSeconds = 30
        });
    }

    private async Task EndGame(RoomDTO room, Team winner)
    {
        room.Status = GameStatus.Finished;
        room.CurrentGameState!.Phase = GamePhase.GameOver;
        room.CurrentGameState.WinningTeam = winner;

        // Преобразуем роли: userId -> userName, Role -> string
        var rolesWithNames = new Dictionary<string, string>();
        if (room.PlayerRoles != null)
        {
            foreach (var kvp in room.PlayerRoles)
            {
                var user = room.Users.FirstOrDefault(u => u.Id == kvp.Key);
                if (user != null)
                {
                    rolesWithNames[user.Name] = kvp.Value.ToString();
                }
            }
        }

        await _hubContext.Clients.Group(room.Id).SendAsync("GameOver", new
        {
            winner = winner.ToString(),
            roles = rolesWithNames
        });
        
        // Также отправляем событие смены статуса
        await _hubContext.Clients.Group(room.Id).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
    }
}

