import * as signalR from "@microsoft/signalr";
import type { 
  TimerUpdate, 
  SpeakerInfo, 
  VoterInfo, 
  VotingResults, 
  NightResults, 
  CardRevealed, 
  GameOverData 
} from "../types/game";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  userRole?: string; // Роль отправителя (для чата мафии)
  isMafiaChat?: boolean; // Флаг чата мафии
}

export interface User {
  id: string;
  name: string;
  status: string;
  isAlive?: boolean;
}

class ChatService {
  private connection: signalR.HubConnection | null = null;
  private messageHandlers: ((message: ChatMessage) => void)[] = [];
  private historyHandlers: ((messages: ChatMessage[]) => void)[] = [];
  private errorHandlers: ((error: string) => void)[] = [];
  private userListHandlers: ((users: User[]) => void)[] = [];
  private userJoinedHandlers: ((data: { userName: string; userId: string }) => void)[] = [];
  private userLeftHandlers: ((data: { userName: string; userId: string }) => void)[] = [];
  private playerKickedHandlers: ((data: { kickedUserId: string; kickedUserName: string; kickedBy: string }) => void)[] = [];
  private roomDisbandedHandlers: (() => void)[] = [];
  private gameStatusChangedHandlers: ((data: { status: string; data?: any }) => void)[] = [];
  private roleAssignedHandlers: ((data: { userId: string; role: string }) => void)[] = [];
  private allRolesRevealedHandlers: ((rolesData: any) => void)[] = [];
  private gameResetHandlers: (() => void)[] = [];
  private mafiaMessageHandlers: ((message: ChatMessage) => void)[] = [];
  private mafiaHistoryHandlers: ((messages: ChatMessage[]) => void)[] = [];
  
  // Game cycle handlers
  private timerUpdateHandlers: ((data: TimerUpdate) => void)[] = [];
  private gameCycleStartedHandlers: ((data: any) => void)[] = [];
  private speakerChangedHandlers: ((data: SpeakerInfo) => void)[] = [];
  private phaseChangedHandlers: ((data: any) => void)[] = [];
  private votingStartedHandlers: ((data: VoterInfo) => void)[] = [];
  private voterChangedHandlers: ((data: VoterInfo) => void)[] = [];
  private voteReceivedHandlers: ((data: { voterId: string }) => void)[] = [];
  private votingResultsHandlers: ((data: VotingResults) => void)[] = [];
  private nightPhaseChangedHandlers: ((data: { nightPhase: string; timeSeconds: number }) => void)[] = [];
  private nightResultsHandlers: ((data: NightResults) => void)[] = [];
  private cardRevealedHandlers: ((data: CardRevealed) => void)[] = [];
  private gameOverHandlers: ((data: GameOverData) => void)[] = [];
  private gamePausedHandlers: ((data: { pausedBy: string; remainingTime: number }) => void)[] = [];
  private gameResumedHandlers: ((data: { resumedBy: string; remainingTime: number }) => void)[] = [];

