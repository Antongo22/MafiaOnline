import { useState, useEffect } from "react";
import { Chat } from "../components/Chat";
import { MafiaChat } from "../components/MafiaChat";
import { AdminPanel } from "../components/AdminPanel";
import { RoleDisplay } from "../components/RoleDisplay";
import { GamePhaseDisplay } from "../components/GamePhaseDisplay";
import { VotingPanel } from "../components/VotingPanel";
import { NightActionPanel } from "../components/NightActionPanel";
import { VotingResultsDisplay } from "../components/VotingResultsDisplay";
import { NightResultsModal } from "../components/NightResultsModal";
import { VotingResultsModal } from "../components/VotingResultsModal";
import { type User, chatService } from "../services/chatService";
import { gameService } from "../services/gameService";
import { GamePhase, type VoterInfo, type NightResults } from "../types/game";
import { saveRoomState, loadRoomState, clearRoomState } from "../utils/storage";

interface Room {
  id: string;
  name: string;
  inviteCode: string;
  users: Array<{ id: string; name: string; status: string }>;
  status: string;
}

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : "http://localhost:5141";

export function RoomPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("Created");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [revealedRoles, setRevealedRoles] = useState<{ [key: string]: string }>({});
  
  // Game cycle state
  const [gamePhase, setGamePhase] = useState<string>(GamePhase.Lobby);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | undefined>();
  const [currentVoterName, setCurrentVoterName] = useState<string | undefined>();
  const [currentVoterId, setCurrentVoterId] = useState<string | undefined>();
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | undefined>();
  const [nightPhase, setNightPhase] = useState<string | undefined>();
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [gameCycleStarted, setGameCycleStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [winningTeam, setWinningTeam] = useState<string | undefined>();
  const [votingCandidates, setVotingCandidates] = useState<Array<{ userId: string; userName: string }>>([]);
  const [votingResults, setVotingResults] = useState<{
    votesWithNames: Array<{ voterName: string; targetName: string }>;
    voteCounts: Record<string, number>;
    eliminated: Array<{ userName: string; role: string }>;
    tie: boolean;
  } | null>(null);
  
  // Night results modal
  const [nightResultsModal, setNightResultsModal] = useState<{
    isOpen: boolean;
    killed: Array<{ userName: string; role: string }>;
  }>({ isOpen: false, killed: [] });
  
  // Voting results modal
  const [votingResultsModal, setVotingResultsModal] = useState<{
    isOpen: boolean;
    eliminated: Array<{ userName: string; role: string }>;
    tie: boolean;
  }>({ isOpen: false, eliminated: [], tie: false });
  
  // TieBreaker modal
  const [tieBreakerModal, setTieBreakerModal] = useState<{
    isOpen: boolean;
    candidates: Array<{ userId: string; userName: string; role: string | null }>;
  }>({ isOpen: false, candidates: [] });
  
  // Game settings
  const [gameSettings, setGameSettings] = useState({
    individualSpeechTime: 30,
    freeDiscussionTime: 90,
    votingTime: 15,
    nightActionTime: 30,
  });
  
  // Multi-kick selection
  const [selectedPlayersForKick, setSelectedPlayersForKick] = useState<Set<string>>(new Set());
  
  // Alerts
  const [alert, setAlert] = useState<{ message: string; type: "info" | "success" | "warning" | "danger" } | null>(null);

  const isAdmin = room && userId && room.users.find(u => u.id === userId)?.status === "Admin";
  
  const MAFIA_ROLES = ["Don", "Mafia", "Ninja"];
  const isMafia = myRole && MAFIA_ROLES.includes(myRole);
  
  // Show alert function
  const showAlert = (message: string, type: "info" | "success" | "warning" | "danger" = "info") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // Сохраняем состояние игры при изменениях
  useEffect(() => {
    if (room && userId) {
      const savedState = loadRoomState();
      if (savedState) {
        saveRoomState({
          ...savedState,
          myRole: myRole,
          gameStatus: gameStatus,
          winningTeam: winningTeam
        });
      }
    }
  }, [myRole, gameStatus, winningTeam, room, userId]);

  // Проверяем localStorage при загрузке
  useEffect(() => {
    const checkExistingRoom = async () => {
      const savedState = loadRoomState();
      if (!savedState) return;

      try {
        const response = await fetch(`${API_URL}/api/Room/my?userId=${savedState.userId}`);
        if (response.ok) {
          const data: Room = await response.json();
          setRoom(data);
          setUserId(savedState.userId);
          setUserName(savedState.userName);
          setUsers(data.users.filter(u => u.status !== "Leave"));
          setGameStatus(data.status);
          
          // Восстанавливаем роль из localStorage
          if (savedState.myRole) {
            setMyRole(savedState.myRole);
          }
          
          // Восстанавливаем информацию о победителе
          if (savedState.winningTeam) {
            setWinningTeam(savedState.winningTeam);
          }

          // Подключаемся к SignalR
          try {
            await chatService.connect(API_URL);
            await chatService.joinRoom(data.id, savedState.userId);
          } catch (signalRError) {
            console.error("Failed to connect to SignalR:", signalRError);
          }

          // Загружаем роль игрока
          if (data.status === "InProgress" || data.status === "Finished") {
            try {
              const roleResponse = await fetch(`${API_URL}/api/Game/my-role?roomId=${data.id}&userId=${savedState.userId}`);
              if (roleResponse.ok) {
                const roleData = await roleResponse.json();
                setMyRole(roleData.role);
                
                // Если игра закончена, загружаем все роли
                if (data.status === "Finished" && roleData.allRoles) {
                  setRevealedRoles(roleData.allRoles);
                }
              }
            } catch (roleError) {
              console.error("Failed to load role:", roleError);
              // Если не удалось загрузить с сервера, используем сохранённое
              if (savedState.myRole) {
                setMyRole(savedState.myRole);
              }
            }
          }

          // Загружаем текущее состояние игры
          try {
            const gameStateResponse = await fetch(`${API_URL}/api/GameCycle/state?roomId=${data.id}`);
            if (gameStateResponse.ok) {
              const gameStateData = await gameStateResponse.json();
              if (gameStateData.isActive) {
                setGameCycleStarted(true);
                setGamePhase(gameStateData.phase);
                setTimeLeft(gameStateData.timeLeft);
                setDayNumber(gameStateData.dayNumber);
                setNightPhase(gameStateData.nightPhase);
                setCurrentSpeakerName(gameStateData.currentSpeakerName);
                setCurrentSpeakerId(gameStateData.currentSpeakerId);
                setCurrentVoterName(gameStateData.currentVoterName);
                setCurrentVoterId(gameStateData.currentVoterId);
                setIsPaused(gameStateData.isPaused);
                
                // Восстанавливаем информацию о победителе, если игра закончена
                if (gameStateData.winningTeam) {
                  setWinningTeam(gameStateData.winningTeam);
                }
              }
            }
          } catch (gameStateError) {
            console.error("Failed to load game state:", gameStateError);
          }
        } else {
          clearRoomState();
        }
      } catch (err) {
        console.error("Failed to check existing room:", err);
        clearRoomState();
      }
    };

    checkExistingRoom();
  }, []);

  // Подписка на все игровые события
  useEffect(() => {
    if (!room || !userId) return;

    // Game status events
    const handleGameStatusChanged = (data: { status: string }) => {
      setGameStatus(data.status);
      if (room) {
        setRoom({ ...room, status: data.status });
      }
      
      if (data.status === "Created") {
        setMyRole(null);
        setRevealedRoles({});
        setGameCycleStarted(false);
        setGamePhase(GamePhase.Lobby);
      }
    };

    const handleRoleAssigned = (data: { userId: string; role: string }) => {
      if (data.userId === userId) {
        setMyRole(data.role);
      }
    };

    const handleAllRolesRevealed = (rolesData: any) => {
      console.log("All roles revealed:", rolesData);
      setRevealedRoles(rolesData);
    };

    const handleGameReset = () => {
      // Сбрасываем роли
      setMyRole(null);
      setRevealedRoles({});
      
      // Сбрасываем статус игры
      setGameStatus("Created");
      setGameCycleStarted(false);
      
      // Сбрасываем фазы
      setGamePhase(GamePhase.Lobby);
      setNightPhase(undefined);
      setDayNumber(1);
      
      // Сбрасываем таймеры и текущие игроки
      setTimeLeft(0);
      setCurrentSpeakerName(undefined);
      setCurrentSpeakerId(undefined);
      setCurrentVoterName(undefined);
      setCurrentVoterId(undefined);
      
      // Сбрасываем результаты и победителей
      setVotingResults(null);
      setWinningTeam(undefined);
      
      // Сбрасываем паузу
      setIsPaused(false);
      
      // Очищаем алерты
      setAlert(null);
      
      // Восстанавливаем всех игроков как живых
      setUsers(prevUsers => 
        prevUsers.map(u => ({ ...u, isAlive: true }))
      );
    };

    // Game cycle events
    const handleTimerUpdate = (data: { phase: string; timeLeft: number; isPaused?: boolean }) => {
      setTimeLeft(data.timeLeft);
      setGamePhase(data.phase);
      setIsPaused(data.isPaused || false);
    };

    const handleGameCycleStarted = (data: any) => {
      // Очищаем предыдущие состояния перед началом новой игры
      setVotingResults(null);
      setWinningTeam(undefined);
      setNightPhase(undefined);
      setCurrentVoterName(undefined);
      setCurrentVoterId(undefined);
      setIsPaused(false);
      
      // Устанавливаем начальное состояние
      const isFirstStart = !gameCycleStarted;
      setGameCycleStarted(true);
      setGamePhase(GamePhase.IndividualSpeech);
      setCurrentSpeakerName(data.speakerName);
      setCurrentSpeakerId(data.speakerId);
      setDayNumber(1);
      setTimeLeft(data.timeSeconds || 30);
      
      // Показываем алерт только при первом старте игры
      if (isFirstStart) {
        showAlert("🎮 Игра начинается! Индивидуальные выступления.", "success");
      }
    };

    const handleSpeakerChanged = (data: { speakerName: string; speakerId: string }) => {
      setCurrentSpeakerName(data.speakerName);
      setCurrentSpeakerId(data.speakerId);
      showAlert(`🎤 Сейчас говорит: ${data.speakerName}`, "info");
    };

    const handlePhaseChanged = (data: { phase: string }) => {
      setGamePhase(data.phase);
      setCurrentSpeakerName(undefined);
      
      // Очищаем результаты голосования при смене фазы
      if (data.phase !== GamePhase.Voting) {
        setVotingResults(null);
      }
      
      if (data.phase === "FreeDiscussion") {
        showAlert("💬 Свободное обсуждение начато!", "info");
      }
    };

    const handleVotingStarted = (data: VoterInfo) => {
      setGamePhase(GamePhase.Voting);
      setCurrentVoterName(data.voterName);
      setCurrentVoterId(data.voterId);
      setVotingCandidates(data.candidates || []); // Сохраняем список живых игроков
      showAlert("🗳️ Голосование началось!", "warning");
    };

    const handleVoterChanged = (data: VoterInfo) => {
      setCurrentVoterName(data.voterName);
      setCurrentVoterId(data.voterId);
      setVotingCandidates(data.candidates || []); // Обновляем список кандидатов
      if (data.voterId === userId) {
        showAlert("⏰ Ваш ход голосовать!", "warning");
      }
    };

    const handleVoteReceived = () => {
      // Голос получен
    };

    const handleAllVotesCompleted = (data: { message: string }) => {
      // Все проголосовали - убираем отображение текущего голосующего
      setCurrentVoterId(undefined);
      showAlert(data.message, "info");
    };

    const handleVotingResults = (data: { 
      votes: Record<string, string>; 
      votesWithNames: Array<{ voterName: string; targetName: string }>;
      voteCounts: Record<string, number>;
      eliminated: Array<{ userId: string; userName: string; role: string }>; 
      tie?: boolean 
    }) => {
      // Сохраняем результаты голосования для отображения
      setVotingResults({
        votesWithNames: data.votesWithNames || [],
        voteCounts: data.voteCounts || {},
        eliminated: data.eliminated || [],
        tie: data.tie || false
      });

      // Показываем модальное окно с результатами голосования
      setVotingResultsModal({
        isOpen: true,
        eliminated: data.eliminated || [],
        tie: data.tie || false
      });

      // Раскрываем роли всех исключённых игроков для всех
      if (data.eliminated && data.eliminated.length > 0) {
        const newRevealedRoles: { [key: string]: string } = {};
        data.eliminated.forEach(e => {
          newRevealedRoles[e.userId] = e.role;
        });
        setRevealedRoles(prev => ({ ...prev, ...newRevealedRoles }));
      }
    };

    const handleNightPhaseChanged = (data: { nightPhase: string }) => {
      setNightPhase(data.nightPhase);
      setGamePhase(GamePhase.Night);
      
      const nightPhaseNames: Record<string, string> = {
        Don: "Дон ищет шерифа",
        Mafia: "Мафия выбирает жертву",
        Maniac: "Маньяк действует",
        Sheriff: "Шериф проверяет",
        Doctor: "Доктор лечит",
        Prostitute: "Путана забирает игрока"
      };
      
      showAlert(`🌙 ${nightPhaseNames[data.nightPhase] || data.nightPhase}`, "info");
    };

    const handleNightResults = (data: NightResults) => {
      console.log("NightResults received:", data);
      
      // Показываем модальное окно с результатами ночи
      setNightResultsModal({
        isOpen: true,
        killed: data.killed || []
      });
      
      // Раскрываем роли всех убитых игроков для всех
      if (data.killed && data.killed.length > 0) {
        const newRevealedRoles: { [key: string]: string } = {};
        data.killed.forEach(k => {
          newRevealedRoles[k.userId] = k.role;
        });
        setRevealedRoles(prev => ({ ...prev, ...newRevealedRoles }));
      }
    };

    const handleCardRevealed = (data: { targetUserId?: string; targetId: string; role: string; reason: string }) => {
      // Показываем карту только если это для текущего пользователя (или если targetUserId не указан)
      if (data.targetUserId && data.targetUserId !== userId) {
        return; // Это не для нас, игнорируем
      }
      
      setRevealedRoles(prev => ({ ...prev, [data.targetId]: data.role }));
      const targetName = users.find(u => u.id === data.targetId)?.name;
      showAlert(`🔍 Карта раскрыта: ${targetName} - ${data.role}`, "info");
    };

    const handleGameOver = (data: { winner: string; roles: Record<string, string> }) => {
      setGamePhase(GamePhase.GameOver);
      setGameStatus("Finished");
      setRevealedRoles(data.roles);
      setWinningTeam(data.winner);
      
      const winnerNames: Record<string, string> = {
        Good: "Мирные жители",
        Evil: "Мафия",
        Neutral: "Маньяк",
        Draw: "Ничья - никого не осталось"
      };
      
      showAlert(`🎉 ${winnerNames[data.winner] || data.winner}!`, "success");
    };

    const handleTieBreakerStarted = (data: { 
      candidates: Array<{ userId: string; userName: string; role: string | null }>; 
      timeSeconds: number 
    }) => {
      setGamePhase(GamePhase.TieBreaker);
      setTieBreakerModal({
        isOpen: true,
        candidates: data.candidates
      });
      showAlert("⚖️ Ничья! Голосуйте: убить всех или помиловать всех", "warning");
    };

    const handleTieBreakerResults = (data: { 
      decision: "kill" | "pardon"; 
      killed?: Array<{ userId: string; userName: string; role: string | null }>;
      spared?: Array<{ userId: string; userName: string; role: string | null }>;
    }) => {
      setTieBreakerModal({ isOpen: false, candidates: [] });
      
      if (data.decision === "kill" && data.killed) {
        // Раскрываем роли убитых
        const newRevealedRoles: { [key: string]: string } = {};
        data.killed.forEach(k => {
          if (k.role) newRevealedRoles[k.userId] = k.role;
        });
        setRevealedRoles(prev => ({ ...prev, ...newRevealedRoles }));
        showAlert(`⚔️ Игроки исключены: ${data.killed.map(k => k.userName).join(", ")}`, "warning");
      } else {
        showAlert(`✅ Игроки помилованы: ${data.spared?.map(s => s.userName).join(", ")}`, "info");
      }
    };

    const handleGamePaused = (data: { pausedBy: string }) => {
      setIsPaused(true);
      showAlert(`⏸️ Игра поставлена на паузу админом ${data.pausedBy}`, "warning");
    };

    const handleGameResumed = (data: { resumedBy: string }) => {
      setIsPaused(false);
      showAlert(`▶️ Игра продолжена админом ${data.resumedBy}`, "success");
    };

    const handlePlayerDied = (data: { userId: string; userName: string; role: string; reason: string }) => {
      // Обновляем список пользователей, помечая игрока как мёртвого
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === data.userId ? { ...u, isAlive: false } : u
        )
      );
    };

    const handlePlayerEliminated = (data: { userId: string; userName: string; role: string; reason: string }) => {
      // Обновляем список пользователей, помечая игрока как мёртвого
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === data.userId ? { ...u, isAlive: false } : u
        )
      );
    };

    // Subscribe
    chatService.onGameStatusChanged(handleGameStatusChanged);
    chatService.onRoleAssigned(handleRoleAssigned);
    chatService.onAllRolesRevealed(handleAllRolesRevealed);
    chatService.onGameReset(handleGameReset);
    chatService.onTimerUpdate(handleTimerUpdate);
    chatService.onGameCycleStarted(handleGameCycleStarted);
    chatService.onSpeakerChanged(handleSpeakerChanged);
    chatService.onPhaseChanged(handlePhaseChanged);
    chatService.onVotingStarted(handleVotingStarted);
    chatService.onVoterChanged(handleVoterChanged);
    chatService.onVoteReceived(handleVoteReceived);
    chatService.onAllVotesCompleted(handleAllVotesCompleted);
    chatService.onVotingResults(handleVotingResults);
    chatService.onNightPhaseChanged(handleNightPhaseChanged);
    chatService.onNightResults(handleNightResults);
    chatService.onCardRevealed(handleCardRevealed);
    chatService.onGameOver(handleGameOver);
    chatService.onGamePaused(handleGamePaused);
    chatService.onGameResumed(handleGameResumed);
    chatService.onPlayerDied(handlePlayerDied);
    chatService.onPlayerEliminated(handlePlayerEliminated);
    chatService.onTieBreakerStarted(handleTieBreakerStarted);
    chatService.onTieBreakerResults(handleTieBreakerResults);

    // Unsubscribe
    return () => {
      chatService.removeGameStatusChangedHandler(handleGameStatusChanged);
      chatService.removeRoleAssignedHandler(handleRoleAssigned);
      chatService.removeAllRolesRevealedHandler(handleAllRolesRevealed);
      chatService.removeGameResetHandler(handleGameReset);
      chatService.removeTimerUpdateHandler(handleTimerUpdate);
      chatService.removeGameCycleStartedHandler(handleGameCycleStarted);
      chatService.removeSpeakerChangedHandler(handleSpeakerChanged);
      chatService.removePhaseChangedHandler(handlePhaseChanged);
      chatService.removeVotingStartedHandler(handleVotingStarted);
      chatService.removeVoterChangedHandler(handleVoterChanged);
      chatService.removeVoteReceivedHandler(handleVoteReceived);
      chatService.removeAllVotesCompletedHandler(handleAllVotesCompleted);
      chatService.removeVotingResultsHandler(handleVotingResults);
      chatService.removeNightPhaseChangedHandler(handleNightPhaseChanged);
      chatService.removeNightResultsHandler(handleNightResults);
      chatService.removeCardRevealedHandler(handleCardRevealed);
      chatService.removeGameOverHandler(handleGameOver);
      chatService.removeGamePausedHandler(handleGamePaused);
      chatService.removeGameResumedHandler(handleGameResumed);
      chatService.removePlayerDiedHandler(handlePlayerDied);
      chatService.removePlayerEliminatedHandler(handlePlayerEliminated);
      chatService.removeTieBreakerStartedHandler(handleTieBreakerStarted);
      chatService.removeTieBreakerResultsHandler(handleTieBreakerResults);
    };
  }, [room, userId, users]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !userName.trim()) {
      setError("Заполните все поля");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/Room/create?roomName=${encodeURIComponent(roomName)}&playerName=${encodeURIComponent(userName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create room");
      }

      const data: Room = await response.json();
      setRoom(data);
      setUserId(data.users[0].id);
      setUserName(userName);
      setGameStatus(data.status || "Created");
      
      saveRoomState({
        roomId: data.id,
        userId: data.users[0].id,
        userName: userName,
        roomName: data.name,
        inviteCode: data.inviteCode,
        myRole: null,
        gameStatus: data.status || "Created"
      });

      setUsers(data.users.filter(u => u.status !== "Leave"));

      // Подключаемся к SignalR
      try {
        await chatService.connect(API_URL);
        await chatService.joinRoom(data.id, data.users[0].id);
      } catch (signalRError) {
        console.error("Failed to connect to SignalR:", signalRError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !userName.trim()) {
      setError("Заполните все поля");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/Room/invite?inviteCode=${encodeURIComponent(inviteCode)}&playerName=${encodeURIComponent(userName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to join room");
      }

      const data: Room = await response.json();
      setRoom(data);
      setGameStatus(data.status || "Created");
      const user = data.users.find((u) => u.name === userName);
      if (user) {
        setUserId(user.id);
        setUserName(userName);
        
        saveRoomState({
          roomId: data.id,
          userId: user.id,
          userName: userName,
          roomName: data.name,
          inviteCode: data.inviteCode,
          myRole: null,
          gameStatus: data.status || "Created"
        });

        setUsers(data.users.filter(u => u.status !== "Leave"));

        // Подключаемся к SignalR
        try {
          await chatService.connect(API_URL);
          await chatService.joinRoom(data.id, user.id);
        } catch (signalRError) {
          console.error("Failed to connect to SignalR:", signalRError);
        }

        // Загружаем роль игрока
        if (data.status === "InProgress" || data.status === "Finished") {
          try {
            const roleResponse = await fetch(`${API_URL}/api/Game/my-role?roomId=${data.id}&userId=${user.id}`);
            if (roleResponse.ok) {
              const roleData = await roleResponse.json();
              setMyRole(roleData.role);
              
              // Если игра закончена, загружаем все роли
              if (data.status === "Finished" && roleData.allRoles) {
                setRevealedRoles(roleData.allRoles);
              }
            }
          } catch (roleError) {
            console.error("Failed to load role:", roleError);
          }
        }

        // Загружаем текущее состояние игры если она уже идёт
        if (data.status === "InProgress") {
          try {
            const gameStateResponse = await fetch(`${API_URL}/api/GameCycle/state?roomId=${data.id}`);
            if (gameStateResponse.ok) {
              const gameStateData = await gameStateResponse.json();
              if (gameStateData.isActive) {
                setGameCycleStarted(true);
                setGamePhase(gameStateData.phase);
                setTimeLeft(gameStateData.timeLeft);
                setDayNumber(gameStateData.dayNumber);
                setNightPhase(gameStateData.nightPhase);
                setCurrentSpeakerName(gameStateData.currentSpeakerName);
                setCurrentSpeakerId(gameStateData.currentSpeakerId);
                setCurrentVoterName(gameStateData.currentVoterName);
                setCurrentVoterId(gameStateData.currentVoterId);
                setIsPaused(gameStateData.isPaused);
              }
            }
          } catch (gameStateError) {
            console.error("Failed to load game state:", gameStateError);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!userId || !room) return;

    const message = isAdmin 
      ? "Вы админ! При выходе комната будет расформирована. Продолжить?" 
      : "Вы уверены, что хотите покинуть комнату?";
    
    const confirmLeave = window.confirm(message);
    if (!confirmLeave) return;

    try {
      const response = await fetch(`${API_URL}/api/Room/leave?userId=${userId}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to leave room");
      }

      const result = await response.json();

      if (result.disbanded && room) {
        await chatService.disbandRoom(room.id);
      }

      clearRoomState();
      setRoom(null);
      setUserId(null);
      setUserName("");
      setUsers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    }
  };

  const handleKickPlayer = async (targetUserId: string) => {
    if (!userId || !room || !isAdmin) return;

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

    const confirmKick = window.confirm(`Исключить игрока ${targetUser.name}?`);
    if (!confirmKick) return;

    try {
      const response = await fetch(`${API_URL}/api/Room/kick?adminId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([targetUserId]),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to kick player");
      }

      await chatService.kickPlayers(room.id, userId, [targetUserId]);
      setSelectedPlayersForKick(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick player");
    }
  };

  const handleKickSelectedPlayers = async () => {
    if (!userId || !room || !isAdmin || selectedPlayersForKick.size === 0) return;

    const selectedArray = Array.from(selectedPlayersForKick);
    const selectedNames = selectedArray.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(", ");
    
    const confirmKick = window.confirm(`Исключить выбранных игроков: ${selectedNames}?`);
    if (!confirmKick) return;

    try {
      const response = await fetch(`${API_URL}/api/Room/kick?adminId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedArray),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to kick players");
      }

      await chatService.kickPlayers(room.id, userId, selectedArray);
      setSelectedPlayersForKick(new Set());
      showAlert(`Исключены: ${selectedNames}`, "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick players");
    }
  };

  const handleTieBreakerVote = async (killAll: boolean) => {
    if (!room || !userId) return;
    
    try {
      await gameService.tieBreakerVote(room.id, userId, killAll);
      setTieBreakerModal({ isOpen: false, candidates: [] });
      showAlert(`Ваш голос: ${killAll ? "Убить всех" : "Помиловать всех"}`, "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote in tie breaker");
    }
  };

  const handleSaveGameSettings = async () => {
    if (!room || !userId || !isAdmin) return;
    
    try {
      await gameService.saveGameSettings(room.id, userId, gameSettings);
      showAlert("Настройки сохранены", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save game settings");
    }
  };

  const copyInviteCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.inviteCode);
      showAlert("Код скопирован!", "success");
    }
  };

  const handleGameStatusChange = (newStatus: string) => {
    setGameStatus(newStatus);
    if (room) {
      setRoom({ ...room, status: newStatus });
    }
  };

  // Game cycle actions
  const handleVote = async (targetId: string) => {
    if (!room || !userId) return;
    
    try {
      await gameService.vote(room.id, userId, targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    }
  };

  const handleNightAction = async (targetId?: string, actionType?: string) => {
    if (!room || !userId) return;
    
    try {
      await gameService.nightAction(room.id, userId, { targetId, actionType });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to perform night action");
    }
  };

  // Determine which component to show based on game phase
  const renderGameContent = () => {
    if (gamePhase === GamePhase.Voting) {
      return (
        <VotingPanel
          candidates={votingCandidates}
          currentUserId={userId!}
          isMyTurn={currentVoterId === userId}
          onVote={handleVote}
        />
      );
    }

    if (gamePhase === GamePhase.Night && nightPhase) {
      // Check if it's my turn based on my role and current night phase
      let canAct = false;
      if (myRole) {
        const roleNightPhaseMap: Record<string, string> = {
          Don: "Don",
          Mafia: "Mafia",
          Ninja: "Mafia", // Ninja acts with Mafia
          Maniac: "Maniac",
          Sheriff: "Sheriff",
          Doctor: "Doctor",
          Prostitute: "Prostitute"
        };
        
        canAct = roleNightPhaseMap[myRole] === nightPhase;
      }

      return (
        <NightActionPanel
          users={users}
          currentUserId={userId!}
          nightPhase={nightPhase}
          onAction={handleNightAction}
          canAct={canAct}
        />
      );
    }

    return null;
  };

  if (room && userId) {
    return (
      <>
        {/* Модальное окно результатов ночи - рендерим вне основного контейнера */}
        <NightResultsModal
          isOpen={nightResultsModal.isOpen}
          killed={nightResultsModal.killed}
          onClose={() => setNightResultsModal({ isOpen: false, killed: [] })}
        />
        
        {/* Модальное окно результатов голосования */}
        <VotingResultsModal
          isOpen={votingResultsModal.isOpen}
          eliminated={votingResultsModal.eliminated}
          tie={votingResultsModal.tie}
          onClose={() => setVotingResultsModal({ isOpen: false, eliminated: [], tie: false })}
        />
        
        {/* Модальное окно разрешения ничьей */}
        {tieBreakerModal.isOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "1rem"
          }}>
            <div style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius-lg)",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)"
            }}>
              <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>⚖️ Разрешение ничьей</h2>
              <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                Несколько игроков получили одинаковое количество голосов:
              </p>
              <ul style={{ marginBottom: "1.5rem", paddingLeft: "1.5rem" }}>
                {tieBreakerModal.candidates.map(c => (
                  <li key={c.userId} style={{ marginBottom: "0.5rem" }}>
                    <strong>{c.userName}</strong> {c.role && `(${c.role})`}
                  </li>
                ))}
              </ul>
              <p style={{ marginBottom: "1.5rem", fontWeight: "bold" }}>
                Что делаем?
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button
                  onClick={() => handleTieBreakerVote(true)}
                  className="btn-danger"
                  style={{ flex: 1, padding: "1rem", fontSize: "1rem" }}
                >
                  ⚔️ Убить всех
                </button>
                <button
                  onClick={() => handleTieBreakerVote(false)}
                  className="btn-success"
                  style={{ flex: 1, padding: "1rem", fontSize: "1rem" }}
                >
                  ✅ Помиловать всех
                </button>
              </div>
            </div>
          </div>
        )}
        
        
        <div className="fade-in" style={{ 
          display: "flex", 
          flexDirection: "row",
          height: "100vh", 
          padding: "1.5rem",
          gap: "1.5rem",
          maxWidth: "1600px",
          margin: "0 auto",
          overflow: "hidden"
        }}>
        {/* Левая панель */}
        <div style={{ 
          width: "320px", 
          display: "flex", 
          flexDirection: "column",
          gap: "1rem",
          flexShrink: 0,
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "100vh",
          paddingRight: "0.5rem"
        }}>
          {/* Информация о комнате */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: 0, marginBottom: "0.5rem", fontSize: "1.5rem" }}>
                {room.name}
              </h2>
              {isAdmin && (
                <span className="badge badge-success">Вы админ 👑</span>
              )}
            </div>
            
            <div>
              <label style={{ 
                display: "block", 
                color: "var(--text-secondary)", 
                fontSize: "0.875rem",
                marginBottom: "0.5rem"
              }}>
                Код приглашения
              </label>
              <div style={{ 
                display: "flex",
                gap: "0.5rem"
              }}>
                <div style={{ 
                  flex: 1,
                  padding: "0.75rem",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontWeight: "bold",
                  fontSize: "1.25rem",
                  textAlign: "center",
                  letterSpacing: "3px",
                  color: "var(--accent-primary)"
                }}>
                  {room.inviteCode}
                </div>
                <button
                  onClick={copyInviteCode}
                  className="btn-secondary btn-sm"
                  title="Копировать код"
                  style={{ padding: "0.75rem" }}
                >
                  📋
                </button>
              </div>
            </div>

            <button
              onClick={handleLeaveRoom}
              className="btn-danger w-full"
            >
              {isAdmin ? "🚪 Расформировать комнату" : "🚪 Покинуть комнату"}
            </button>
          </div>

          {/* Админ-панель */}
          {isAdmin && (
            <AdminPanel
              roomId={room.id}
              userId={userId}
              gameStatus={gameStatus}
              playerCount={users.length}
              apiUrl={API_URL}
              onStatusChange={handleGameStatusChange}
              gameCycleStarted={gameCycleStarted}
              isPaused={isPaused}
            />
          )}

          {/* Отображение ролей */}
          <RoleDisplay
            myRole={myRole}
            revealedRoles={revealedRoles}
            gameStatus={gameStatus}
            users={users}
          />

          {/* Список пользователей */}
          <div className="card" style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{ 
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem"
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: "1.125rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <span>👥 Участники</span>
                <span className="badge" style={{ 
                  background: "var(--accent-light)",
                  color: "var(--accent-primary)"
                }}>
                  {users.length}
                </span>
              </h3>
              {isAdmin && gamePhase === GamePhase.Lobby && selectedPlayersForKick.size > 0 && (
                <button
                  onClick={handleKickSelectedPlayers}
                  className="btn-danger btn-sm"
                  style={{ padding: "0.5rem" }}
                >
                  Исключить выбранных ({selectedPlayersForKick.size})
                </button>
              )}
            </div>
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "0.5rem",
              overflowY: "auto",
              paddingRight: "0.5rem"
            }}>
              {users.map((user) => {
                const isCurrentUser = user.id === userId;
                const isUserAdmin = user.status === "Admin";
                const isDead = user.isAlive === false;
                const isActivePlayer = 
                  (gamePhase === GamePhase.IndividualSpeech && user.id === currentSpeakerId) ||
                  (gamePhase === GamePhase.Voting && user.id === currentVoterId);
                
                // Показываем роль, если игрок мёртв или его карта раскрыта
                const revealedRole = revealedRoles[user.id];
                const shouldShowRole = isDead || revealedRole;
                
                return (
                  <div
                    key={user.id}
                    style={{
                      padding: "0.75rem",
                      background: isActivePlayer 
                        ? "var(--warning)" 
                        : isCurrentUser 
                          ? "var(--accent-light)" 
                          : "var(--bg-tertiary)",
                      border: `2px solid ${
                        isActivePlayer 
                          ? "var(--warning)" 
                          : isCurrentUser 
                            ? "var(--accent-primary)" 
                            : "var(--border)"
                      }`,
                      borderRadius: "var(--radius)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      transition: "var(--transition)",
                      opacity: isDead ? 0.5 : 1,
                      boxShadow: isActivePlayer ? "0 0 20px rgba(251, 191, 36, 0.4)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                        {isAdmin && !isCurrentUser && !isDead && gamePhase === GamePhase.Lobby && (
                          <input
                            type="checkbox"
                            checked={selectedPlayersForKick.has(user.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPlayersForKick);
                              if (e.target.checked) {
                                newSet.add(user.id);
                              } else {
                                newSet.delete(user.id);
                              }
                              setSelectedPlayersForKick(newSet);
                            }}
                            style={{ cursor: "pointer" }}
                          />
                        )}
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: isDead ? "var(--danger)" : "var(--success)",
                          flexShrink: 0
                        }}></div>
                        <span style={{ 
                          fontSize: "0.875rem",
                          fontWeight: isCurrentUser || isActivePlayer ? "600" : "normal",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: isActivePlayer ? "var(--bg-primary)" : "inherit"
                        }}>
                          {isActivePlayer && "▶️ "}
                          {user.name}
                          {isCurrentUser && " (вы)"}
                          {isUserAdmin && " 👑"}
                          {isDead && " ☠️"}
                        </span>
                      </div>
                      {isAdmin && !isCurrentUser && !isDead && gamePhase === GamePhase.Lobby && (
                        <button
                          onClick={() => handleKickPlayer(user.id)}
                          className="btn-danger btn-sm"
                          style={{ 
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            flexShrink: 0
                          }}
                          title="Исключить игрока"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {shouldShowRole && revealedRole && (
                      <div style={{
                        padding: "0.5rem",
                        background: "var(--bg-primary)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}>
                        <span>🎭</span>
                        <span style={{ fontWeight: "500" }}>{revealedRole}</span>
                        {!isDead && <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>(раскрыто)</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Блок настроек игры */}
          {isAdmin && gamePhase === GamePhase.Lobby && (
            <div className="card" style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}>
              <h3 style={{ 
                margin: 0, 
                marginBottom: "1rem", 
                fontSize: "1.125rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <span>⚙️ Настройки игры</span>
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.875rem" }}>
                    Время на индивидуальное выступление (секунды)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={gameSettings.individualSpeechTime}
                    onChange={(e) => setGameSettings({ ...gameSettings, individualSpeechTime: parseInt(e.target.value) || 30 })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.875rem" }}>
                    Время на свободное обсуждение (секунды)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={gameSettings.freeDiscussionTime}
                    onChange={(e) => setGameSettings({ ...gameSettings, freeDiscussionTime: parseInt(e.target.value) || 90 })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.875rem" }}>
                    Время на голосование (секунды)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={gameSettings.votingTime}
                    onChange={(e) => setGameSettings({ ...gameSettings, votingTime: parseInt(e.target.value) || 15 })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.875rem" }}>
                    Время на ночное действие (секунды)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={gameSettings.nightActionTime}
                    onChange={(e) => setGameSettings({ ...gameSettings, nightActionTime: parseInt(e.target.value) || 30 })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
              </div>
              
              <button
                onClick={handleSaveGameSettings}
                className="btn-primary"
                style={{ 
                  marginTop: "1rem",
                  width: "100%"
                }}
              >
                Сохранить настройки
              </button>
            </div>
          )}
        </div>

        {/* Центральная панель - игровой контент */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          gap: "1rem", 
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "100vh",
          paddingRight: "0.5rem"
        }}>
          {/* Фаза игры и таймер */}
          {gameCycleStarted && (
            <GamePhaseDisplay
              phase={gamePhase as any}
              timeLeft={timeLeft}
              currentSpeakerName={currentSpeakerName}
              currentVoterName={currentVoterName}
              nightPhase={nightPhase}
              dayNumber={dayNumber}
              isMyTurn={
                (gamePhase === GamePhase.IndividualSpeech && currentSpeakerId === userId) ||
                (gamePhase === GamePhase.Voting && currentVoterId === userId)
              }
              winningTeam={winningTeam}
            />
          )}

          {/* Результаты голосования */}
          {votingResults && (
            <VotingResultsDisplay
              votesWithNames={votingResults.votesWithNames}
              voteCounts={votingResults.voteCounts}
              eliminated={votingResults.eliminated}
              tie={votingResults.tie}
            />
          )}

          {/* Игровой контент (голосование/ночные действия) */}
          {renderGameContent()}

          {/* Чаты */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "1rem",
            minHeight: "400px",
            flexShrink: 0
          }}>
            <div style={{ minHeight: "400px" }}>
              <Chat 
                roomId={room.id} 
                userId={userId} 
                userName={userName} 
                apiUrl={API_URL}
                onUserListUpdate={setUsers}
              />
            </div>

            {isMafia && gameStatus === "InProgress" && gamePhase === GamePhase.Night && (
              <div style={{ minHeight: "300px" }}>
                <MafiaChat 
                  roomId={room.id} 
                  userId={userId} 
                  userName={userName} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Alert notification */}
        {alert && (
          <div style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "1rem 1.5rem",
            background: alert.type === "danger" ? "var(--danger)" :
                       alert.type === "warning" ? "var(--warning)" :
                       alert.type === "success" ? "var(--success)" : "var(--info)",
            color: "white",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "400px",
            zIndex: 1000,
            animation: "slideInRight 0.3s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>
                {alert.type === "danger" ? "⚠️" :
                 alert.type === "warning" ? "⚡" :
                 alert.type === "success" ? "✅" : "ℹ️"}
              </span>
              <span>{alert.message}</span>
              <button
                onClick={() => setAlert(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  padding: "0",
                  fontSize: "1.25rem",
                  marginLeft: "auto"
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "1rem 1.5rem",
            background: "var(--danger)",
            color: "white",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "400px",
            zIndex: 1000,
            animation: "fadeIn 0.3s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span>⚠️</span>
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  padding: "0",
                  fontSize: "1.25rem",
                  marginLeft: "auto"
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // Login screen
  return (
    <div className="fade-in" style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      padding: "1.5rem"
    }}>
      <div className="card" style={{ 
        width: "100%", 
        maxWidth: "450px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ 
            margin: 0, 
            marginBottom: "0.5rem",
            fontSize: "2.5rem",
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--info) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            🎭 Мафия
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Создайте комнату или присоединитесь к игре
          </p>
        </div>

        <div style={{ 
          display: "flex", 
          gap: "0.75rem", 
          marginBottom: "1.5rem",
          padding: "0.25rem",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-lg)"
        }}>
          <button
            onClick={() => {
              setMode("create");
              setError(null);
            }}
            className={mode === "create" ? "btn-primary" : "btn-secondary"}
            style={{ 
              flex: 1,
              borderRadius: "var(--radius)"
            }}
          >
            Создать
          </button>
          <button
            onClick={() => {
              setMode("join");
              setError(null);
            }}
            className={mode === "join" ? "btn-primary" : "btn-secondary"}
            style={{ 
              flex: 1,
              borderRadius: "var(--radius)"
            }}
          >
            Присоединиться
          </button>
        </div>

        {error && (
          <div style={{ 
            padding: "1rem", 
            background: "var(--danger-light)", 
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            marginBottom: "1.5rem",
            fontSize: "0.875rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={mode === "create" ? handleCreateRoom : handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "0.5rem", 
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "var(--text-secondary)"
            }}>
              Ваше имя
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Введите ваше имя"
              required
              autoFocus
            />
          </div>

          {mode === "create" ? (
            <div>
              <label style={{ 
                display: "block", 
                marginBottom: "0.5rem", 
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--text-secondary)"
              }}>
                Название комнаты
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Моя игра в мафию"
                required
              />
            </div>
          ) : (
            <div>
              <label style={{ 
                display: "block", 
                marginBottom: "0.5rem", 
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "var(--text-secondary)"
              }}>
                Код приглашения
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                required
                maxLength={6}
                style={{
                  textTransform: "uppercase",
                  fontSize: "1.25rem",
                  letterSpacing: "3px",
                  textAlign: "center"
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            style={{ 
              padding: "1rem",
              fontSize: "1.125rem"
            }}
          >
            {loading ? (
              <>
                <span className="pulse">⏳</span>
                <span>Загрузка...</span>
              </>
            ) : (
              <>
                <span>{mode === "create" ? "🎮" : "🚪"}</span>
                <span>{mode === "create" ? "Создать комнату" : "Присоединиться"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
