import { useEffect, useState, useRef } from "react";
import { videoCallService } from "../services/videoCallService";

interface LiveKitChatProps {
  roomId: string;
  userName: string;
}

interface ChatMessage {
  participant: string;
  message: string;
  timestamp: number;
}

export function LiveKitChat({ roomId, userName }: LiveKitChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadChatHistory();

    pollIntervalRef.current = window.setInterval(() => {
      loadChatHistory();
    }, 2000);

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const history = await videoCallService.getChatHistory(roomId);
      if (history && history.length > 0) {
        setMessages(history);
      }
    } catch (error) {
      console.error("[LiveKitChat] Error loading chat history:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const success = await videoCallService.sendChatMessage(
        roomId,
        userName,
        inputMessage.trim()
      );
      
      if (success) {
        setInputMessage("");
        await loadChatHistory();
      }
    } catch (error) {
      console.error("[LiveKitChat] Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
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
          <span>Общий чат</span>
        </h3>
      </div>

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
          messages.map((msg, index) => {
            const isMyMessage = msg.participant === userName;
            
            return (
              <div
                key={`${msg.timestamp}-${index}`}
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
                      {msg.participant}
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
          placeholder="Введите сообщение..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "0.75rem 1rem"
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="btn-primary"
          style={{
            padding: "0.75rem 1.5rem",
            opacity: (isLoading || !inputMessage.trim()) ? 0.5 : 1
          }}
        >
          <span style={{ fontSize: "1.125rem" }}>📤</span>
        </button>
      </form>
    </div>
  );
}
