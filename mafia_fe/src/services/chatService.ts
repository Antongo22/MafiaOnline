import * as signalR from "@microsoft/signalr";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

class ChatService {
  private connection: signalR.HubConnection | null = null;
  private messageHandlers: ((message: ChatMessage) => void)[] = [];
  private historyHandlers: ((messages: ChatMessage[]) => void)[] = [];
  private errorHandlers: ((error: string) => void)[] = [];

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

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const chatService = new ChatService();

