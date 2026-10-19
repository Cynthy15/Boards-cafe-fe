/** Shared client for the Boards Cafe REST API (OpenAPI v1). */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://boards-cafe-api.onrender.com/api/v1").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "boards-cafe-access-token";
const REFRESH_TOKEN_KEY = "boards-cafe-refresh-token";
const SIGNED_IN_USER_KEY = "boards-cafe-signed-in-user";
const API_DATA_CHANGED_EVENT = "boards-cafe-api-data-changed";
const API_REQUEST_TIMEOUT_MS = 15_000;
export const SESSION_ACTIVITY_KEY = "boards-cafe-last-activity";
export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1_000;

export type ApiRecord = Record<string, unknown>;
export type ApiBody = ApiRecord | FormData;

/** A request failure with private response context for safe, local recovery logic. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
    /** Server-provided pacing guidance for a throttled request, when present. */
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function retryAfterSeconds(response: Response): number | null {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, (retryAt - Date.now()) / 1_000) : null;
}

function getStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setStoredValue(key: string, value: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
}

function removeStoredValue(key: string) {
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
}

export function getAccessToken(): string | null {
  return getStoredValue(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return getStoredValue(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  setStoredValue(ACCESS_TOKEN_KEY, token);
}

export function setRefreshToken(token: string) {
  setStoredValue(REFRESH_TOKEN_KEY, token);
}

export function clearAccessToken() {
  removeStoredValue(ACCESS_TOKEN_KEY);
}

export function clearAuthTokens() {
  clearAccessToken();
  removeStoredValue(REFRESH_TOKEN_KEY);
  removeStoredValue(SIGNED_IN_USER_KEY);
  removeStoredValue(SESSION_ACTIVITY_KEY);
}

/** The current signed-in account, kept locally and cleared when the person signs out. */
export function getSignedInUser(): ApiRecord | null {
  const value = getStoredValue(SIGNED_IN_USER_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ApiRecord : null;
  } catch {
    removeStoredValue(SIGNED_IN_USER_KEY);
    return null;
  }
}

/** Cache a freshly returned profile so navigation and permission checks stay in sync. */
export function setSignedInUser(user: ApiRecord) {
  setStoredValue(SIGNED_IN_USER_KEY, JSON.stringify(user));
}

/** Return the effective `module.action` permission codes returned by `/auth/me/`. */
export function getUserPermissions(value: ApiRecord | null | undefined): Set<string> {
  if (!value) return new Set();
  const user = unwrapApiData<ApiRecord>(value);
  const codes = new Set<string>();

  if (Array.isArray(user.permissions)) {
    for (const permission of user.permissions) {
      if (typeof permission === "string" && permission.trim()) codes.add(permission.trim().toLowerCase());
    }
  }

  // This fallback is useful with older API deployments that only return direct grants.
  if (Array.isArray(user.direct_permissions)) {
    for (const permission of user.direct_permissions) {
      if (!permission || typeof permission !== "object") continue;
      const item = permission as ApiRecord;
      const code = item.full_codename ?? item.codename ?? (typeof item.module === "string" && typeof item.action === "string" ? `${item.module}.${item.action}` : "");
      if (typeof code === "string" && code.trim()) codes.add(code.trim().toLowerCase());
    }
  }

  return codes;
}

export function userHasPermission(value: ApiRecord | null | undefined, permission: string): boolean {
  const permissions = getUserPermissions(value);
  const required = permission.trim().toLowerCase();
  return permissions.has("*") || permissions.has(required);
}

/** A client-generated replay key for an API mutation that must not be duplicated. */
export function createIdempotencyKey(): string | undefined {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined;
}

/** Notify API-backed screens that a business record has changed. */
export function notifyApiDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(API_DATA_CHANGED_EVENT));
}

/** Subscribe a client component to successful non-auth API mutations. */
export function subscribeToApiDataChanges(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(API_DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(API_DATA_CHANGED_EVENT, listener);
}

function findToken(value: unknown, acceptedKeys: readonly string[] = ["access", "access_token", "accessToken", "token", "key"]): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as ApiRecord;
  for (const key of acceptedKeys) {
    if (typeof obj[key] === "string" && obj[key]) return obj[key] as string;
  }
  for (const key of ["data", "tokens", "auth", "result"]) {
    const nested = findToken(obj[key], acceptedKeys);
    if (nested) return nested;
  }
  return null;
}

