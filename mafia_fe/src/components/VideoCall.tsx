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
  videoCallUrl,
}: VideoCallProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Используем переменную окружения или дефолтное значение
  const defaultVideoCallUrl = import.meta.env.VITE_VIDEO_CALL_FRONTEND_URL || "https://calls.trexon.ru";
  const finalVideoCallUrl = videoCallUrl || defaultVideoCallUrl;

  useEffect(() => {
    // Явный запрос разрешений перед загрузкой iframe
    const requestPermissions = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        console.log("[VideoCall] Permissions granted");
      } catch (err) {
        console.error("[VideoCall] Failed to get permissions:", err);
      }
    };

    requestPermissions();
  }, []);

  useEffect(() => {
    if (!roomId || !userName) return;

    // Construct URL with query parameters
    const baseUrl = finalVideoCallUrl.split('?')[0];
    const params = new URLSearchParams();
    params.set("room", roomId);
    params.set("name", userName);
    params.set("autoJoin", "true");
    params.set("hideLeave", "true");
    params.set("hideChat", "true");
    params.set("video", "false"); // По умолчанию без камеры
    params.set("audio", "true");  // Микрофон включен по умолчанию

    if (isAdmin) {
      params.set("creator", "true"); // Calls frontend will create room if needed
    }

    // Add timestamp to prevent caching
    params.set("_t", Date.now().toString());

    const fullUrl = `${baseUrl}?${params.toString()}`;

    if (iframeRef.current) {
      console.log("[VideoCall] Setting URL:", fullUrl);
      iframeRef.current.src = fullUrl;
      setIsLoaded(true);
    }
  }, [roomId, userName, isAdmin, finalVideoCallUrl]);

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
        allow="camera *; microphone *; autoplay *; display-capture *; fullscreen *; clipboard-read *; clipboard-write *"
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