  async connect(apiUrl: string = "http://localhost:5141"): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiUrl}/chatHub`)
      .withAutomaticReconnect()
      .build();

    // Обработчик получения сообщения
    this.connection.on("ReceiveMessage", (message: ChatMessage) => {
      this.messageHandlers.forEach((handler) => handler(message));
    });

    // Обработчик получения истории
    this.connection.on("ReceiveMessageHistory", (messages: ChatMessage[]) => {
      this.historyHandlers.forEach((handler) => handler(messages));
    });

    // Обработчик ошибок
    this.connection.on("Error", (error: string) => {
      this.errorHandlers.forEach((handler) => handler(error));
    });

    // Обработчик обновления списка пользователей
    this.connection.on("UpdateUserList", (users: User[]) => {
      this.userListHandlers.forEach((handler) => handler(users));
    });

    // Обработчик входа пользователя
    this.connection.on("UserJoined", (data: { userName: string; userId: string }) => {
      this.userJoinedHandlers.forEach((handler) => handler(data));
    });

    // Обработчик выхода пользователя
    this.connection.on("UserLeft", (data: { userName: string; userId: string }) => {
      this.userLeftHandlers.forEach((handler) => handler(data));
    });

    // Обработчик кика игрока
    this.connection.on("PlayerKicked", (data: { kickedUserId: string; kickedUserName: string; kickedBy: string }) => {
      this.playerKickedHandlers.forEach((handler) => handler(data));
    });

    // Обработчик расформирования комнаты
    this.connection.on("RoomDisbanded", () => {
      this.roomDisbandedHandlers.forEach((handler) => handler());
    });

    // Обработчик изменения статуса игры
    this.connection.on("GameStatusChanged", (data: { status: string; data?: any }) => {
      this.gameStatusChangedHandlers.forEach((handler) => handler(data));
    });

    // Обработчик получения роли
    this.connection.on("RoleAssigned", (data: { userId: string; role: string }) => {
      this.roleAssignedHandlers.forEach((handler) => handler(data));
    });

    // Обработчик раскрытия всех ролей
    this.connection.on("AllRolesRevealed", (rolesData: any) => {
      this.allRolesRevealedHandlers.forEach((handler) => handler(rolesData));
    });

    // Обработчик сброса игры
    this.connection.on("GameReset", () => {
      this.gameResetHandlers.forEach((handler) => handler());
    });

    // Обработчик получения сообщения в чате мафии
    this.connection.on("ReceiveMafiaMessage", (message: ChatMessage) => {
      this.mafiaMessageHandlers.forEach((handler) => handler(message));
    });

    // Обработчик получения истории чата мафии
    this.connection.on("ReceiveMafiaMessageHistory", (messages: ChatMessage[]) => {
      this.mafiaHistoryHandlers.forEach((handler) => handler(messages));
    });

    // Game cycle handlers
    this.connection.on("TimerUpdate", (data: TimerUpdate) => {
      this.timerUpdateHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("GameCycleStarted", (data: any) => {
      this.gameCycleStartedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("IndividualSpeechStarted", (data: any) => {
      this.gameCycleStartedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("SpeakerChanged", (data: SpeakerInfo) => {
      this.speakerChangedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("PhaseChanged", (data: any) => {
      this.phaseChangedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("VotingStarted", (data: VoterInfo) => {
      this.votingStartedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("VoterChanged", (data: VoterInfo) => {
      this.voterChangedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("VoteReceived", (data: { voterId: string }) => {
      this.voteReceivedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("VotingResults", (data: VotingResults) => {
      this.votingResultsHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("NightPhaseChanged", (data: { nightPhase: string; timeSeconds: number }) => {
      this.nightPhaseChangedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("NightResults", (data: NightResults) => {
      this.nightResultsHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("CardRevealed", (data: CardRevealed) => {
      this.cardRevealedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("GameOver", (data: GameOverData) => {
      this.gameOverHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("GamePaused", (data: { pausedBy: string; remainingTime: number }) => {
      this.gamePausedHandlers.forEach((handler) => handler(data));
    });

    this.connection.on("GameResumed", (data: { resumedBy: string; remainingTime: number }) => {
      this.gameResumedHandlers.forEach((handler) => handler(data));
    });

    await this.connection.start();
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("JoinRoom", roomId, userId);
  }

  async sendMessage(roomId: string, userId: string, userName: string, message: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("SendMessage", roomId, userId, userName, message);
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("LeaveRoom", roomId, userId);
  }

  async joinMafiaChat(roomId: string, userId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("JoinMafiaChat", roomId, userId);
  }

  async sendMafiaMessage(roomId: string, userId: string, userName: string, message: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("SendMafiaMessage", roomId, userId, userName, message);
  }

  async kickPlayer(roomId: string, adminId: string, targetUserId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("KickPlayer", roomId, adminId, targetUserId);
  }

  async disbandRoom(roomId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("DisbandRoom", roomId);
  }

  onMessage(handler: (message: ChatMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onMessageHistory(handler: (messages: ChatMessage[]) => void): void {
    this.historyHandlers.push(handler);
  }

  onError(handler: (error: string) => void): void {
    this.errorHandlers.push(handler);
  }

  removeMessageHandler(handler: (message: ChatMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  removeHistoryHandler(handler: (messages: ChatMessage[]) => void): void {
    this.historyHandlers = this.historyHandlers.filter((h) => h !== handler);
  }

  removeErrorHandler(handler: (error: string) => void): void {
    this.errorHandlers = this.errorHandlers.filter((h) => h !== handler);
  }

  onUserListUpdate(handler: (users: User[]) => void): void {
    this.userListHandlers.push(handler);
  }

  removeUserListHandler(handler: (users: User[]) => void): void {
    this.userListHandlers = this.userListHandlers.filter((h) => h !== handler);
  }

  onUserJoined(handler: (data: { userName: string; userId: string }) => void): void {
    this.userJoinedHandlers.push(handler);
  }

  removeUserJoinedHandler(handler: (data: { userName: string; userId: string }) => void): void {
    this.userJoinedHandlers = this.userJoinedHandlers.filter((h) => h !== handler);
  }

  onUserLeft(handler: (data: { userName: string; userId: string }) => void): void {
    this.userLeftHandlers.push(handler);
  }

  removeUserLeftHandler(handler: (data: { userName: string; userId: string }) => void): void {
    this.userLeftHandlers = this.userLeftHandlers.filter((h) => h !== handler);
  }

  onPlayerKicked(handler: (data: { kickedUserId: string; kickedUserName: string; kickedBy: string }) => void): void {
    this.playerKickedHandlers.push(handler);
  }

  removePlayerKickedHandler(handler: (data: { kickedUserId: string; kickedUserName: string; kickedBy: string }) => void): void {
    this.playerKickedHandlers = this.playerKickedHandlers.filter((h) => h !== handler);
  }

  onRoomDisbanded(handler: () => void): void {
    this.roomDisbandedHandlers.push(handler);
  }

  removeRoomDisbandedHandler(handler: () => void): void {
    this.roomDisbandedHandlers = this.roomDisbandedHandlers.filter((h) => h !== handler);
  }

  onGameStatusChanged(handler: (data: { status: string; data?: any }) => void): void {
    this.gameStatusChangedHandlers.push(handler);
  }

  removeGameStatusChangedHandler(handler: (data: { status: string; data?: any }) => void): void {
    this.gameStatusChangedHandlers = this.gameStatusChangedHandlers.filter((h) => h !== handler);
  }

  onRoleAssigned(handler: (data: { userId: string; role: string }) => void): void {
    this.roleAssignedHandlers.push(handler);
  }

  removeRoleAssignedHandler(handler: (data: { userId: string; role: string }) => void): void {
    this.roleAssignedHandlers = this.roleAssignedHandlers.filter((h) => h !== handler);
  }

  onAllRolesRevealed(handler: (rolesData: any) => void): void {
    this.allRolesRevealedHandlers.push(handler);
  }

  removeAllRolesRevealedHandler(handler: (rolesData: any) => void): void {
    this.allRolesRevealedHandlers = this.allRolesRevealedHandlers.filter((h) => h !== handler);
  }

  onGameReset(handler: () => void): void {
    this.gameResetHandlers.push(handler);
  }

  removeGameResetHandler(handler: () => void): void {
    this.gameResetHandlers = this.gameResetHandlers.filter((h) => h !== handler);
  }

  onMafiaMessage(handler: (message: ChatMessage) => void): void {
    this.mafiaMessageHandlers.push(handler);
  }

  removeMafiaMessageHandler(handler: (message: ChatMessage) => void): void {
    this.mafiaMessageHandlers = this.mafiaMessageHandlers.filter((h) => h !== handler);
  }

  onMafiaMessageHistory(handler: (messages: ChatMessage[]) => void): void {
    this.mafiaHistoryHandlers.push(handler);
  }

  removeMafiaHistoryHandler(handler: (messages: ChatMessage[]) => void): void {
    this.mafiaHistoryHandlers = this.mafiaHistoryHandlers.filter((h) => h !== handler);
  }

  async notifyGameStatusChange(roomId: string, status: string, additionalData?: any): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("NotifyGameStatusChange", roomId, status, additionalData);
  }

  async notifyAllRolesRevealed(roomId: string, rolesData: any): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Connection is not established");
    }
    await this.connection.invoke("NotifyAllRolesRevealed", roomId, rolesData);
  }

  // Game cycle event handlers
  onTimerUpdate(handler: (data: TimerUpdate) => void): void {
    this.timerUpdateHandlers.push(handler);
  }

  removeTimerUpdateHandler(handler: (data: TimerUpdate) => void): void {
    this.timerUpdateHandlers = this.timerUpdateHandlers.filter((h) => h !== handler);
  }

  onGameCycleStarted(handler: (data: any) => void): void {
    this.gameCycleStartedHandlers.push(handler);
  }

  removeGameCycleStartedHandler(handler: (data: any) => void): void {
    this.gameCycleStartedHandlers = this.gameCycleStartedHandlers.filter((h) => h !== handler);
  }

  onSpeakerChanged(handler: (data: SpeakerInfo) => void): void {
    this.speakerChangedHandlers.push(handler);
  }

  removeSpeakerChangedHandler(handler: (data: SpeakerInfo) => void): void {
    this.speakerChangedHandlers = this.speakerChangedHandlers.filter((h) => h !== handler);
  }

  onPhaseChanged(handler: (data: any) => void): void {
    this.phaseChangedHandlers.push(handler);
  }

  removePhaseChangedHandler(handler: (data: any) => void): void {
    this.phaseChangedHandlers = this.phaseChangedHandlers.filter((h) => h !== handler);
  }

  onVotingStarted(handler: (data: VoterInfo) => void): void {
    this.votingStartedHandlers.push(handler);
  }

  removeVotingStartedHandler(handler: (data: VoterInfo) => void): void {
    this.votingStartedHandlers = this.votingStartedHandlers.filter((h) => h !== handler);
  }

  onVoterChanged(handler: (data: VoterInfo) => void): void {
    this.voterChangedHandlers.push(handler);
  }

  removeVoterChangedHandler(handler: (data: VoterInfo) => void): void {
    this.voterChangedHandlers = this.voterChangedHandlers.filter((h) => h !== handler);
  }

  onVoteReceived(handler: (data: { voterId: string }) => void): void {
    this.voteReceivedHandlers.push(handler);
  }

  removeVoteReceivedHandler(handler: (data: { voterId: string }) => void): void {
    this.voteReceivedHandlers = this.voteReceivedHandlers.filter((h) => h !== handler);
  }

  onVotingResults(handler: (data: VotingResults) => void): void {
    this.votingResultsHandlers.push(handler);
  }

  removeVotingResultsHandler(handler: (data: VotingResults) => void): void {
    this.votingResultsHandlers = this.votingResultsHandlers.filter((h) => h !== handler);
  }

  onNightPhaseChanged(handler: (data: { nightPhase: string; timeSeconds: number }) => void): void {
    this.nightPhaseChangedHandlers.push(handler);
  }

  removeNightPhaseChangedHandler(handler: (data: { nightPhase: string; timeSeconds: number }) => void): void {
    this.nightPhaseChangedHandlers = this.nightPhaseChangedHandlers.filter((h) => h !== handler);
  }

  onNightResults(handler: (data: NightResults) => void): void {
    this.nightResultsHandlers.push(handler);
  }

  removeNightResultsHandler(handler: (data: NightResults) => void): void {
    this.nightResultsHandlers = this.nightResultsHandlers.filter((h) => h !== handler);
  }

  onCardRevealed(handler: (data: CardRevealed) => void): void {
    this.cardRevealedHandlers.push(handler);
  }

  removeCardRevealedHandler(handler: (data: CardRevealed) => void): void {
    this.cardRevealedHandlers = this.cardRevealedHandlers.filter((h) => h !== handler);
  }

  onGameOver(handler: (data: GameOverData) => void): void {
    this.gameOverHandlers.push(handler);
  }

  removeGameOverHandler(handler: (data: GameOverData) => void): void {
    this.gameOverHandlers = this.gameOverHandlers.filter((h) => h !== handler);
  }

  onGamePaused(handler: (data: { pausedBy: string; remainingTime: number }) => void): void {
    this.gamePausedHandlers.push(handler);
  }

  removeGamePausedHandler(handler: (data: { pausedBy: string; remainingTime: number }) => void): void {
    this.gamePausedHandlers = this.gamePausedHandlers.filter((h) => h !== handler);
  }

  onGameResumed(handler: (data: { resumedBy: string; remainingTime: number }) => void): void {
    this.gameResumedHandlers.push(handler);
  }

  removeGameResumedHandler(handler: (data: { resumedBy: string; remainingTime: number }) => void): void {
    this.gameResumedHandlers = this.gameResumedHandlers.filter((h) => h !== handler);
  }

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const chatService = new ChatService();

