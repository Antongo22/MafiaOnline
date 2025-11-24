import { useState, useEffect, useRef } from "react";
import { chatService, type ChatMessage } from "../services/chatService";

interface MafiaChatProps {
  roomId: string;
  userId: string;
  userName: string;
}

export function MafiaChat({ roomId, userId, userName }: MafiaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Подключаемся к чату мафии
    const joinMafia = async () => {
      try {
        await chatService.joinMafiaChat(roomId, userId);
        setIsJoined(true);
      } catch (error) {
        console.error("Failed to join mafia chat:", error);
      }
    };

    joinMafia();

    const handleMafiaMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleMafiaHistory = (history: ChatMessage[]) => {
      setMessages(history);
    };

    chatService.onMafiaMessage(handleMafiaMessage);
    chatService.onMafiaMessageHistory(handleMafiaHistory);

    return () => {
      chatService.removeMafiaMessageHandler(handleMafiaMessage);
      chatService.removeMafiaHistoryHandler(handleMafiaHistory);
    };
  }, [roomId, userId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await chatService.sendMafiaMessage(roomId, userId, userName, newMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send mafia message:", error);
    }
  };

  if (!isJoined) {
    return (
      <div className="chat-container" style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center",
        height: "100%"
      }}>
        <p style={{ color: "var(--text-secondary)" }}>Подключение к чату мафии...</p>
      </div>
    );
  }

  return (
    <div className="chat-container" style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
      background: "var(--bg-secondary)",
      borderRadius: "var(--radius)",
      overflow: "hidden"
    }}>
      <div style={{ 
        padding: "1rem",
        borderBottom: "1px solid var(--border)",
        background: "#ef444422",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem"
      }}>
        <span style={{ fontSize: "1.25rem" }}>🔫</span>
        <h3 style={{ margin: 0, color: "#ef4444" }}>Чат мафии</h3>
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            color: "var(--text-muted)", 
            marginTop: "2rem" 
          }}>
            <p>Здесь пока нет сообщений</p>
            <p style={{ fontSize: "0.875rem" }}>Начните обсуждение с вашими союзниками</p>
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
                    color: "#ef4444",
                    fontSize: "0.875rem"
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "#ef444444" }}></div>
                  <span>{msg.message}</span>
                  <div style={{ flex: 1, height: "1px", background: "#ef444444" }}></div>
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
                  animation: "fadeIn 0.2s ease-out"
                }}
              >
                <div style={{
                  maxWidth: "70%",
                  background: isMyMessage ? "#ef4444" : "var(--bg-tertiary)",
                  padding: "0.75rem",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${isMyMessage ? "#dc2626" : "var(--border)"}`
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem"
                  }}>
                    <span style={{ 
                      fontWeight: "600", 
                      fontSize: "0.875rem",
                      color: isMyMessage ? "white" : "var(--text-primary)"
                    }}>
                      {msg.userName}
                    </span>
                    {msg.userRole && (
                      <span style={{
                        fontSize: "0.75rem",
                        padding: "0.125rem 0.5rem",
                        background: isMyMessage ? "#dc2626" : "#ef4444",
                        color: "white",
                        borderRadius: "0.25rem",
                        fontWeight: "500"
                      }}>
                        {msg.userRole}
                      </span>
                    )}
                  </div>
                  <p style={{ 
                    margin: 0, 
                    wordWrap: "break-word",
                    color: isMyMessage ? "white" : "var(--text-primary)"
                  }}>
                    {msg.message}
                  </p>
                  <span style={{ 
                    fontSize: "0.7rem", 
                    color: isMyMessage ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
                    marginTop: "0.25rem",
                    display: "block"
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ 
        padding: "1rem",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-primary)"
      }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Сообщение для мафии..."
            style={{
              flex: 1,
              padding: "0.75rem",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-primary)",
              fontSize: "0.875rem"
            }}
          />
          <button 
            type="submit" 
            className="btn-primary"
            style={{ 
              padding: "0.75rem 1.5rem",
              background: "#ef4444",
              borderColor: "#ef4444"
            }}
            disabled={!newMessage.trim()}
          >
            📤
          </button>
        </div>
      </form>
    </div>
  );
}

