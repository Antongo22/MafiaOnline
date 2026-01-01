interface RoomState {
  roomId: string;
  userId: string;
  userName: string;
  roomName: string;
  inviteCode: string;
  myRole?: string | null;
  gameStatus?: string;
  winningTeam?: string;
}

interface LastUsedNames {
  userName: string;
  roomName: string;
}

const STORAGE_KEY = "mafia_room_state";
const LAST_NAMES_KEY = "mafia_last_names";

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

export const saveLastUsedNames = (userName: string, roomName: string): void => {
  try {
    localStorage.setItem(LAST_NAMES_KEY, JSON.stringify({ userName, roomName }));
  } catch (error) {
    console.error("Failed to save last used names:", error);
  }
};

export const loadLastUsedNames = (): LastUsedNames | null => {
  try {
    const stored = localStorage.getItem(LAST_NAMES_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load last used names:", error);
    return null;
  }
};

