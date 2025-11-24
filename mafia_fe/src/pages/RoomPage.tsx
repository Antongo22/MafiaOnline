import { useState, useEffect } from "react";
import { Chat } from "../components/Chat";
import { type User, chatService } from "../services/chatService";
import { saveRoomState, loadRoomState, clearRoomState } from "../utils/storage";

interface Room {
  id: string;
  name: string;
  inviteCode: string;
  users: Array<{ id: string; name: string; status: string }>;
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
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const isAdmin = room && userId && room.users.find(u => u.id === userId)?.status === "Admin";

  // Проверяем localStorage при загрузке компонента
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

      // Если комната расформирована, уведомляем всех через SignalR
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

    setKickingUserId(targetUserId);

    try {
      const response = await fetch(`${API_URL}/api/Room/kick?adminId=${userId}&targetUserId=${targetUserId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to kick player");
      }

      // Уведомляем через SignalR
      await chatService.kickPlayer(room.id, userId, targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick player");
    } finally {
      setKickingUserId(null);
    }
  };

  const copyInviteCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.inviteCode);
      // Можно добавить уведомление
    }
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
          flexShrink: 0
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
                      transition: "var(--transition)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--success)",
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
                      </span>
                    </div>
                    {isAdmin && !isCurrentUser && (
                      <button
                        onClick={() => handleKickPlayer(user.id)}
                        disabled={kickingUserId === user.id}
                        className="btn-danger btn-sm"
                        style={{ 
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          flexShrink: 0
                        }}
                        title="Исключить игрока"
                      >
                        {kickingUserId === user.id ? "..." : "✕"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Правая панель - чат */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Chat 
            roomId={room.id} 
            userId={userId} 
            userName={userName} 
            apiUrl={API_URL}
            onUserListUpdate={setUsers}
          />
        </div>

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
