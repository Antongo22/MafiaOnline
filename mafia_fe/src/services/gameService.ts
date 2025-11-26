const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5141";

export interface NightActionRequest {
  targetId?: string;
  actionType?: string; // "kill", "heal", "check", "protect", "heal_self"
}

export class GameService {
  /**
   * Начать игровой цикл (только админ)
   */
  async startGameCycle(roomId: string, adminId: string): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/GameCycle/start?roomId=${roomId}&adminId=${adminId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to start game cycle");
    }
  }

  /**
   * Поставить игру на паузу (только админ)
   */
  async pauseGame(roomId: string, adminId: string): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/GameCycle/pause?roomId=${roomId}&adminId=${adminId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to pause game");
    }
  }

  /**
   * Продолжить игру после паузы (только админ)
   */
  async resumeGame(roomId: string, adminId: string): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/GameCycle/resume?roomId=${roomId}&adminId=${adminId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to resume game");
    }
  }

  /**
   * Проголосовать за игрока
   */
  async vote(roomId: string, voterId: string, targetId: string): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/GameCycle/vote?roomId=${roomId}&voterId=${voterId}&targetId=${targetId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to vote");
    }
  }

  /**
   * Выполнить ночное действие
   */
  async nightAction(
    roomId: string,
    userId: string,
    action: NightActionRequest
  ): Promise<void> {
    const response = await fetch(
      `${API_URL}/api/GameCycle/night-action?roomId=${roomId}&userId=${userId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(action),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to perform night action");
    }
  }
}

export const gameService = new GameService();

