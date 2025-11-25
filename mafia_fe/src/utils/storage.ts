interface RoomState {
  roomId: string;
  userId: string;
  userName: string;
  roomName: string;
  inviteCode: string;
  myRole?: string | null;
  gameStatus?: string;
}

const STORAGE_KEY = "mafia_room_state";

export const saveRoomState = (state: RoomState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save room state:", error);
  }
};

export const loadRoomState = (): RoomState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load room state:", error);
    return null;
  }
};

export const clearRoomState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear room state:", error);
  }
};

