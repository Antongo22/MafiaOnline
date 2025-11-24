import * as signalR from "@microsoft/signalr";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  status: string;
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

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const chatService = new ChatService();

