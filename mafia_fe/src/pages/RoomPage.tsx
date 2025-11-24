import { useState, useEffect } from "react";
import { Chat } from "../components/Chat";
import { type User } from "../services/chatService";
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

  // Проверяем localStorage при загрузке компонента
  useEffect(() => {
    const checkExistingRoom = async () => {
      const savedState = loadRoomState();
      if (!savedState) return;

      // Проверяем, существует ли комната на сервере
      try {
        const response = await fetch(`${API_URL}/api/Room/my?userId=${savedState.userId}`);
        if (response.ok) {
          const data: Room = await response.json();
          setRoom(data);
          setUserId(savedState.userId);
          setUserName(savedState.userName);
          // Инициализируем список пользователей
          setUsers(data.users.filter(u => u.status !== "Leave"));
        } else {
          // Комната не найдена, очищаем localStorage
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
      
      // Сохраняем в localStorage
      saveRoomState({
        roomId: data.id,
        userId: data.users[0].id,
        userName: userName,
        roomName: data.name,
        inviteCode: data.inviteCode,
      });

      // Инициализируем список пользователей
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
        
        // Сохраняем в localStorage
        saveRoomState({
          roomId: data.id,
          userId: user.id,
          userName: userName,
          roomName: data.name,
          inviteCode: data.inviteCode,
        });

        // Инициализируем список пользователей
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

    const confirmLeave = window.confirm("Вы уверены, что хотите покинуть комнату?");
    if (!confirmLeave) return;

    try {
      const response = await fetch(`${API_URL}/api/Room/leave?userId=${userId}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to leave room");
      }

      // Очищаем состояние
      clearRoomState();
      setRoom(null);
      setUserId(null);
      setUserName("");
      setUsers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    }
  };

  if (room && userId) {
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "row",
        height: "100vh", 
        padding: "20px",
        gap: "20px",
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        {/* Левая панель - информация о комнате и список пользователей */}
        <div style={{ 
          width: "300px", 
          display: "flex", 
          flexDirection: "column",
          gap: "20px"
        }}>
          {/* Информация о комнате */}
          <div style={{
            padding: "20px",
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ margin: 0, marginBottom: "12px", fontSize: "20px" }}>
              {room.name}
            </h2>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#666", fontSize: "14px" }}>Код приглашения:</span>
              <div style={{ 
                marginTop: "4px",
                padding: "8px",
                background: "#f5f5f5",
                borderRadius: "4px",
                fontWeight: "bold",
                fontSize: "18px",
                textAlign: "center",
                letterSpacing: "2px"
              }}>
                {room.inviteCode}
              </div>
            </div>
            <button
              onClick={handleLeaveRoom}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "10px",
                background: "#f44336",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              Покинуть комнату
            </button>
          </div>

          {/* Список пользователей */}
          <div style={{
            padding: "20px",
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            flex: 1,
            overflowY: "auto"
          }}>
            <h3 style={{ margin: 0, marginBottom: "12px", fontSize: "16px" }}>
              Участники ({users.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    padding: "10px",
                    background: user.id === userId ? "#e3f2fd" : "#f5f5f5",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <div style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#4caf50"
                  }}></div>
                  <span style={{ 
                    fontSize: "14px",
                    fontWeight: user.id === userId ? "bold" : "normal"
                  }}>
                    {user.name}
                    {user.id === userId && " (вы)"}
                    {user.status === "Admin" && " 👑"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Правая панель - чат */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chat 
            roomId={room.id} 
            userId={userId} 
            userName={userName} 
            apiUrl={API_URL}
            onUserListUpdate={setUsers}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      padding: "20px"
    }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "400px", 
        padding: "30px", 
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
        <h1 style={{ marginTop: 0, marginBottom: "24px", textAlign: "center" }}>
          Игра в Мафию
        </h1>

        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              setMode("create");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              background: mode === "create" ? "#2196f3" : "#f5f5f5",
              color: mode === "create" ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Создать комнату
          </button>
          <button
            onClick={() => {
              setMode("join");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              background: mode === "join" ? "#2196f3" : "#f5f5f5",
              color: mode === "join" ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Присоединиться
          </button>
        </div>

        {error && (
          <div style={{ 
            padding: "12px", 
            background: "#ffebee", 
            color: "#c62828",
            borderRadius: "4px",
            marginBottom: "20px",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        <form onSubmit={mode === "create" ? handleCreateRoom : handleJoinRoom}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontSize: "14px",
              fontWeight: "500"
            }}>
              Ваше имя:
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Введите ваше имя"
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {mode === "create" ? (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ 
                display: "block", 
                marginBottom: "8px", 
                fontSize: "14px",
                fontWeight: "500"
              }}>
                Название комнаты:
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Введите название комнаты"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ 
                display: "block", 
                marginBottom: "8px", 
                fontSize: "14px",
                fontWeight: "500"
              }}>
                Код приглашения:
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Введите код приглашения"
                required
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  textTransform: "uppercase"
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#ccc" : "#2196f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Загрузка..." : mode === "create" ? "Создать" : "Присоединиться"}
          </button>
        </form>
      </div>
    </div>
  );
}
