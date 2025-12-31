import { useEffect, useRef, useState } from "react";

interface VideoCallProps {
  roomId: string;
  userName: string;
  userId?: string;
  isAdmin: boolean;
  currentSpeakerName?: string;
  videoCallUrl?: string;
}

/**
 * Компонент для встраивания видеозвонков через iframe
 * Игроки НЕ могут управлять своим видео/аудио - это делает админ через API
 * в зависимости от фазы игры
 * Текущий говорящий подсвечивается зелёной рамкой
 */
export function VideoCall({
  roomId,
  userName,
  isAdmin,
  currentSpeakerName,
  videoCallUrl,
}: VideoCallProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Используем переменную окружения или дефолтное значение
  const defaultVideoCallUrl = import.meta.env.VITE_VIDEO_CALL_FRONTEND_URL || "http://localhost:3000";
  const finalVideoCallUrl = videoCallUrl || defaultVideoCallUrl;

  useEffect(() => {
    if (!roomId || !userName) return;

    const url = new URL(finalVideoCallUrl);
    url.searchParams.set("room", roomId);
    url.searchParams.set("name", userName);
    if (isAdmin) {
      url.searchParams.set("creator", "true");
    }
    url.searchParams.set("hideControls", "true");
    if (currentSpeakerName) {
      url.searchParams.set("highlightSpeaker", currentSpeakerName);
    }

    if (iframeRef.current) {
      iframeRef.current.src = url.toString();
      setIsLoaded(true);
      console.log("[VideoCall] Loading iframe with URL:", url.toString());
    }
  }, [roomId, userName, isAdmin, currentSpeakerName, finalVideoCallUrl]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        position: "relative",
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {!isLoaded && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ fontSize: "2rem" }}>📹</div>
          <div>Загрузка видеозвонка...</div>
          <div style={{ fontSize: "0.875rem", opacity: 0.7, marginTop: "0.5rem" }}>
            {isAdmin ? "Вы можете управлять медиа всех участников" : "Управление медиа осуществляет админ"}
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        allow="camera;microphone;autoplay"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: isLoaded ? "block" : "none",
        }}
        title="Видеозвонок"
      />
    </div>
  );
}

