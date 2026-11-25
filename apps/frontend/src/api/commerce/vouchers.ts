import type {
  FulfillRewardInput,
  MemberVouchersResponse,
  MemberVoucherResponse,
  MerchantRewardResponse,
  MerchantRewardsResponse,
  VoucherDefinitionInput,
  VoucherDefinitionPatch,
  VoucherDefinitionResponse,
  VoucherDefinitionsResponse,
  RewardCancelResponseDto,
} from "../contracts/vouchers";
import { requestJson } from "./shared";

export function createVouchersClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    listMerchantVoucherDefinitions(token: string, paging?: { page: number; limit: number; q?: string; type?: "DISCOUNT" | "REWARD"; status?: "active" | "inactive"; sort?: "newest" | "name" | "points" }) {
      const params = paging ? new URLSearchParams({ page: String(paging.page), limit: String(paging.limit) }) : null;
      if (paging?.q) params?.set("q", paging.q);
      if (paging?.type) params?.set("type", paging.type);
      if (paging?.status) params?.set("status", paging.status);
      if (paging?.sort) params?.set("sort", paging.sort);
      const query = params ? `?${params}` : "";
      return requestJson<VoucherDefinitionsResponse>(fetcher, baseUrl, `/api/merchant/vouchers${query}`, { token });
    },
    createVoucherDefinition(input: VoucherDefinitionInput, token: string) {
      return requestJson<VoucherDefinitionResponse>(fetcher, baseUrl, "/api/merchant/vouchers", {
        method: "POST",
        token,
        body: input,
      });
    },
    updateVoucherDefinition(id: number, patch: VoucherDefinitionPatch, token: string) {
      return requestJson<VoucherDefinitionResponse>(fetcher, baseUrl, `/api/merchant/vouchers/${id}`, {
        method: "PATCH",
        token,
        body: patch,
      });
    },
    listPublicVoucherDefinitions(merchantId: number) {
      return requestJson<VoucherDefinitionsResponse>(
        fetcher,
        baseUrl,
        `/api/merchants/${merchantId}/vouchers`,
      );
    },
    listMemberVouchers(merchantId: number, token: string) {
      return requestJson<MemberVouchersResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/vouchers`,
        { token },
      );
    },
    async redeemVoucher(definitionId: number, token: string, idempotencyKey: string) {
      const trimmedKey = idempotencyKey?.trim();
      if (!trimmedKey) {
        throw new Error("Idempotency key is required to redeem a voucher");
      }
      return requestJson<MemberVoucherResponse>(
        fetcher,
        baseUrl,
        `/api/member/vouchers/${definitionId}/redeem`,
        {
          method: "POST",
          token,
          headers: {
            "Idempotency-Key": trimmedKey,
          },
        },
      );
    },
    listMerchantRewards(token: string) {
      return requestJson<MerchantRewardsResponse>(fetcher, baseUrl, "/api/merchant/rewards", { token });
    },
    fulfillReward(memberVoucherId: number, input: FulfillRewardInput, token: string) {
      return requestJson<MerchantRewardResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${memberVoucherId}/fulfill`,
        { method: "POST", token, body: input },
      );
    },
    cancelReward(memberVoucherId: number, body: { reason: string }, token: string) {
      return requestJson<RewardCancelResponseDto>(
        fetcher,
        baseUrl,
        `/api/merchant/rewards/${memberVoucherId}/cancel`,
        {
          method: "POST",
          token,
          body,
        },
      );
    },
  };
}
