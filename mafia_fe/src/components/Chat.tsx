import { useEffect, useState, useRef } from "react";
import { chatService, type ChatMessage, type User } from "../services/chatService";

interface ChatProps {
  roomId: string;
  userId: string;
  userName: string;
  apiUrl?: string;
  onUserListUpdate?: (users: User[]) => void;
}

export function Chat({ roomId, userId, userName, apiUrl, onUserListUpdate }: ChatProps) {
  const defaultApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5141";
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
    };

    const handleUserListUpdate = (users: User[]) => {
      if (onUserListUpdate) {
        onUserListUpdate(users);
      }
    };

    const handleUserJoined = (data: { userName: string }) => {
      // Можно добавить системное сообщение о входе пользователя
      console.log(`${data.userName} присоединился к комнате`);
    };

    const handleUserLeft = (data: { userName: string }) => {
      // Можно добавить системное сообщение о выходе пользователя
      console.log(`${data.userName} покинул комнату`);
    };

    chatService.onMessage(handleMessage);
    chatService.onMessageHistory(handleHistory);
    chatService.onError(handleError);
    chatService.onUserListUpdate(handleUserListUpdate);
    chatService.onUserJoined(handleUserJoined);
    chatService.onUserLeft(handleUserLeft);

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
      chatService.leaveRoom(roomId, userId).catch(console.error);
      chatService.disconnect();
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
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      border: "1px solid #ccc", 
      borderRadius: "8px",
      overflow: "hidden"
    }}>
      <div style={{ 
        padding: "10px", 
        background: "#f5f5f5", 
        borderBottom: "1px solid #ccc",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h3 style={{ margin: 0 }}>Чат</h3>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          fontSize: "12px"
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isConnected ? "#4caf50" : "#f44336"
          }}></div>
          <span>{isConnected ? "Подключено" : "Отключено"}</span>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: "8px", 
          background: "#ffebee", 
          color: "#c62828",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        padding: "10px",
        background: "#fff"
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            color: "#999", 
            padding: "20px" 
          }}>
            Нет сообщений. Начните общение!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: "12px",
                padding: "8px",
                background: msg.userId === userId ? "#e3f2fd" : "#f5f5f5",
                borderRadius: "8px",
                marginLeft: msg.userId === userId ? "auto" : "0",
                marginRight: msg.userId === userId ? "0" : "auto",
                maxWidth: "70%",
                wordWrap: "break-word"
              }}
            >
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                marginBottom: "4px",
                fontSize: "12px",
                color: "#666"
              }}>
                <strong>{msg.userName}</strong>
                <span>{formatTimestamp(msg.timestamp)}</span>
              </div>
              <div style={{ fontSize: "14px" }}>{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ 
        padding: "10px", 
        borderTop: "1px solid #ccc",
        display: "flex",
        gap: "8px"
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Введите сообщение..."
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px"
          }}
        />
        <button
          type="submit"
          disabled={!isConnected || !inputMessage.trim()}
          style={{
            padding: "8px 16px",
            background: isConnected && inputMessage.trim() ? "#2196f3" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected && inputMessage.trim() ? "pointer" : "not-allowed",
            fontSize: "14px"
          }}
        >
          Отправить
        </button>
      </form>
    </div>
  );
}

