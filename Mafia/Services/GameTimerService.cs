using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Hubs;
using Microsoft.AspNetCore.SignalR;

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
        
        switch (gameState.Phase)
        {
            case GamePhase.IndividualSpeech:
                await AdvanceIndividualSpeech(room);
                break;
            
            case GamePhase.FreeDiscussion:
                // Первый цикл: Обсуждение → Ночь → Обсуждение → Голосование
                // Последующие: Ночь → Обсуждение → Голосование
                if (gameState.IsFirstCycle)
                {
                    await StartNight(room);
                }
                else
                {
                    await StartVoting(room);
                }
                break;
            
            case GamePhase.Voting:
                await AdvanceVoting(room);
                break;
            
            case GamePhase.Night:
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
            gameState.PhaseTimeSeconds = 90; // 1.5 минуты
            gameState.CurrentSpeakerId = null;

            await _hubContext.Clients.Group(room.Id).SendAsync("PhaseChanged", new
            {
                phase = "FreeDiscussion",
                timeSeconds = 90
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
                    if (player != null)
                    {
                        // Помечаем игрока как мертвого, но сохраняем его статус (Admin/Player)
                        player.IsAlive = false;
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
            await EndGame(room, winner.Value);
            return;
        }

        // После голосования всегда ночь (в обычных циклах)
        await StartNight(room);
    }

    private async Task StartNight(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        gameState.Phase = GamePhase.Night;
        gameState.NightActions.Clear();
        gameState.PendingDeaths.Clear();
        gameState.DayNumber++;

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
        // Здесь будет логика обработки всех ночных действий

        // Применяем смерти
        foreach (var playerId in gameState.PendingDeaths.Distinct())
        {
            var player = room.Users.FirstOrDefault(u => u.Id == playerId);
            if (player != null && player.IsAlive)
            {
                // Помечаем игрока как мертвого, но сохраняем его статус
                player.IsAlive = false;
                killed.Add(playerId);
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
            await EndGame(room, winner.Value);
            return;
        }

        // Если это была первая ночь, сбрасываем флаг
        if (gameState.IsFirstCycle)
        {
            gameState.IsFirstCycle = false;
        }

        // Начинаем новый день
        await StartIndividualSpeech(room);
    }

    private async Task StartIndividualSpeech(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
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