function userRecordFrom(value: unknown): ApiRecord {
  if (!value || typeof value !== "object") return {};
  const record = value as ApiRecord;
  for (const key of ["user", "profile", "account", "data", "result"]) {
    if (record[key] && typeof record[key] === "object" && !Array.isArray(record[key])) {
      const nested = userRecordFrom(record[key]);
      if (Object.keys(nested).length) return nested;
    }
  }
  return record;
}

function mergeUserRecords(loginPayload: unknown, profile: ApiRecord): ApiRecord {
  const loginUser = userRecordFrom(loginPayload);
  const merged = { ...loginUser, ...profile };
  for (const key of ["role", "role_name", "role_code", "user_role", "user_type", "account_type", "is_admin", "is_owner", "is_superuser"]) {
    if ((merged[key] === undefined || merged[key] === null || merged[key] === "") && loginUser[key] !== undefined) merged[key] = loginUser[key];
  }
  return merged;
}

function apiUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

async function readResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function requestHeaders(init: RequestInit) {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, API_REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    if (timedOut) throw new Error("This is taking longer than expected. Please try again.");
    throw cause;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function sendRequest(path: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetchWithTimeout(apiUrl(path), { ...init, headers: requestHeaders(init), cache: "no-store" });
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("took too long")) throw cause;
    throw new Error("We can’t connect right now. Check your connection and try again.");
  }
  return { response, payload: await readResponse(response) };
}

function isGenericErrorMessage(message: string) {
  return ["validation failed", "bad request", "request failed", "an error occurred"].includes(message.trim().toLowerCase().replace(/[.!]+$/, ""));
}

/**
 * Turn the API's field-keyed error envelope into a short message suitable for a
 * form. The API returns `message` for the summary and `errors` for the useful
 * reason (for example, a stock or payment validation failure).
 */
function fieldErrorMessage(value: unknown): string | null {
  const messages: string[] = [];

  function visit(current: unknown, field = "", depth = 0): void {
    if (messages.length >= 2 || depth > 4 || current === null || current === undefined) return;
    if (typeof current === "string") {
      const message = current.trim();
      if (!message || isGenericErrorMessage(message)) return;
      const prefix = field && !["detail", "non_field_errors", "errors"].includes(field) ? `${field.replaceAll("_", " ")}: ` : "";
      const formatted = `${prefix}${message}`;
      if (!messages.includes(formatted)) messages.push(formatted);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, field, depth + 1));
      return;
    }
    if (typeof current === "object") {
      Object.entries(current as ApiRecord).forEach(([key, item]) => {
        if (!["success", "message", "status", "code"].includes(key)) visit(item, key, depth + 1);
      });
    }
  }

  const record = value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : null;
  if (record?.errors !== undefined) visit(record.errors);
  if (!messages.length && record?.detail !== undefined) visit(record.detail);
  return messages.length ? messages.join(" ") : null;
}

function errorMessageFromPayload(payload: unknown): string | null {
  const value = unwrapApiData<unknown>(payload);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as ApiRecord;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const detail = fieldErrorMessage(record);
  // Field-level information names the failed value. Prefer it to the broad
  // summary (which is often just "Validation failed").
  if (detail) return detail;
  return message || null;
}

function friendlyFailureMessage(status: number, payload: unknown): string {
  // The published API returns a human-readable `message` on expected client
  // failures. Preserve it so forms can explain a validation or conflict without
  // needing to know each endpoint's error envelope. Do not surface 5xx details.
  const apiMessage = errorMessageFromPayload(payload);
  if (status >= 400 && status < 500 && apiMessage) return apiMessage;
  if (status === 400 || status === 422) return "Please check the details and try again.";
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don’t have permission to do that.";
  if (status === 404) return "We couldn’t find what you were looking for.";
  if (status === 409) return "That change can’t be made right now. Please review the details and try again.";
  if (status === 429) return "Please wait a moment, then try again.";
  if (status >= 500) return "Something went wrong. Please try again in a moment.";
  return "We couldn’t complete that. Please try again.";
}

