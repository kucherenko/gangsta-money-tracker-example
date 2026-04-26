import { api } from "../lib/api";

export class TransactionsState {
  items = $state<any[]>([]);
  page = $state(1);
  limit = $state(25);
  total = $state(0);
  filter = $state({
    dateFrom: "",
    dateTo: "",
    categoryId: undefined as number | undefined,
    type: "" as "" | "income" | "expense",
    sortBy: "date",
    sortOrder: "desc",
  });

  filtered = $derived(this.items);

  async load() {
    const res = await api.getTransactions({
      page: this.page,
      limit: this.limit,
      dateFrom: this.filter.dateFrom || undefined,
      dateTo: this.filter.dateTo || undefined,
      categoryId: this.filter.categoryId,
      type: this.filter.type || undefined,
      sortBy: this.filter.sortBy,
      sortOrder: this.filter.sortOrder,
    });
    this.items = res.items || [];
    this.total = res.total || this.items.length;
  }

  async addTransaction(data: any) {
    await api.createTransaction(data);
    await this.load();
  }

  async updateTransaction(id: number, data: any) {
    await api.updateTransaction(id, data);
    await this.load();
  }

  async deleteTransaction(id: number) {
    await api.deleteTransaction(id);
    await this.load();
  }
}

export const transactions = new TransactionsState();
