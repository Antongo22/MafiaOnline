import { useEffect, useState, useRef } from "react";
import { chatService, type ChatMessage, type User } from "../services/chatService";
import { clearRoomState } from "../utils/storage";

interface ChatProps {
  roomId: string;
  userId: string;
  userName: string;
  apiUrl?: string;
  onUserListUpdate?: (users: User[]) => void;
}

export function Chat({ roomId, userId, userName, apiUrl, onUserListUpdate }: ChatProps) {
  const defaultApiUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : "http://localhost:5141";
  const actualApiUrl = apiUrl || defaultApiUrl;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleHistory = (historyMessages: ChatMessage[]) => {
      setMessages(historyMessages);
    };

    const handleError = (errorMessage: string) => {
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    };

    const handleUserListUpdate = (users: User[]) => {
      if (onUserListUpdate) {
        onUserListUpdate(users);
      }
    };

    const handleUserJoined = (data: { userName: string }) => {
      console.log(`${data.userName} присоединился к комнате`);
    };

    const handleUserLeft = (data: { userName: string }) => {
      console.log(`${data.userName} покинул комнату`);
    };

    const handlePlayerKicked = (data: { kickedUserId: string; kickedUserName: string; kickedBy: string }) => {
      // Если нас кикнули
      if (data.kickedUserId === userId) {
        alert(`Вы были исключены из комнаты админом ${data.kickedBy}`);
        clearRoomState();
        window.location.reload();
      } else {
        // Показываем уведомление о кике другого игрока
        console.log(`${data.kickedUserName} был исключен админом ${data.kickedBy}`);
      }
    };

    const handleRoomDisbanded = () => {
      alert("Комната была расформирована администратором");
      clearRoomState();
      window.location.reload();
    };

    chatService.onMessage(handleMessage);
    chatService.onMessageHistory(handleHistory);
    chatService.onError(handleError);
    chatService.onUserListUpdate(handleUserListUpdate);
    chatService.onUserJoined(handleUserJoined);
    chatService.onUserLeft(handleUserLeft);
    chatService.onPlayerKicked(handlePlayerKicked);
    chatService.onRoomDisbanded(handleRoomDisbanded);

    const connect = async () => {
      try {
        await chatService.connect(actualApiUrl);
        setIsConnected(true);
        setError(null);
        await chatService.joinRoom(roomId, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect");
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      chatService.removeMessageHandler(handleMessage);
      chatService.removeHistoryHandler(handleHistory);
      chatService.removeErrorHandler(handleError);
      chatService.removeUserListHandler(handleUserListUpdate);
      chatService.removeUserJoinedHandler(handleUserJoined);
      chatService.removeUserLeftHandler(handleUserLeft);
      chatService.removePlayerKickedHandler(handlePlayerKicked);
      chatService.removeRoomDisbandedHandler(handleRoomDisbanded);
      // Removed leaveRoom and disconnect to prevent kicking user on mobile view toggle
    };
  }, [roomId, userId, actualApiUrl, onUserListUpdate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected) return;

    try {
      await chatService.sendMessage(roomId, userId, userName, inputMessage.trim());
      setInputMessage("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="card" style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Header */}
      <div style={{
        padding: "1rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0
      }}>
        <h3 style={{
          margin: 0,
          fontSize: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem"
        }}>
          <span>💬</span>
          <span>Чат</span>
        </h3>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
          color: "var(--text-secondary)"
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isConnected ? "var(--success)" : "var(--danger)"
          }}></div>
          <span>{isConnected ? "Онлайн" : "Офлайн"}</span>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div style={{
          padding: "0.75rem",
          background: "var(--danger-light)",
          color: "var(--danger)",
          border: "1px solid var(--danger)",
          borderBottom: "none",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "1rem",
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: "center",
            color: "var(--text-muted)",
            padding: "3rem 1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem"
          }}>
            <span style={{ fontSize: "3rem", opacity: 0.5 }}>💬</span>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.5rem" }}>
                Нет сообщений
              </div>
              <div style={{ fontSize: "0.875rem" }}>
                Начните общение с другими игроками!
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMyMessage = msg.userId === userId;
            const isSystemMessage = msg.userId === "system";

            // Системное сообщение-разделитель
            if (isSystemMessage) {
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    margin: "1rem 0",
                    color: "var(--text-muted)",
                    fontSize: "0.875rem"
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
                  <span>{msg.message}</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMyMessage ? "flex-end" : "flex-start",
                  animation: "fadeIn 0.3s ease-out"
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "0.75rem 1rem",
                    background: isMyMessage ? "var(--accent-primary)" : "var(--bg-secondary)",
                    border: isMyMessage ? "none" : "1px solid var(--border)",
                    borderRadius: isMyMessage
                      ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
                      : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
                    wordWrap: "break-word",
                    boxShadow: "var(--shadow-sm)"
                  }}
                >
                  {!isMyMessage && (
                    <div style={{
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      color: "var(--accent-primary)",
                      marginBottom: "0.25rem"
                    }}>
                      {msg.userName}
                    </div>
                  )}
                  <div style={{ fontSize: "0.9375rem" }}>{msg.message}</div>
                  <div style={{
                    fontSize: "0.6875rem",
                    color: isMyMessage ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                    marginTop: "0.25rem",
                    textAlign: "right"
                  }}>
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSendMessage} style={{
        padding: "1rem",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: "0.75rem",
        flexShrink: 0
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={isConnected ? "Введите сообщение..." : "Подключение..."}
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: "0.75rem 1rem"
          }}
        />
        <button
          type="submit"
          disabled={!isConnected || !inputMessage.trim()}
          className="btn-primary"
          style={{
            padding: "0.75rem 1.5rem",
            opacity: (!isConnected || !inputMessage.trim()) ? 0.5 : 1
          }}
        >
          <span style={{ fontSize: "1.125rem" }}>📤</span>
        </button>
      </form>
    </div>
  );
}
