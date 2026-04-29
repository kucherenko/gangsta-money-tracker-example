import { api } from "../lib/api";

export class AdminState {
  stats = $state<any>({ users: 0, transactions: 0, categories: 0, exchange_rates: 0 });
  users = $state<any[]>([]);
  usersTotal = $state<number>(0);
  usersPage = $state<number>(1);
  usersLimit = $state<number>(50);
  auditLog = $state<any[]>([]);
  loading = $state<boolean>(false);
  cleanupLoading = $state<boolean>(false);
  cleanupToken = $state<string | null>(null);
  cleanupScope = $state<string | null>(null);
  error = $state<string>("");

  async loadStats() {
    try {
      this.stats = await api.getAdminStats();
    } catch (err: any) {
      console.error("Failed to load admin stats:", err);
    }
  }

  async loadUsers(page?: number, limit?: number) {
    try {
      this.loading = true;
      const p = page ?? this.usersPage;
      const l = limit ?? this.usersLimit;
      const result = await api.getUsersPaginated(p, l);
      this.users = result.items;
      this.usersTotal = result.total;
      this.usersPage = result.page;
      this.usersLimit = result.limit;
    } catch (err: any) {
      console.error("Failed to load users:", err);
    } finally {
      this.loading = false;
    }
  }

  async deleteUser(id: number) {
    try {
      await api.deleteUser(id);
      await this.loadUsers();
      await this.loadStats();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete user");
    }
  }

  async requestCleanupToken(scope: string) {
    try {
      this.cleanupLoading = true;
      this.error = "";
      const result = await api.requestCleanupToken(scope);
      this.cleanupToken = result.token;
      this.cleanupScope = scope;
    } catch (err: any) {
      this.error = err.message || "Failed to request cleanup token";
      throw err;
    } finally {
      this.cleanupLoading = false;
    }
  }

  async executeCleanup(token: string, scope: string) {
    try {
      this.cleanupLoading = true;
      this.error = "";
      const result = await api.executeCleanup(token, scope);
      this.cleanupToken = null;
      this.cleanupScope = null;
      await this.loadStats();
      await this.loadAuditLog();
      return result;
    } catch (err: any) {
      this.error = err.message || "Cleanup failed";
      throw err;
    } finally {
      this.cleanupLoading = false;
    }
  }

  async loadAuditLog() {
    try {
      this.auditLog = await api.getAdminAudit();
    } catch (err: any) {
      console.error("Failed to load audit log:", err);
    }
  }

  async loadAll() {
    await Promise.all([
      this.loadStats(),
      this.loadUsers(),
      this.loadAuditLog(),
    ]);
  }
}

export const admin = new AdminState();