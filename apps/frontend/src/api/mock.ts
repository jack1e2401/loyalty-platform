import type { CheckoutInput, CommerceApi, MemberVoucher, Order, Product, VoucherDefinition } from "./types";
import { createMockData } from "./mock-data";

const pause = () => new Promise((resolve) => setTimeout(resolve, 260));
const clone = <T>(value: T): T => structuredClone(value);
const today = "2026-11-09";

export function createMockApi(): CommerceApi {
  const { merchants, applications, products, orders, wallets, configs, definitions, memberVouchers } =
    createMockData();
  const findMerchant = (id: string) => {
    const m = merchants.find((x) => x.id === id);
    if (!m) throw new Error("Không tìm thấy cửa hàng");
    return m;
  };
  const findWallet = (id: string) => {
    const w = wallets.find((x) => x.merchantId === id);
    if (!w) throw new Error("Không tìm thấy ví điểm");
    return w;
  };

  return {
    mode: "mock",
    async listMerchants() {
      await pause();
      return clone(merchants);
    },
    async getMerchant(id) {
      await pause();
      return clone(findMerchant(id));
    },
    async updateMerchant(id, changes) {
      await pause();
      const m = findMerchant(id);
      Object.assign(m, changes);
      return clone(m);
    },
    async listApplications() {
      await pause();
      return clone(applications);
    },
    async approveApplication(id) {
      await pause();
      const a = applications.find((x) => x.id === id);
      if (!a) throw new Error("Không tìm thấy hồ sơ");
      a.status = "APPROVED";
      findMerchant(a.merchantId).status = "APPROVED";
      if (!wallets.some((w) => w.merchantId === a.merchantId))
        wallets.push({
          merchantId: a.merchantId,
          availablePoints: 0,
          lifetimeEarnedPoints: 0,
          tier: "Unranked",
          transactions: [],
        });
      if (!configs.some((c) => c.merchantId === a.merchantId))
        configs.push({
          merchantId: a.merchantId,
          baseAmount: 10000,
          tiers: [
            { tier: "Bronze", threshold: 0, multiplier: 1 },
            { tier: "Silver", threshold: 1000, multiplier: 1.2 },
            { tier: "Gold", threshold: 5000, multiplier: 1.5 },
            { tier: "Platinum", threshold: 10000, multiplier: 2 },
          ],
        });
      return clone(a);
    },
    async rejectApplication(id) {
      await pause();
      const a = applications.find((x) => x.id === id);
      if (!a) throw new Error("Không tìm thấy hồ sơ");
      a.status = "REJECTED";
      findMerchant(a.merchantId).status = "REJECTED";
      return clone(a);
    },
    async canManageMerchant(id) {
      await pause();
      return findMerchant(id).status === "APPROVED";
    },
    async getDashboardStats() {
      await pause();
      return {
        merchants: merchants.filter((m) => m.status === "APPROVED").length,
        pendingApplications: applications.filter((a) => a.status === "PENDING").length,
        paidOrders: orders.filter((o) => o.status === "PAID").length,
        totalVolume: orders.filter((o) => o.status === "PAID").reduce((n, o) => n + o.total, 0),
      };
    },
    async listProducts(merchantId) {
      await pause();
      return clone(products.filter((p) => p.merchantId === merchantId));
    },
    async saveProduct(input) {
      await pause();
      if (!(await this.canManageMerchant(input.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const existing = products.find((p) => p.id === input.id);
      if (input.id && (!existing || existing.merchantId !== input.merchantId))
        throw new Error("Không tìm thấy sản phẩm");
      if (existing) {
        Object.assign(existing, input);
        return clone(existing);
      }
      const p: Product = {
        id: `p${Date.now()}`,
        merchantId: input.merchantId,
        name: input.name,
        category: input.category ?? "Khác",
        description: input.description ?? "",
        price: input.price,
        stock: input.stock ?? 0,
        active: true,
        image: input.image ?? "",
      };
      products.unshift(p);
      return clone(p);
    },
    async toggleProduct(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const p = products.find((x) => x.id === id && x.merchantId === merchantId);
      if (!p) throw new Error("Không tìm thấy sản phẩm");
      p.active = !p.active;
      return clone(p);
    },
    async listOrders(merchantId) {
      await pause();
      return clone(merchantId ? orders.filter((o) => o.merchantId === merchantId) : orders);
    },
    async listMemberOrders(merchantId) {
      await pause();
      return clone(orders.filter((o) => o.merchantId === merchantId && o.memberId === "member-demo"));
    },
    async createOrder(input: CheckoutInput) {
      await pause();
      const merchant = findMerchant(input.merchantId);
      if (merchant.status !== "APPROVED") throw new Error("Cửa hàng chưa hoạt động");
      if (!input.items.length) throw new Error("Giỏ hàng trống");
      const items = input.items.map(({ productId, quantity }) => {
        const p = products.find((x) => x.id === productId && x.merchantId === input.merchantId && x.active);
        if (!p || quantity < 1 || quantity > p.stock) throw new Error("Sản phẩm không hợp lệ hoặc hết hàng");
        return { productId, name: p.name, price: p.price, quantity };
      });
      const voucher = input.voucherId
        ? memberVouchers.find(
            (v) =>
              v.id === input.voucherId &&
              v.merchantId === input.merchantId &&
              v.kind === "DISCOUNT" &&
              v.status === "AVAILABLE",
          )
        : undefined;
      if (input.voucherId && !voucher) throw new Error("Voucher không hợp lệ");
      const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
      const discount = voucher
        ? Math.min(subtotal, definitions.find((d) => d.id === voucher.definitionId)?.discountAmount ?? 0)
        : 0;
      const order: Order = {
        id: `LC-${Date.now().toString().slice(-6)}`,
        merchantId: input.merchantId,
        memberId: "member-demo",
        memberName: "Mai Anh",
        createdAt: today,
        items,
        subtotal,
        discount,
        total: subtotal - discount,
        status: "PENDING",
        earnedPoints: 0,
        voucherId: voucher?.id,
      };
      orders.unshift(order);
      return clone(order);
    },
    async getWallet(merchantId) {
      await pause();
      return clone(findWallet(merchantId));
    },
    async getLoyaltyConfig(merchantId) {
      await pause();
      const c = configs.find((x) => x.merchantId === merchantId);
      if (!c) throw new Error("Chưa có cấu hình loyalty");
      return clone(c);
    },
    async saveLoyaltyConfig(config) {
      await pause();
      if (!(await this.canManageMerchant(config.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const index = configs.findIndex((x) => x.merchantId === config.merchantId);
      if (index < 0) configs.push(clone(config));
      else configs[index] = clone(config);
      return clone(config);
    },
    async listVoucherDefinitions(merchantId) {
      await pause();
      return clone(definitions.filter((v) => v.merchantId === merchantId));
    },
    async saveVoucherDefinition(input) {
      await pause();
      if (!(await this.canManageMerchant(input.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const existing = definitions.find((v) => v.id === input.id);
      if (input.id && (!existing || existing.merchantId !== input.merchantId))
        throw new Error("Không tìm thấy voucher");
      if (existing) {
        Object.assign(existing, input);
        return clone(existing);
      }
      const v: VoucherDefinition = {
        id: `v${Date.now()}`,
        merchantId: input.merchantId,
        title: input.title,
        description: input.description ?? "",
        kind: input.kind,
        pointsCost: input.pointsCost,
        discountAmount: input.discountAmount,
        active: true,
        icon: input.kind === "DISCOUNT" ? "ticket" : "gift",
      };
      definitions.unshift(v);
      return clone(v);
    },
    async toggleVoucherDefinition(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const v = definitions.find((x) => x.id === id && x.merchantId === merchantId);
      if (!v) throw new Error("Không tìm thấy voucher");
      v.active = !v.active;
      return clone(v);
    },
    async listMemberVouchers(merchantId) {
      await pause();
      return clone(memberVouchers.filter((v) => v.merchantId === merchantId && v.memberId === "member-demo"));
    },
    async redeemVoucher(definitionId, merchantId) {
      await pause();
      const definition = definitions.find(
        (v) => v.id === definitionId && v.merchantId === merchantId && v.active,
      );
      if (!definition) throw new Error("Voucher không khả dụng tại cửa hàng này");
      const wallet = findWallet(merchantId);
      if (wallet.availablePoints < definition.pointsCost) throw new Error("Không đủ điểm để đổi voucher");
      wallet.availablePoints -= definition.pointsCost;
      wallet.transactions.unshift({
        id: `t${Date.now()}`,
        reason: `Đổi ${definition.title}`,
        amount: -definition.pointsCost,
        date: today,
        reference: definitionId,
      });
      const voucher: MemberVoucher = {
        id: `mv-${Date.now()}`,
        definitionId,
        merchantId: definition.merchantId,
        memberId: "member-demo",
        title: definition.title,
        kind: definition.kind,
        status: definition.kind === "DISCOUNT" ? "AVAILABLE" : "PENDING_FULFILLMENT",
        issuedAt: today,
      };
      memberVouchers.unshift(voucher);
      return { voucher: clone(voucher), wallet: clone(wallet) };
    },
    async listRewardFulfillments(merchantId) {
      await pause();
      return clone(memberVouchers.filter((v) => v.merchantId === merchantId && v.kind === "REWARD"));
    },
    async fulfillReward(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const voucher = memberVouchers.find(
        (v) => v.id === id && v.merchantId === merchantId && v.kind === "REWARD",
      );
      if (!voucher) throw new Error("Không tìm thấy phần thưởng");
      if (voucher.status !== "PENDING_FULFILLMENT") throw new Error("Phần thưởng đã xử lý");
      voucher.status = "FULFILLED";
      return clone(voucher);
    },
  };
}
