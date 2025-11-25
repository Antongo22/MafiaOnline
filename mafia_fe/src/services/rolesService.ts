export interface RoleInfo {
  roleValue: string;
  name: string;
  description: string;
  team: "Good" | "Evil" | "Neutral";
  isUnique: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5141";

class RolesService {
  private roles: RoleInfo[] | null = null;
  private loading: boolean = false;
  private loadPromise: Promise<RoleInfo[]> | null = null;

  async getRoles(): Promise<RoleInfo[]> {
    // Если роли уже загружены, возвращаем их
    if (this.roles !== null) {
      return this.roles;
    }

    // Если идёт загрузка, ждём её завершения
    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    // Начинаем загрузку
    this.loading = true;
    this.loadPromise = this.fetchRoles();
    
    try {
      this.roles = await this.loadPromise;
      return this.roles;
    } finally {
      this.loading = false;
      this.loadPromise = null;
    }
  }

  private async fetchRoles(): Promise<RoleInfo[]> {
    try {
      const response = await fetch(`${API_URL}/api/Game/available-roles`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: RoleInfo[] = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      return [];
    }
  }

  getRoleInfo(roleValue: string): RoleInfo | undefined {
    return this.roles?.find(r => r.roleValue === roleValue);
  }

  clearCache(): void {
    this.roles = null;
  }
}

export const rolesService = new RolesService();

