import { useState, useEffect } from "react";
import { Chat } from "../components/Chat";
import { MafiaChat } from "../components/MafiaChat";
import { AdminPanel } from "../components/AdminPanel";
import { RoleDisplay } from "../components/RoleDisplay";
import { GamePhaseDisplay } from "../components/GamePhaseDisplay";
import { VotingPanel } from "../components/VotingPanel";
import { NightActionPanel } from "../components/NightActionPanel";
import { type User, chatService } from "../services/chatService";
import { gameService } from "../services/gameService";
import { GamePhase } from "../types/game";
import { saveRoomState, loadRoomState, clearRoomState } from "../utils/storage";

interface Room {
  id: string;
  name: string;
  inviteCode: string;
  users: Array<{ id: string; name: string; status: string }>;
  status: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5141";

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
  const [nightPhase, setNightPhase] = useState<string | undefined>();
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [gameCycleStarted, setGameCycleStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
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
      setRevealedRoles(rolesData);
    };

    const handleGameReset = () => {
      setMyRole(null);
      setRevealedRoles({});
      setGameStatus("Created");
      setGameCycleStarted(false);
      setGamePhase(GamePhase.Lobby);
    };

    // Game cycle events
    const handleTimerUpdate = (data: { phase: string; timeLeft: number; isPaused?: boolean }) => {
      setTimeLeft(data.timeLeft);
      setGamePhase(data.phase);
      setIsPaused(data.isPaused || false);
    };

    const handleGameCycleStarted = (data: any) => {
      setGameCycleStarted(true);
      setGamePhase(GamePhase.IndividualSpeech);
      setCurrentSpeakerName(data.speakerName);
      setDayNumber(1);
      showAlert("🎮 Игра начинается! Индивидуальные выступления.", "success");
    };

    const handleSpeakerChanged = (data: { speakerName: string }) => {
      setCurrentSpeakerName(data.speakerName);
      showAlert(`🎤 Сейчас говорит: ${data.speakerName}`, "info");
    };

    const handlePhaseChanged = (data: { phase: string }) => {
      setGamePhase(data.phase);
      setCurrentSpeakerName(undefined);
      
      if (data.phase === "FreeDiscussion") {
        showAlert("💬 Свободное обсуждение начато!", "info");
      }
    };

    const handleVotingStarted = (data: { voterName: string; voterId: string }) => {
      setGamePhase(GamePhase.Voting);
      setCurrentVoterName(data.voterName);
      setCurrentVoterId(data.voterId);
      showAlert("🗳️ Голосование началось!", "warning");
    };

    const handleVoterChanged = (data: { voterName: string; voterId: string }) => {
      setCurrentVoterName(data.voterName);
      setCurrentVoterId(data.voterId);
      if (data.voterId === userId) {
        showAlert("⏰ Ваш ход голосовать!", "warning");
      }
    };

    const handleVoteReceived = () => {
      // Голос получен
    };

