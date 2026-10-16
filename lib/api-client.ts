/** Shared client for the Boards Cafe REST API (OpenAPI v1). */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://boards-cafe-api.onrender.com/api/v1").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "boards-cafe-access-token";
const REFRESH_TOKEN_KEY = "boards-cafe-refresh-token";
const SIGNED_IN_USER_KEY = "boards-cafe-signed-in-user";
const API_DATA_CHANGED_EVENT = "boards-cafe-api-data-changed";
const API_REQUEST_TIMEOUT_MS = 15_000;

export type ApiRecord = Record<string, unknown>;
export type ApiBody = ApiRecord | FormData;

/** A request failure with private response context for safe, local recovery logic. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
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

function setSignedInUser(user: ApiRecord) {
  setStoredValue(SIGNED_IN_USER_KEY, JSON.stringify(user));
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

function friendlyFailureMessage(status: number): string {
  if (status === 400 || status === 422) return "Please check the details and try again.";
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don’t have permission to do that.";
  if (status === 404) return "We couldn’t find what you were looking for.";
  if (status === 409) return "That change can’t be made right now. Please review the details and try again.";
  if (status === 429) return "Please wait a moment, then try again.";
  if (status >= 500) return "Something went wrong. Please try again in a moment.";
  return "We couldn’t complete that. Please try again.";
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  let response: Response;
  try {
    response = await fetchWithTimeout(apiUrl("auth/token/refresh/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
  } catch {
    return false;
  }

  const payload = await readResponse(response);
  const access = response.ok ? findToken(payload) : null;
  if (!access) return false;
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
    throw new ApiRequestError(friendlyFailureMessage(result.response.status), result.response.status, result.payload);
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
  deactivateStaff: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/?confirm=true`, jsonRequest("DELETE")),
  activateStaff: (id: number | string) => apiDataRequest<ApiRecord>(`auth/${id}/activate/`, jsonRequest("POST")),
  roles: (query = "") => apiDataRequest<unknown>(`roles/${query}`),
  createRole: (body: ApiRecord) => apiDataRequest<ApiRecord>("roles/", jsonRequest("POST", body)),
  updateRole: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`roles/${id}/`, jsonRequest("PATCH", body)),
  deleteRole: (id: number | string) => apiDataRequest(`roles/${id}/`, jsonRequest("DELETE")),
  activateRole: (id: number | string) => apiDataRequest<ApiRecord>(`roles/${id}/activate/`, jsonRequest("POST")),
  deactivateRole: (id: number | string) => apiDataRequest<ApiRecord>(`roles/${id}/deactivate/`, jsonRequest("POST")),
  permissions: (query = "") => apiDataRequest<unknown>(`roles/permissions/${query}`),

  dashboard: (query = "") => apiDataRequest<ApiRecord>(`dashboard/${query}`),
  businesses: () => apiDataRequest<unknown>("business/"),
  business: (id: number | string) => apiDataRequest<ApiRecord>(`business/${id}/`),
  createBusiness: (body: ApiBody) => apiDataRequest<ApiRecord>("business/", jsonRequest("POST", body)),
  updateBusiness: (id: number | string, body: ApiBody) => apiDataRequest<ApiRecord>(`business/${id}/`, jsonRequest("PATCH", body)),
  businessConfiguration: (businessId: number | string) => apiDataRequest<ApiRecord>(`business/${businessId}/configuration/`),
  updateBusinessConfiguration: (businessId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/configuration/`, jsonRequest("PATCH", body)),
  floors: (businessId: number | string) => apiDataRequest<unknown>(`business/${businessId}/floors/`),
  createFloor: (businessId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/`, jsonRequest("POST", body)),
  updateFloor: (businessId: number | string, floorId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/`, jsonRequest("PATCH", body)),
  deleteFloor: (businessId: number | string, floorId: number | string) => apiDataRequest(`business/${businessId}/floors/${floorId}/`, jsonRequest("DELETE")),
  tables: (businessId: number | string, floorId: number | string) => apiDataRequest<unknown>(`business/${businessId}/floors/${floorId}/tables/`),
  createTable: (businessId: number | string, floorId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/tables/`, jsonRequest("POST", body)),
  updateTable: (businessId: number | string, floorId: number | string, tableId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/${businessId}/floors/${floorId}/tables/${tableId}/`, jsonRequest("PATCH", body)),
  deleteTable: (businessId: number | string, floorId: number | string, tableId: number | string) => apiDataRequest(`business/${businessId}/floors/${floorId}/tables/${tableId}/`, jsonRequest("DELETE")),
  paymentMethods: () => apiDataRequest<unknown>("business/payment-methods/"),
  createPaymentMethod: (body: ApiRecord) => apiDataRequest<ApiRecord>("business/payment-methods/", jsonRequest("POST", body)),
  updatePaymentMethod: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`business/payment-methods/${id}/`, jsonRequest("PATCH", body)),
  deletePaymentMethod: (id: number | string) => apiDataRequest(`business/payment-methods/${id}/`, jsonRequest("DELETE")),

  expenseCategories: () => apiDataRequest<unknown>("finance/expense-categories/"),
  createExpenseCategory: (body: ApiRecord) => apiDataRequest<ApiRecord>("finance/expense-categories/", jsonRequest("POST", body)),
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
  inventoryItems: (query = "") => apiDataRequest<unknown>(`inventory/items/${query}`),
  createInventoryItem: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/items/", jsonRequest("POST", body)),
  updateInventoryItem: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`inventory/items/${id}/`, jsonRequest("PATCH", body)),
  stockBalances: (query = "") => apiDataRequest<unknown>(`inventory/stock-balances/${query}`),
  stockMovements: (query = "") => apiDataRequest<unknown>(`inventory/movements/${query}`),
  createStockAdjustment: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/adjustments/", jsonRequest("POST", body)),
  inventoryUnits: () => apiDataRequest<unknown>("inventory/units/"),
  createInventoryUnit: (body: ApiRecord) => apiDataRequest<ApiRecord>("inventory/units/", jsonRequest("POST", body)),

  menuCategories: () => apiDataRequest<unknown>("menu/categories/"),
  createMenuCategory: (body: ApiRecord) => apiDataRequest<ApiRecord>("menu/categories/", jsonRequest("POST", body)),
  menuProducts: () => apiDataRequest<unknown>("menu/products/"),
  createMenuProduct: (body: ApiBody) => apiDataRequest<ApiRecord>("menu/products/", jsonRequest("POST", body)),
  updateMenuProduct: (id: number | string, body: ApiBody) => apiDataRequest<ApiRecord>(`menu/products/${id}/`, jsonRequest("PATCH", body)),
  deleteMenuProduct: (id: number | string) => apiDataRequest(`menu/products/${id}/`, jsonRequest("DELETE")),
  menuVariants: () => apiDataRequest<unknown>("menu/variants/"),

  suppliers: (query = "") => apiDataRequest<unknown>(`purchasing/suppliers/${query}`),
  createSupplier: (body: ApiRecord) => apiDataRequest<ApiRecord>("purchasing/suppliers/", jsonRequest("POST", body)),
  updateSupplier: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/suppliers/${id}/`, jsonRequest("PATCH", body)),
  deactivateSupplier: (id: number | string) => apiDataRequest<ApiRecord>(`purchasing/suppliers/${id}/deactivate/`, jsonRequest("POST")),
  purchases: (query = "") => apiDataRequest<unknown>(`purchasing/purchases/${query}`),
  createPurchase: (body: ApiRecord) => apiDataRequest<ApiRecord>("purchasing/purchases/", jsonRequest("POST", body)),
  updatePurchase: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/`, jsonRequest("PATCH", body)),
  deletePurchase: (id: number | string) => apiDataRequest(`purchasing/purchases/${id}/`, jsonRequest("DELETE")),
  submitPurchase: (id: number | string) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/submit/`, jsonRequest("POST")),
  receivePurchase: (id: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`purchasing/purchases/${id}/receive/`, jsonRequest("POST", body)),

  recipes: () => apiDataRequest<unknown>("recipes/"),
  createRecipe: (body: ApiRecord) => apiDataRequest<ApiRecord>("recipes/", jsonRequest("POST", body)),
  recipeIngredients: (recipeId: number | string) => apiDataRequest<unknown>(`recipes/${recipeId}/ingredients/`),
  createRecipeIngredient: (recipeId: number | string, body: ApiRecord) => apiDataRequest<ApiRecord>(`recipes/${recipeId}/ingredients/`, jsonRequest("POST", body)),

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
  },
};
