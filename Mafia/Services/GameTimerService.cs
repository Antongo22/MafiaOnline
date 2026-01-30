using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace Mafia.Services;

/// <summary>
/// Фоновый сервис для управления таймерами игровых фаз
/// </summary>
public class GameTimerService : BackgroundService
{
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<GameTimerService> _logger;
    private readonly IVideoCallService _videoCallService;

    public GameTimerService(
        IHubContext<ChatHub> hubContext,
        ILogger<GameTimerService> logger,
        IVideoCallService videoCallService)
    {
        _hubContext = hubContext;
        _logger = logger;
        _videoCallService = videoCallService;
    }

    /// <summary>
    /// Получить настройки таймеров для комнаты (с дефолтными значениями если не заданы)
    /// </summary>
    private static GameSettings GetGameSettings(RoomDTO room)
    {
        return room.GameSettings ?? new GameSettings();
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
            // Добавляем минимальную задержку 0.5 секунды чтобы избежать двойных вызовов
            if (elapsed >= gameState.PhaseTimeSeconds && elapsed >= 0.5)
            {
                _logger.LogInformation($"[Room {room.Id}] Timer expired! Phase: {gameState.Phase}, Elapsed: {elapsed:F1}s, PhaseTime: {gameState.PhaseTimeSeconds}s. Calling AdvancePhase...");
                await AdvancePhase(room);
            }
        }
    }

    /// <summary>
    /// Принудительно продвинуть фазу игры (вызывается из контроллеров для мгновенного перехода)
    /// </summary>
    public virtual async Task ForceAdvancePhaseAsync(string roomId)
    {
        var room = Game.Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room?.CurrentGameState == null) return;
        
        _logger.LogInformation($"[Room {roomId}] ForceAdvancePhaseAsync called, current phase: {room.CurrentGameState.Phase}");
        await AdvancePhase(room);
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

            case GamePhase.GameOver:
                 _logger.LogInformation($"[Room {room.Id}] GameOver phase ended -> Setting Status to Finished");
                 room.Status = GameStatus.Finished;
                 await _hubContext.Clients.Group(room.Id).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });
                 break;
            
            case GamePhase.FreeDiscussion:
                // Первый цикл: Обсуждение → Ночь → Обсуждение → Голосование
                // Последующие: Ночь → Обсуждение → Голосование
                // Если это первый цикл И первая ночь ещё не была - идём в ночь
                // Иначе - идём в голосование
                _logger.LogInformation($"[Room {room.Id}] FreeDiscussion: IsFirstCycle={gameState.IsFirstCycle}, FirstNightCompleted={gameState.FirstNightCompleted}, DayNumber={gameState.DayNumber}");
                if (gameState.IsFirstCycle && !gameState.FirstNightCompleted)
                {
                    _logger.LogInformation($"[Room {room.Id}] FreeDiscussion -> Night (first cycle, before first night)");
                    await StartNight(room);
                }
                else
                {
                    _logger.LogInformation($"[Room {room.Id}] FreeDiscussion -> Voting (IsFirstCycle={gameState.IsFirstCycle}, FirstNightCompleted={gameState.FirstNightCompleted})");
                    await StartVoting(room);
                }
                break;
            
            case GamePhase.Voting:
                _logger.LogInformation($"[Room {room.Id}] Advancing Voting");
                await AdvanceVoting(room);
                break;
            
            case GamePhase.TieBreaker:
                // Если результаты уже показаны, это задержка - переходим к ночи
                if (gameState.TieBreakerResultsShown)
                {
                    _logger.LogInformation($"[Room {room.Id}] TieBreaker results delay ended -> Starting Night");
                    gameState.TieBreakerResultsShown = false; // Сбрасываем флаг
                    await StartNight(room);
                }
                else
                {
                    // Обрабатываем голосование TieBreaker
                    _logger.LogInformation($"[Room {room.Id}] Advancing TieBreaker");
                    await ProcessTieBreakerResults(room);
                }
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
            var settings = GetGameSettings(room);
            gameState.Phase = GamePhase.FreeDiscussion;
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = settings.FreeDiscussionTime;
            gameState.CurrentSpeakerId = null;

            await _hubContext.Clients.Group(room.Id).SendAsync("PhaseChanged", new
            {
                phase = "FreeDiscussion",
                timeSeconds = settings.FreeDiscussionTime
            });

            // УПРОЩЕНИЕ: Автоуправление медиа отключено - участники сами управляют камерой/микрофоном
            // await _videoCallService.UnmuteAllAudioAsync(room.Id);
            // await _videoCallService.UnmuteAllVideoAsync(room.Id);
        }
        else
        {
            // Следующий спикер
            var settings = GetGameSettings(room);
            gameState.CurrentSpeakerId = gameState.SpeakerOrder[gameState.CurrentSpeakerIndex];
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = settings.IndividualSpeechTime;

            var speaker = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentSpeakerId);
            
            await _hubContext.Clients.Group(room.Id).SendAsync("SpeakerChanged", new
            {
                speakerId = gameState.CurrentSpeakerId,
                speakerName = speaker?.Name,
                timeSeconds = settings.IndividualSpeechTime
            });

            // УПРОЩЕНИЕ: Автоуправление медиа отключено
            // if (speaker?.Name != null)
            // {
            //     await _videoCallService.MuteAllAudioAsync(room.Id, speaker.Name);
            //     await _videoCallService.MuteUserAudioAsync(room.Id, speaker.Name, false);
            // }
        }
    }

    private async Task StartVoting(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        var settings = GetGameSettings(room);
        
        gameState.Phase = GamePhase.Voting;
        gameState.Votes.Clear();
        gameState.CurrentVoterIndex = 0;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = settings.VotingTime;

        // Создаем порядок голосования (только живые игроки)
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
            .Select(u => u.Id)
            .ToList();
        
        gameState.VoterOrder = alivePlayers;
        gameState.CurrentVoterId = alivePlayers.FirstOrDefault();

        // Формируем список кандидатов (живые игроки)
        var candidates = alivePlayers.Select(id => new
        {
            userId = id,
            userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name
        }).ToList();

        await _hubContext.Clients.Group(room.Id).SendAsync("VotingStarted", new
        {
            voterId = gameState.CurrentVoterId,
            voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
            candidates = candidates, // Список живых игроков для голосования
            timeSeconds = settings.VotingTime
        });

        // УПРОЩЕНИЕ: Автоуправление медиа отключено
        // await _videoCallService.MuteAllAudioAsync(room.Id);
        // await _videoCallService.UnmuteAllVideoAsync(room.Id);
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
            var settings = GetGameSettings(room);
            gameState.CurrentVoterId = gameState.VoterOrder[gameState.CurrentVoterIndex];
            gameState.PhaseStartTime = DateTime.UtcNow;
            gameState.PhaseTimeSeconds = settings.VotingTime;

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
            await _hubContext.Clients.Group(room.Id).SendAsync("VoterChanged", new
            {
                voterId = gameState.CurrentVoterId,
                voterName = room.Users.FirstOrDefault(u => u.Id == gameState.CurrentVoterId)?.Name,
                candidates = candidates, // Список живых игроков для голосования
                timeSeconds = settings.VotingTime
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

            // Проверяем: если несколько игроков получили одинаковое максимальное количество голосов - ничья
            var isTie = eliminated.Count > 1;

            if (!isTie)
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
                // Ничья - запускаем фазу разрешения ничьей
                _logger.LogInformation($"[Room {room.Id}] Voting tie detected - starting TieBreaker phase. Players with max votes: {eliminated.Count}");
                
                // Сохраняем кандидатов для разрешения ничьей
                gameState.TieBreakerCandidates = eliminated;
                gameState.TieBreakerVotes.Clear();
                
                // Переходим в фазу TieBreaker
                gameState.Phase = GamePhase.TieBreaker;
                gameState.PhaseStartTime = DateTime.UtcNow;
                var settings = GetGameSettings(room);
                gameState.PhaseTimeSeconds = 30; // Фиксированное время 30 секунд для TieBreaker
                
                // Формируем список кандидатов с именами для отображения (БЕЗ ролей!)
                var candidateNames = eliminated.Select(id => new
                {
                    userId = id,
                    userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name
                }).ToList();
                
                await _hubContext.Clients.Group(room.Id).SendAsync("TieBreakerStarted", new
                {
                    candidates = candidateNames,
                    timeSeconds = gameState.PhaseTimeSeconds
                });
                
                return; // Выходим, обработка TieBreaker будет в AdvancePhase
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
                tie = isTie // Флаг что была ничья
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

        // После голосования всегда ночь (если не было ничьей, которая обрабатывается отдельно)
        _logger.LogInformation($"[Room {room.Id}] Voting completed -> Starting Night (Day {gameState.DayNumber + 1})");
        await StartNight(room);
    }

    /// <summary>
    /// Обрабатывает результаты голосования TieBreaker (разрешение ничьей)
    /// Когда при обычном голосовании несколько игроков получили одинаковое максимальное количество голосов,
    /// все живые игроки голосуют: убить всех кандидатов или помиловать всех
    /// </summary>
    private async Task ProcessTieBreakerResults(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        
        // Проверяем что есть кандидаты для разрешения ничьей
        if (gameState.TieBreakerCandidates == null || !gameState.TieBreakerCandidates.Any())
        {
            _logger.LogWarning($"[Room {room.Id}] ProcessTieBreakerResults called but no candidates");
            await StartNight(room);
            return;
        }

        // Подсчитываем голоса: true = убить всех, false = помиловать всех
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
            .Select(u => u.Id)
            .ToList();
        
        var killVotes = gameState.TieBreakerVotes.Count(v => v.Value == true);
        var pardonVotes = gameState.TieBreakerVotes.Count(v => v.Value == false);
        
        // Игроки, которые не проголосовали, считаются за помилование (по умолчанию)
        var playersWhoVoted = gameState.TieBreakerVotes.Keys.ToHashSet();
        var playersWhoDidntVote = alivePlayers.Except(playersWhoVoted).ToList();
        pardonVotes += playersWhoDidntVote.Count;
        
        _logger.LogInformation($"[Room {room.Id}] TieBreaker results: Kill={killVotes}, Pardon={pardonVotes}, Candidates={gameState.TieBreakerCandidates.Count}");
        
        // Проверяем, сколько игроков останется после убийства
        var wouldRemainAlive = alivePlayers.Except(gameState.TieBreakerCandidates).Count();
        
        // ВАЖНОЕ ПРАВИЛО: Убиваем только если голосов "убить" больше чем "помиловать"
        bool shouldKill = killVotes > pardonVotes;
        
        if (shouldKill)
        {
            // Убиваем всех кандидатов
            foreach (var playerId in gameState.TieBreakerCandidates)
            {
                var player = room.Users.FirstOrDefault(u => u.Id == playerId);
                if (player != null && player.IsAlive)
                {
                    player.IsAlive = false;
                    
                    var playerRole = room.PlayerRoles!.ContainsKey(playerId) 
                        ? room.PlayerRoles[playerId].ToString() 
                        : "Unknown";
                    
                    _logger.LogInformation($"[Room {room.Id}] TieBreaker: Player {player.Name} ({playerId}) eliminated. Role: {playerRole}");
                    
                    await _hubContext.Clients.Group(room.Id).SendAsync("PlayerEliminated", new
                    {
                        userId = playerId,
                        userName = player.Name,
                        role = playerRole,
                        reason = "tiebreaker"
                    });
                }
            }
            
            await _hubContext.Clients.Group(room.Id).SendAsync("TieBreakerResults", new
            {
                decision = "kill",
                killed = gameState.TieBreakerCandidates.Select(id => new
                {
                    userId = id,
                    userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name
                })
            });
        }
        else
        {
            // Помилование (либо помилование победило, либо убийство привело бы к 0 игроков)
            _logger.LogInformation($"[Room {room.Id}] TieBreaker: All candidates spared (kill votes={killVotes}, pardon votes={pardonVotes}, would remain={wouldRemainAlive})");
            
            await _hubContext.Clients.Group(room.Id).SendAsync("TieBreakerResults", new
            {
                decision = "pardon",
                spared = gameState.TieBreakerCandidates.Select(id => new
                {
                    userId = id,
                    userName = room.Users.FirstOrDefault(u => u.Id == id)?.Name
                })
            });
        }
        
        // Очищаем данные TieBreaker
        gameState.TieBreakerCandidates = null;
        gameState.TieBreakerVotes.Clear();
        
        // Проверяем условия победы
        var winner = WinConditionService.CheckWinCondition(room);
        if (winner != null)
        {
            _logger.LogInformation($"[Room {room.Id}] Game over after TieBreaker! Winner: {winner}");
            await EndGame(room, winner.Value);
            return;
        }
        
        // Если это был первый цикл, сбрасываем флаг после голосования
        if (gameState.IsFirstCycle)
        {
            _logger.LogInformation($"[Room {room.Id}] First cycle completed, resetting IsFirstCycle flag");
            gameState.IsFirstCycle = false;
        }
        
        // Ждем 10 секунд перед переходом к ночи, чтобы игроки успели увидеть результаты
        gameState.Phase = GamePhase.TieBreaker;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = 10; // 10 секунд задержки
        gameState.TieBreakerResultsShown = true; // Флаг что результаты показаны
        
        _logger.LogInformation($"[Room {room.Id}] TieBreaker completed, waiting 10 seconds before starting Night (Day {gameState.DayNumber + 1})");
        
        // Примечание: ProcessGameTimers автоматически перейдет к StartNight через 10 секунд
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

        // Уведомляем клиентов о начале ночи
        await _hubContext.Clients.Group(room.Id).SendAsync("NightStarted", new
        {
            dayNumber = gameState.DayNumber
        });

        // Определяем первую ночную фазу
        var nextPhase = GetNextNightPhase(room, null);
        
        if (nextPhase == null)
        {
            // Если ночных фаз нет (нет активных ролей) - сразу итоги
            await ProcessNightResults(room);
        }
        else
        {
            // Запускаем первую фазу
            await StartNightPhase(room, nextPhase.Value);
        }

        // Отключаем микрофон и видео на ночь
        await _videoCallService.MuteAllAudioAsync(room.Id);
        await _videoCallService.MuteAllVideoAsync(room.Id);
    }

    private async Task AdvanceNight(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;

        // Если CurrentNightPhase == null, значит это задержка после ProcessNightResults. Переходим к дню.
        if (gameState.CurrentNightPhase == null)
        {
            _logger.LogInformation($"[Room {room.Id}] Night delay ended -> Starting IndividualSpeech (Day {gameState.DayNumber})");
            await StartIndividualSpeech(room);
            return;
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
            await StartNightPhase(room, nextPhase.Value);
        }
    }

    private async Task StartNightPhase(RoomDTO room, NightPhase phase)
    {
        var gameState = room.CurrentGameState!;
        var settings = GetGameSettings(room);
        
        gameState.CurrentNightPhase = phase;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = settings.NightActionTime;

        // Формируем список живых игроков для выбора цели
        var alivePlayers = room.Users
            .Where(u => u.Status != UserStatus.Leave && u.IsAlive && room.PlayerRoles!.ContainsKey(u.Id))
            .Select(u => new
            {
                userId = u.Id,
                userName = u.Name
            })
            .ToList();

        await _hubContext.Clients.Group(room.Id).SendAsync("NightPhaseChanged", new
        {
            nightPhase = phase.ToString(),
            timeSeconds = settings.NightActionTime,
            aliveTargets = alivePlayers
        });
        
        // Отправляем немедленное обновление таймера
        await _hubContext.Clients.Group(room.Id).SendAsync("TimerUpdate", new
        {
            phase = gameState.Phase.ToString(),
            timeLeft = settings.NightActionTime,
            isPaused = false,
            nightPhase = phase.ToString()
        });
    }

    private NightPhase? GetNextNightPhase(RoomDTO room, NightPhase? currentPhase)
    {
        var availableRoles = room.PlayerRoles!.Values.Distinct().ToList();
        var alivePlayers = room.Users.Where(u => u.Status != UserStatus.Leave && u.IsAlive).ToList();
        var aliveRoles = alivePlayers
            .Where(u => room.PlayerRoles.ContainsKey(u.Id))
            .Select(u => room.PlayerRoles[u.Id])
            .ToHashSet();

        _logger.LogInformation($"[Room {room.Id}] GetNextNightPhase: currentPhase={currentPhase}, DonHasFoundSheriff={room.CurrentGameState!.DonHasFoundSheriff}");
        _logger.LogInformation($"[Room {room.Id}] Alive players ({alivePlayers.Count}): {string.Join(", ", alivePlayers.Select(p => $"{p.Name} ({room.PlayerRoles.GetValueOrDefault(p.Id)})"))}");
        _logger.LogInformation($"[Room {room.Id}] Alive roles set: {string.Join(", ", aliveRoles)}");

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
                    // Дон просыпается отдельно ТОЛЬКО для поиска Шерифа, если:
                    // 1. Дон жив
                    // 2. Еще не нашел Шерифа
                    // 3. Шериф есть в игре
                    var sheriffInGame = availableRoles.Contains(Role.Sheriff);
                    var donNeedsToSearch = aliveRoles.Contains(Role.Don) && !room.CurrentGameState!.DonHasFoundSheriff && sheriffInGame;
                    
                    if (donNeedsToSearch)
                    {
                        // Дон должен найти Шерифа - отдельная фаза Don
                        _logger.LogInformation($"[Room {room.Id}] Selected night phase: Don (searching for Sheriff)");
                        return phase;
                    }
                    // Если Дон уже нашел Шерифа или Шерифа нет - пропускаем фазу Don
                    // Дон проснется в фазе Mafia вместе с другими
                    _logger.LogInformation($"[Room {room.Id}] Skipping Don phase - already found Sheriff or Sheriff not in game");
                    break;
                
                case NightPhase.Mafia:
                    // Проверяем есть ли живые злые
                    var evilRoles = aliveRoles.Where(r => RoleInfo.GetTeam(r) == Team.Evil).ToList();
                    
                    if (evilRoles.Count == 0)
                    {
                        // Нет живых злых - пропускаем фазу
                        break;
                    }
                    
                    // Фаза Мафии активна всегда, когда есть злые (включая Дона)
                    // Дон ВСЕГДА просыпается вместе с мафией для голосования за жертву
                    _logger.LogInformation($"[Room {room.Id}] Selected night phase: Mafia (evil count: {evilRoles.Count}, Don included)");
                    return phase;
                
                case NightPhase.Maniac:
                    if (aliveRoles.Contains(Role.Maniac))
                    {
                        _logger.LogInformation($"[Room {room.Id}] Selected night phase: Maniac");
                        return phase;
                    }
                    break;
                
                case NightPhase.Sheriff:
                    if (aliveRoles.Contains(Role.Sheriff))
                    {
                        _logger.LogInformation($"[Room {room.Id}] Selected night phase: Sheriff");
                        return phase;
                    }
                    break;
                
                case NightPhase.Doctor:
                    if (aliveRoles.Contains(Role.Doctor))
                    {
                        _logger.LogInformation($"[Room {room.Id}] Selected night phase: Doctor");
                        return phase;
                    }
                    break;
                
                case NightPhase.Prostitute:
                    if (aliveRoles.Contains(Role.Prostitute))
                    {
                        _logger.LogInformation($"[Room {room.Id}] Selected night phase: Prostitute");
                        return phase;
                    }
                    break;
            }
        }

        _logger.LogInformation($"[Room {room.Id}] No more night phases - ending night");
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
            // Если путану убили, её цель тоже умирает (и лишается защиты путаны)
            if (prostituteTarget != null)
            {
                protectedPlayers.Remove(prostituteTarget);
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

        // Ждем 5 секунд перед началом дня, чтобы игроки успели увидеть результаты ночи
        gameState.Phase = GamePhase.Night; // Остаемся в ночной фазе
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = 5; // 5 секунд задержки (сокращено для быстрого геймплея)
        gameState.CurrentNightPhase = null; // Обнуляем ночную фазу

        _logger.LogInformation($"[Room {room.Id}] Night completed, waiting 5 seconds before starting IndividualSpeech (Day {gameState.DayNumber})");
        
        // Отправляем немедленное обновление таймера чтобы фронтенд обновился
        await _hubContext.Clients.Group(room.Id).SendAsync("TimerUpdate", new
        {
            phase = gameState.Phase.ToString(),
            timeLeft = gameState.PhaseTimeSeconds,
            isPaused = false,
            nightPhase = (string?)null // Сбрасываем ночную фазу
        });
        
        // Примечание: ProcessGameTimers автоматически перейдет к StartIndividualSpeech через 5 секунд
    }

    private async Task StartIndividualSpeech(RoomDTO room)
    {
        var gameState = room.CurrentGameState!;
        var settings = GetGameSettings(room);
        
        _logger.LogInformation($"[Room {room.Id}] StartIndividualSpeech called. Day: {gameState.DayNumber}");
        
        gameState.Phase = GamePhase.IndividualSpeech;
        gameState.HasSpoken.Clear();
        gameState.CurrentSpeakerIndex = 0;
        gameState.PhaseStartTime = DateTime.UtcNow;
        gameState.PhaseTimeSeconds = settings.IndividualSpeechTime;

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
            timeSeconds = settings.IndividualSpeechTime,
            dayNumber = gameState.DayNumber
        });

        // Включаем медиа всем после ночи
        await _videoCallService.UnmuteAllVideoAsync(room.Id);
        await _videoCallService.UnmuteAllAudioAsync(room.Id);
    }

    private async Task EndGame(RoomDTO room, Team winner)
    {
        // Не завершаем игру сразу, даем 10 секунд фазы GameOver, 
        // чтобы все клиенты успели получить обновление фазы через таймер
        // room.Status = GameStatus.Finished; <-- Убрали немедленное завершение
        
        room.CurrentGameState!.Phase = GamePhase.GameOver;
        room.CurrentGameState.PhaseStartTime = DateTime.UtcNow;
        room.CurrentGameState.PhaseTimeSeconds = 10; // 10 секунд показываем Game Over перед полным стопом
        
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
        
        // Статус изменим позже в AdvancePhase
        // await _hubContext.Clients.Group(room.Id).SendAsync("GameStatusChanged", new { status = room.Status.ToString() });

        // Включаем медиа всем после игры
        await _videoCallService.UnmuteAllAudioAsync(room.Id);
        await _videoCallService.UnmuteAllVideoAsync(room.Id);
    }
}

