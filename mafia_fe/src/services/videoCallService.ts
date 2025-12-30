/**
 * Сервис для управления видеозвонками через LiveKit API
 * Используется для mute/unmute участников в зависимости от фазы игры
 * и для работы с чатом через LiveKit
 */

const VIDEO_CALL_API_URL = import.meta.env.VITE_VIDEO_CALL_API_URL || "https://calls.trexon.ru/api";
const API_KEY = import.meta.env.VITE_VIDEO_CALL_API_KEY || "dev_key_12345";

interface MuteRequest {
  participant_identity: string;
  mute_audio?: boolean;
  mute_video?: boolean;
  muted?: boolean;
}

interface ChatMessage {
  room_name: string;
  participant: string;
  message: string;
  timestamp?: number;
}

class VideoCallService {
  /**
   * Заглушить/включить микрофон участника
   */
  async muteAudio(
    roomId: string,
    participantName: string,
    muted: boolean = true
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/participants/${roomId}/mute-audio`,
        {
          method: "POST",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participant_identity: participantName,
            muted: muted,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to mute audio for ${participantName}:`,
          response.status,
          response.statusText
        );
        return false;
      }

      console.log(
        `[VideoCall] ${muted ? 'Muted' : 'Unmuted'} audio for ${participantName}`
      );
      return true;
    } catch (error) {
      console.error(
        `[VideoCall] Error muting audio for ${participantName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Заглушить/включить видео участника
   */
  async muteVideo(
    roomId: string,
    participantName: string,
    muted: boolean = true
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/participants/${roomId}/mute-video`,
        {
          method: "POST",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participant_identity: participantName,
            muted: muted,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to mute video for ${participantName}:`,
          response.status,
          response.statusText
        );
        return false;
      }

      console.log(
        `[VideoCall] ${muted ? 'Muted' : 'Unmuted'} video for ${participantName}`
      );
      return true;
    } catch (error) {
      console.error(
        `[VideoCall] Error muting video for ${participantName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Управление медиа участника (аудио и видео)
   */
  async controlParticipantMedia(
    roomId: string,
    participantName: string,
    muteAudio: boolean,
    muteVideo: boolean
  ): Promise<boolean> {
    const audioResult = await this.muteAudio(roomId, participantName, muteAudio);
    const videoResult = await this.muteVideo(roomId, participantName, muteVideo);
    return audioResult && videoResult;
  }

  /**
   * Управление медиа для всех участников (кроме исключённых)
   */
  async controlAllParticipantsMedia(
    roomId: string,
    participantNames: string[],
    excludeNames: string[] = [],
    muteAudio: boolean = true,
    muteVideo: boolean = true
  ): Promise<void> {
    const namesToControl = participantNames.filter(
      (name) => !excludeNames.includes(name)
    );

    console.log(
      `[VideoCall] Controlling media for ${namesToControl.length} participants in room ${roomId}`
    );

    await Promise.all(
      namesToControl.map((name) =>
        this.controlParticipantMedia(roomId, name, muteAudio, muteVideo)
      )
    );
  }

  /**
   * Получить список участников в комнате
   */
  async getParticipants(roomId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/participants/${roomId}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to get participants:`,
          response.status,
          response.statusText
        );
        return [];
      }

      const data = await response.json();
      return data.participants || [];
    } catch (error) {
      console.error(`[VideoCall] Error getting participants:`, error);
      return [];
    }
  }

  /**
   * Отправить сообщение в чат комнаты
   */
  async sendChatMessage(
    roomName: string,
    participantName: string,
    message: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/chat/send`,
        {
          method: "POST",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            room_name: roomName,
            participant: participantName,
            message: message,
            timestamp: Date.now(),
          } as ChatMessage),
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to send chat message:`,
          response.status,
          response.statusText
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[VideoCall] Error sending chat message:`, error);
      return false;
    }
  }

  /**
   * Получить историю чата комнаты
   */
  async getChatHistory(roomName: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/chat/${roomName}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to get chat history:`,
          response.status,
          response.statusText
        );
        return [];
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error(`[VideoCall] Error getting chat history:`, error);
      return [];
    }
  }

  /**
   * Создать токен для подключения к комнате
   */
  async createToken(
    roomName: string,
    participantName: string,
    canPublish: boolean = true,
    canSubscribe: boolean = true
  ): Promise<{ token: string; url: string } | null> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/tokens`,
        {
          method: "POST",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            room_name: roomName,
            participant_name: participantName,
            can_publish: canPublish,
            can_subscribe: canSubscribe,
            can_publish_data: true,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to create token:`,
          response.status,
          response.statusText
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[VideoCall] Error creating token:`, error);
      return null;
    }
  }

  /**
   * Создать или получить комнату
   */
  async createRoom(roomName: string, creatorName: string): Promise<any> {
    try {
      const response = await fetch(
        `${VIDEO_CALL_API_URL}/rooms`,
        {
          method: "POST",
          headers: {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: roomName,
            creator_name: creatorName,
            empty_timeout: 0,
            max_participants: 0,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `[VideoCall] Failed to create room:`,
          response.status,
          response.statusText
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[VideoCall] Error creating room:`, error);
      return null;
    }
  }
}

export const videoCallService = new VideoCallService();

