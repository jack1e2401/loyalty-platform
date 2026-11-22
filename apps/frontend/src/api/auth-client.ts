import {
  authPaths,
  type BackendErrorResponse,
  type LoginResponse,
  type MemberRegistrationResponse,
  type OwnMerchantResponse,
} from "./contracts/auth";
import { fetchWithSessionRefresh } from "./session-http";

type FetchLike = typeof fetch;
type Credentials = { email: string; password: string };

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetchWithSessionRefresh(fetcher, baseUrl, path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, options.token);

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isBackendError(payload) ? payload.error : `Yêu cầu thất bại (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function isBackendError(value: unknown): value is BackendErrorResponse {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

/** HTTP client for member authentication and the installation merchant profile. */
export function createAuthClient(baseUrl = "", fetcher: FetchLike = fetch) {
  return {
    registerMember(input: Credentials) {
      return requestJson<MemberRegistrationResponse>(fetcher, baseUrl, authPaths.registerMember, {
        method: "POST",
        body: input,
      });
    },

    login(input: Credentials) {
      return requestJson<LoginResponse>(fetcher, baseUrl, authPaths.login, {
        method: "POST",
        body: input,
      });
    },

    refresh() {
      return requestJson<LoginResponse>(fetcher, baseUrl, authPaths.refresh, { method: "POST" });
    },

    logout() {
      return requestJson<void>(fetcher, baseUrl, authPaths.logout, { method: "POST" });
    },

    getOwnMerchant(token: string) {
      return requestJson<OwnMerchantResponse>(fetcher, baseUrl, authPaths.ownMerchant, { token });
    },
  };
}