let pendingRefresh: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!pendingRefresh) {
    pendingRefresh = performTokenRefresh().finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

async function performTokenRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  let response: Response;
  try {
    response = await fetchWithTimeout(apiUrl("auth/token/refresh/"), {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
  } catch {
    return false;
  }

  const payload = await readResponse(response);
  const access = response.ok ? findToken(payload) : null;
  if (!access || getRefreshToken() !== refresh) return false;
  setAccessToken(access);
  const rotatedRefresh = findToken(payload, ["refresh", "refresh_token", "refreshToken"]);
  if (rotatedRefresh) setRefreshToken(rotatedRefresh);
  return true;
}

/**
 * Make a request against the API. A single failed authenticated request is retried
 * after refreshing the locally stored JWT, so active sessions survive access-token expiry.
 */
export async function apiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let result = await sendRequest(path, init);
  const canRefresh = !path.startsWith("auth/login/") && !path.startsWith("auth/token/refresh/") && !path.startsWith("auth/token/blacklist/");

  if (result.response.status === 401 && canRefresh && await refreshAccessToken()) {
    result = await sendRequest(path, init);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) clearAuthTokens();
    throw new ApiRequestError(
      friendlyFailureMessage(result.response.status, result.payload),
      result.response.status,
      result.payload,
      retryAfterSeconds(result.response),
    );
  }

  const method = (init.method || "GET").toUpperCase();
  if (!path.startsWith("auth/") && !["GET", "HEAD", "OPTIONS"].includes(method)) notifyApiDataChanged();

  return result.payload as T;
}

/** Read API payloads that are wrapped in one or more `{ data: ... }` envelopes. */
export function unwrapApiData<T = unknown>(value: T): T {
  let unwrapped: unknown = value;
  while (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped) && Object.prototype.hasOwnProperty.call(unwrapped, "data")) {
    unwrapped = (unwrapped as ApiRecord).data;
  }
  return unwrapped as T;
}

/** Make a request and return the resource inside the API response envelope. */
export async function apiDataRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  return unwrapApiData<T>(await apiRequest(path, init));
}

