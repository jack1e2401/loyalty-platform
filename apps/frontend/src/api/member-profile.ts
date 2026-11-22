import { requestJson } from "./commerce/shared";

export interface MemberProfileDto {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const memberProfileApi = {
  get(token: string) {
    return requestJson<{ profile: MemberProfileDto }>(fetch, baseUrl, "/api/member/profile", { token });
  },
  update(token: string, input: Pick<MemberProfileDto, "name" | "phone" | "address" | "birthDate">) {
    return requestJson<{ profile: MemberProfileDto }>(fetch, baseUrl, "/api/member/profile", { method: "PATCH", token, body: input });
  },
};