    const handleVotingResults = (data: { votes: Record<string, string>; eliminated: Array<{ userName: string; role: string }> }) => {
      if (data.eliminated.length > 0) {
        const names = data.eliminated.map(e => `${e.userName} (${e.role})`).join(", ");
        showAlert(`☠️ Выбыли: ${names}`, "danger");
      } else {
        showAlert("Никто не был исключён", "info");
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

    const handleNightResults = (data: { killed: Array<{ userName: string; role: string }>; saved: string[] }) => {
      if (data.killed.length > 0) {
        const names = data.killed.map(k => `${k.userName} (${k.role})`).join(", ");
        showAlert(`☠️ Этой ночью погибли: ${names}`, "danger");
      } else {
        showAlert("🌅 Эта ночь прошла спокойно", "success");
      }
    };

    const handleCardRevealed = (data: { targetId: string; role: string; reason: string }) => {
      setRevealedRoles(prev => ({ ...prev, [data.targetId]: data.role }));
      const targetName = users.find(u => u.id === data.targetId)?.name;
      showAlert(`🔍 Карта раскрыта: ${targetName} - ${data.role}`, "info");
    };

    const handleGameOver = (data: { winner: string; roles: Record<string, string> }) => {
      setGamePhase(GamePhase.GameOver);
      setRevealedRoles(data.roles);
      
      const winnerNames: Record<string, string> = {
        Good: "Мирные жители",
        Evil: "Мафия",
        Neutral: "Маньяк"
      };
      
      showAlert(`🎉 Победили: ${winnerNames[data.winner] || data.winner}!`, "success");
    };

    const handleGamePaused = (data: { pausedBy: string }) => {
      setIsPaused(true);
      showAlert(`⏸️ Игра поставлена на паузу админом ${data.pausedBy}`, "warning");
    };

    const handleGameResumed = (data: { resumedBy: string }) => {
      setIsPaused(false);
      showAlert(`▶️ Игра продолжена админом ${data.resumedBy}`, "success");
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
    chatService.onVotingResults(handleVotingResults);
    chatService.onNightPhaseChanged(handleNightPhaseChanged);
    chatService.onNightResults(handleNightResults);
    chatService.onCardRevealed(handleCardRevealed);
    chatService.onGameOver(handleGameOver);
    chatService.onGamePaused(handleGamePaused);
    chatService.onGameResumed(handleGameResumed);

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
      chatService.removeVotingResultsHandler(handleVotingResults);
      chatService.removeNightPhaseChangedHandler(handleNightPhaseChanged);
      chatService.removeNightResultsHandler(handleNightResults);
      chatService.removeCardRevealedHandler(handleCardRevealed);
      chatService.removeGameOverHandler(handleGameOver);
      chatService.removeGamePausedHandler(handleGamePaused);
      chatService.removeGameResumedHandler(handleGameResumed);
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
      });

      setUsers(data.users.filter(u => u.status !== "Leave"));
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
        });

        setUsers(data.users.filter(u => u.status !== "Leave"));
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
      const response = await fetch(`${API_URL}/api/Room/kick?adminId=${userId}&targetUserId=${targetUserId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to kick player");
      }

      await chatService.kickPlayer(room.id, userId, targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick player");
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
          users={users}
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
          />

          {/* Список пользователей */}
          <div className="card" style={{
            flex: 1,
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
              <span>👥 Участники</span>
              <span className="badge" style={{ 
                background: "var(--accent-light)",
                color: "var(--accent-primary)"
              }}>
                {users.length}
              </span>
            </h3>
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
                const isDead = user.status === "Dead";
                
                return (
                  <div
                    key={user.id}
                    style={{
                      padding: "0.75rem",
                      background: isCurrentUser ? "var(--accent-light)" : "var(--bg-tertiary)",
                      border: `1px solid ${isCurrentUser ? "var(--accent-primary)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      transition: "var(--transition)",
                      opacity: isDead ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: isDead ? "var(--danger)" : "var(--success)",
                        flexShrink: 0
                      }}></div>
                      <span style={{ 
                        fontSize: "0.875rem",
                        fontWeight: isCurrentUser ? "600" : "normal",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
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
                );
              })}
            </div>
          </div>
        </div>

        {/* Центральная панель - игровой контент */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
          {/* Фаза игры и таймер */}
          {gameCycleStarted && (
            <GamePhaseDisplay
              phase={gamePhase as any}
              timeLeft={timeLeft}
              currentSpeakerName={currentSpeakerName}
              currentVoterName={currentVoterName}
              nightPhase={nightPhase}
              dayNumber={dayNumber}
            />
          )}

          {/* Игровой контент (голосование/ночные действия) */}
          {renderGameContent()}

          {/* Чаты */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Chat 
                roomId={room.id} 
                userId={userId} 
                userName={userName} 
                apiUrl={API_URL}
                onUserListUpdate={setUsers}
              />
            </div>

            {isMafia && gameStatus === "InProgress" && (
              <div style={{ flex: 1, minHeight: 0 }}>
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
    );
  }

  // Login screen (unchanged)
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