export function listApiRecords(value: unknown): ApiRecord[] {
  const unwrapped = unwrapApiData(value);
  if (Array.isArray(unwrapped)) return unwrapped.filter((item): item is ApiRecord => !!item && typeof item === "object");
  if (unwrapped && typeof unwrapped === "object") {
    const obj = unwrapped as ApiRecord;
    for (const key of ["results", "items", "records"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter((item): item is ApiRecord => !!item && typeof item === "object");
    }
  }
  return [];
}

function jsonRequest(method: "POST" | "PUT" | "PATCH" | "DELETE", body?: ApiBody): RequestInit {
  if (!body) return { method };
  return { method, body: body instanceof FormData ? body : JSON.stringify(body) };
}

export type LoginResult = { token: string; user: ApiRecord };

export async function loginWithApi(identifier: string, password: string): Promise<LoginResult> {
  const payload = await apiRequest<unknown>("auth/login/", {
    method: "POST",
    body: JSON.stringify({ email: identifier, password }),
  });
  const token = findToken(payload);
  const refresh = findToken(payload, ["refresh", "refresh_token", "refreshToken"]);
  if (!token || !refresh) throw new Error("We couldn’t sign you in. Please try again.");
  setAccessToken(token);
  setRefreshToken(refresh);
  setStoredValue(SESSION_ACTIVITY_KEY, String(Date.now()));

  try {
    const profile = await apiDataRequest<ApiRecord>("auth/me/");
    const user = mergeUserRecords(payload, profile);
    setSignedInUser(user);
    return { token, user };
  } catch (error) {
    clearAuthTokens();
    throw error;
  }
}

export async function logoutFromApi() {
  const refresh = getRefreshToken();
  // Clear first so navigation cannot leave usable credentials in the browser.
  clearAuthTokens();
  if (!refresh) return;
  try {
    await apiRequest("auth/token/blacklist/", jsonRequest("POST", { refresh }));
  } catch {
    // Local logout remains successful if the server cannot be reached.
  }
}

export function getUserRole(value: ApiRecord): "admin" | "user" {
  const user = unwrapApiData<ApiRecord>(value);
  const roleRecord = user.role && typeof user.role === "object" ? user.role as ApiRecord : null;
  const roleValue = roleRecord?.name ?? roleRecord?.code ?? roleRecord?.slug ?? user.role ?? user.role_name ?? user.role_code ?? user.user_role ?? user.user_type ?? user.account_type;
  const role = String(roleValue ?? "").trim().toLowerCase();
  // `is_staff` is a Django administration flag, not this application's business-role
  // permission. A cashier, waiter, or storekeeper must not be routed to the admin UI
  // merely because their account can be considered staff by the backend.
  if (["admin", "administrator", "owner", "superuser", "manager"].includes(role) || user.is_admin === true || user.is_owner === true || user.is_superuser === true) return "admin";
  return "user";
}

export function getUserDisplayName(value: ApiRecord, identifier: string): string {
  const user = unwrapApiData<ApiRecord>(value);
  for (const key of ["full_name", "name", "display_name", "username", "email"]) {
    if (typeof user[key] === "string" && user[key]) return user[key] as string;
  }
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  if (`${first} ${last}`.trim()) return `${first} ${last}`.trim();
  return identifier.includes("@") ? identifier.split("@")[0] : identifier;
}

/** Endpoint catalogue generated from the live Board's Cafe API OpenAPI schema. */
export const boardsApi = {
  health: () => apiDataRequest<ApiRecord>("health/"),
  profile: () => apiDataRequest<ApiRecord>("auth/me/"),
  changePassword: (body: ApiRecord) => apiDataRequest<ApiRecord>("auth/password/change/", jsonRequest("POST", body)),
  updateProfile: (body: ApiRecord) => apiDataRequest<ApiRecord>("auth/me/", jsonRequest("PATCH", body)),
  staff: (query = "") => apiDataRequest<unknown>(`auth/${query}`),
  staffMember: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/`),
  createStaff: (body: ApiRecord) => apiDataRequest<ApiRecord>("auth/", jsonRequest("POST", body)),
  updateStaff: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`auth/${id}/`, jsonRequest("PATCH", body)),
  updateStaffEmail: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`auth/${id}/email/`, jsonRequest("PATCH", body)),
  resetStaffPassword: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`auth/${id}/password/reset/`, jsonRequest("POST", body)),
  deleteStaff: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/?confirm=true`, jsonRequest("DELETE")),
  deactivateStaff: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/?confirm=true`, jsonRequest("DELETE")),
  activateStaff: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/activate/`, jsonRequest("POST")),
  roles: (query = "") => apiDataRequest<unknown>(`roles/${query}`),
  createRole: (body: ApiRecord) => apiDataRequest<ApiRecord>("roles/", jsonRequest("POST", body)),
  updateRole: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`roles/${id}/`, jsonRequest("PATCH", body)),
  deleteRole: (id: number | string) => apiDataRequest(`roles/${id}/`, jsonRequest("DELETE")),
  clearRolePermissions: (id: number | string) => apiDataRequest(`roles/${id}/permissions/`, jsonRequest("DELETE")),
  activateRole: (id: number | string) => apiDataRequest<ApiRecord>(`roles/${id}/activate/`, jsonRequest("POST")),
  deactivateRole: (id: number | string) => apiDataRequest<ApiRecord>(`roles/${id}/deactivate/`, jsonRequest("POST")),
  permissions: (query = "") => apiDataRequest<unknown>(`roles/permissions/${query}`),

  dashboard: (query = "") => apiDataRequest<ApiRecord>(`dashboard/${query}`),
  businesses: () => apiDataRequest<unknown>("business/"),
  business: (id: number | string) => apiDataRequest<ApiRecord>(`business/${id}/`),
  createBusiness: (body: ApiBody) => apiDataRequest<ApiRecord>("business/", jsonRequest("POST", body)),
  updateBusiness: (id: number | string, body: ApiBody) => apiDataRequest<ApiRecord>(`business/${id}/`, jsonRequest("PATCH", body)),
  deleteBusiness: (id: number | string) => apiDataRequest(`business/${id}/`, jsonRequest("DELETE")),
  businessConfiguration: (businessId: number | string) => apiDataRequest<ApiRecord>(`business/${businessId}/configuration/`),
  updateBusinessConfiguration: (businessId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/configuration/`, jsonRequest("PATCH", body)),
  deleteBusinessConfiguration: (businessId: number | string) => apiDataRequest(`business/${businessId}/configuration/`, jsonRequest("DELETE")),
  floors: (businessId: number | string) => apiDataRequest<unknown>(`business/${businessId}/floors/`),
  createFloor: (businessId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/`, jsonRequest("POST", body)),
  updateFloor: (businessId: number | string, floorId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/`, jsonRequest("PATCH", body)),
  deleteFloor: (businessId: number | string, floorId: number | string) => apiDataRequest(`business/${businessId}/floors/${floorId}/`, jsonRequest("DELETE")),
  businessTables: (businessId: number | string, query = "") => apiDataRequest<unknown>(`business/${businessId}/tables/${query}`),
  createBusinessTable: (businessId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/tables/`, jsonRequest("POST", body)),
  updateBusinessTable: (businessId: number | string, tableId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/tables/${tableId}/`, jsonRequest("PATCH", body)),
  deleteBusinessTable: (businessId: number | string, tableId: number | string) => apiDataRequest(`business/${businessId}/tables/${tableId}/`, jsonRequest("DELETE")),
  tables: (businessId: number | string, floorId: number | string) => apiDataRequest<unknown>(`business/${businessId}/floors/${floorId}/tables/`),
  availableTables: (businessId: number | string, query = "") => apiDataRequest<unknown>(`business/${businessId}/tables/available/${query}`),
  createTable: (businessId: number | string, floorId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/tables/`, jsonRequest("POST", body)),
  updateTable: (businessId: number | string, floorId: number | string, tableId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/tables/${tableId}/`, jsonRequest("PATCH", body)),
  deleteTable: (businessId: number | string, floorId: number | string, tableId: number | string) => apiDataRequest(`business/${businessId}/floors/${floorId}/tables/${tableId}/`, jsonRequest("DELETE")),
  paymentMethods: () => apiDataRequest<unknown>("business/payment-methods/"),
  createPaymentMethod: (body: ApiRecord) => apiDataRequest<ApiRecord>("business/payment-methods/", jsonRequest("POST", body)),
  updatePaymentMethod: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/payment-methods/${id}/`, jsonRequest("PATCH", body)),
  deletePaymentMethod: (id: number | string) => apiDataRequest(`business/payment-methods/${id}/`, jsonRequest("DELETE")),

  expenseCategories: () => apiDataRequest<unknown>("finance/expense-categories/"),
  createExpenseCategory: (body: ApiRecord) => apiDataRequest<ApiRecord>("finance/expense-categories/", jsonRequest("POST", body)),
  deleteExpenseCategory: (id: number | string) => apiDataRequest(`finance/expense-categories/${id}/`, jsonRequest("DELETE")),
  expenses: (query = "") => apiDataRequest<unknown>(`finance/expenses/${query}`),
  createExpense: (body: ApiRecord) => apiDataRequest<ApiRecord>("finance/expenses/", jsonRequest("POST", body)),
  updateExpense: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`finance/expenses/${id}/`, jsonRequest("PATCH", body)),
  deleteExpense: (id: number | string) => apiDataRequest(`finance/expenses/${id}/`, jsonRequest("DELETE")),
  payments: (query = "") => apiDataRequest<unknown>(`finance/payments/${query}`),
  createPayment: (body: ApiRecord) => apiDataRequest<ApiRecord>("finance/payments/", jsonRequest("POST", body)),
  voidPayment: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`finance/payments/${id}/void/`, jsonRequest("POST", body)),
  refundPayment: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`finance/payments/${id}/refund/`, jsonRequest("POST", body)),
  cashShifts: (query = "") => apiDataRequest<unknown>(`finance/cash-shifts/${query}`),
  cashShift: (id: number | string) => apiDataRequest<ApiRecord>(`finance/cash-shifts/${id}/`),
  openCashShift: (body: ApiRecord) => apiDataRequest<ApiRecord>("finance/cash-shifts/", jsonRequest("POST", body)),
  closeCashShift: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`finance/cash-shifts/${id}/close/`, jsonRequest("POST", body)),
  approveCashShiftClose: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`finance/cash-shifts/${id}/approve-close/`, jsonRequest("POST", body)),

  inventoryCategories: () => apiDataRequest<unknown>("inventory/categories/"),
  createInventoryCategory: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/categories/", jsonRequest("POST", body)),
  updateInventoryCategory: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`inventory/categories/${id}/`, jsonRequest("PATCH", body)),
  deleteInventoryCategory: (id: number | string) => apiDataRequest(`inventory/categories/${id}/`, jsonRequest("DELETE")),
  inventoryItems: (query = "") => apiDataRequest<unknown>(`inventory/items/${query}`),
  createInventoryItem: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/items/", jsonRequest("POST", body)),
  updateInventoryItem: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`inventory/items/${id}/`, jsonRequest("PATCH", body)),
  deleteInventoryItem: (id: number | string) => apiDataRequest(`inventory/items/${id}/`, jsonRequest("DELETE")),
  stockBalances: (query = "") => apiDataRequest<unknown>(`inventory/stock-balances/${query}`),
  stockMovements: (query = "") => apiDataRequest<unknown>(`inventory/movements/${query}`),
  createStockAdjustment: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/adjustments/", jsonRequest("POST", body)),
  inventoryUnits: () => apiDataRequest<unknown>("inventory/units/"),
  createInventoryUnit: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/units/", jsonRequest("POST", body)),
  deleteInventoryUnit: (id: number | string) => apiDataRequest(`inventory/units/${id}/`, jsonRequest("DELETE")),

  menuCategories: () => apiDataRequest<unknown>("menu/categories/"),
  createMenuCategory: (body: ApiRecord) => apiDataRequest<ApiRecord>("menu/categories/", jsonRequest("POST", body)),
  deleteMenuCategory: (id: number | string) => apiDataRequest(`menu/categories/${id}/`, jsonRequest("DELETE")),
  menuProducts: () => apiDataRequest<unknown>("menu/products/"),
  createMenuProduct: (body: ApiBody) => apiDataRequest<ApiRecord>("menu/products/", jsonRequest("POST", body)),
  updateMenuProduct: (id: number | string, body: ApiBody) => apiDataRequest<ApiRecord>(`menu/products/${id}/`, jsonRequest("PATCH", body)),
  deleteMenuProduct: (id: number | string) => apiDataRequest(`menu/products/${id}/`, jsonRequest("DELETE")),
  menuVariants: () => apiDataRequest<unknown>("menu/variants/"),
  deleteMenuVariant: (id: number | string) => apiDataRequest(`menu/variants/${id}/`, jsonRequest("DELETE")),

  suppliers: (query = "") => apiDataRequest<unknown>(`purchasing/suppliers/${query}`),
  createSupplier: (body: ApiRecord) => apiDataRequest<ApiRecord>("purchasing/suppliers/", jsonRequest("POST", body)),
  updateSupplier: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/suppliers/${id}/`, jsonRequest("PATCH", body)),
  deleteSupplier: (id: number | string) => apiDataRequest(`purchasing/suppliers/${id}/`, jsonRequest("DELETE")),
  deactivateSupplier: (id: number | string) => apiDataRequest<ApiRecord>(`purchasing/suppliers/${id}/deactivate/`, jsonRequest("POST")),
  purchases: (query = "") => apiDataRequest<unknown>(`purchasing/purchases/${query}`),
  createPurchase: (body: ApiRecord) => apiDataRequest<ApiRecord>("purchasing/purchases/", jsonRequest("POST", body)),
  updatePurchase: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/`, jsonRequest("PATCH", body)),
  deletePurchase: (id: number | string) => apiDataRequest(`purchasing/purchases/${id}/`, jsonRequest("DELETE")),
  submitPurchase: (id: number | string) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/submit/`, jsonRequest("POST")),
  receivePurchase: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/receive/`, jsonRequest("POST", body)),

  recipes: (query = "") => apiDataRequest<unknown>(`recipes/${query}`),
  recipe: (id: number | string) => apiDataRequest<ApiRecord>(`recipes/${id}/`),
  createRecipe: (body: ApiRecord) => apiDataRequest<ApiRecord>("recipes/", jsonRequest("POST", body)),
  updateRecipe: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`recipes/${id}/`, jsonRequest("PATCH", body)),
  deleteRecipe: (id: number | string) => apiDataRequest(`recipes/${id}/`, jsonRequest("DELETE")),
  recipeIngredients: (recipeId: number | string) => apiDataRequest<unknown>(`recipes/${recipeId}/ingredients/`),
  createRecipeIngredient: (recipeId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`recipes/${recipeId}/ingredients/`, jsonRequest("POST", body)),
  updateRecipeIngredient: (recipeId: number | string, ingredientId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`recipes/${recipeId}/ingredients/${ingredientId}/`, jsonRequest("PATCH", body)),
  deleteRecipeIngredient: (recipeId: number | string, ingredientId: number | string) => apiDataRequest(`recipes/${recipeId}/ingredients/${ingredientId}/`, jsonRequest("DELETE")),
  productionRuns: (query = "") => apiDataRequest<unknown>(`production-runs/${query}`),
  productionRun: (id: number | string) => apiDataRequest<ApiRecord>(`production-runs/${id}/`),
  createProductionRun: (body: ApiRecord) => apiDataRequest<ApiRecord>("production-runs/", jsonRequest("POST", body)),
  updateProductionRun: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`production-runs/${id}/`, jsonRequest("PATCH", body)),
  cancelProductionRun: (id: number | string) => apiDataRequest<ApiRecord>(`production-runs/${id}/cancel/`, jsonRequest("POST")),
  productStockBalances: (query = "") => apiDataRequest<unknown>(`inventory/product-stock-balances/${query}`),
  createProductStockAdjustment: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/product-stock-adjustments/", jsonRequest("POST", body)),
  productionProductStockBalances: (query = "") => apiDataRequest<unknown>(`production-runs/product-stock-balances/${query}`),
  productStockMovements: (query = "") => apiDataRequest<unknown>(`production-runs/product-stock-movements/${query}`),

  orders: (query = "") => apiDataRequest<unknown>(`sales/orders/${query}`),
  order: (id: number | string) => apiDataRequest<ApiRecord>(`sales/orders/${id}/`),
  createOrder: (body: ApiRecord) => apiDataRequest<ApiRecord>("sales/orders/", jsonRequest("POST", body)),
  updateOrder: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`sales/orders/${id}/`, jsonRequest("PATCH", body)),
  deleteOrder: (id: number | string) => apiDataRequest(`sales/orders/${id}/`, jsonRequest("DELETE")),
  submitOrder: (id: number | string) => apiDataRequest<ApiRecord>(`sales/orders/${id}/submit/`, jsonRequest("POST")),
  cancelOrder: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`sales/orders/${id}/cancel/`, jsonRequest("POST", body)),
  orderReceipt: (id: number | string) => apiDataRequest<ApiRecord>(`sales/orders/${id}/receipt/`),

  reports: {
    sales: (query = "") => apiDataRequest<ApiRecord>(`reports/sales/${query}`),
    expenses: (query = "") => apiDataRequest<ApiRecord>(`reports/expenses/${query}`),
    purchases: (query = "") => apiDataRequest<ApiRecord>(`reports/purchases/${query}`),
    inventory: () => apiDataRequest<ApiRecord>("reports/inventory/"),
    dailySummary: (query = "") => apiDataRequest<ApiRecord>(`reports/daily-summary/${query}`),
    salesPerformance: (query = "") => apiDataRequest<ApiRecord>(`reports/sales-performance/${query}`),
    inventoryReorder: (query = "") => apiDataRequest<ApiRecord>(`reports/inventory/reorder/${query}`),
    inventoryMovements: (query = "") => apiDataRequest<ApiRecord>(`reports/inventory/movements/${query}`),
    production: (query = "") => apiDataRequest<ApiRecord>(`reports/production/${query}`),
    purchasingSuppliers: (query = "") => apiDataRequest<ApiRecord>(`reports/purchasing-suppliers/${query}`),
    profitLoss: (query = "") => apiDataRequest<ApiRecord>(`reports/profit-loss/${query}`),
    audit: (query = "") => apiDataRequest<ApiRecord>(`reports/audit/${query}`),
    taxCompliance: (query = "") => apiDataRequest<ApiRecord>(`reports/tax-compliance/${query}`),
  },
};
