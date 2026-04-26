import { api } from "../lib/api";

export class CategoriesState {
  items = $state<any[]>([]);

  async load() {
    const res = await api.getCategories();
    this.items = res || [];
  }

  async addCategory(data: any) {
    await api.createCategory(data);
    await this.load();
  }

  async updateCategory(id: number, data: any) {
    await api.updateCategory(id, data);
    await this.load();
  }

  async deleteCategory(id: number) {
    await api.deleteCategory(id);
    await this.load();
  }
}

export const categories = new CategoriesState();
