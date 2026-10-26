// Unified API Client with Credential Support and Single-Winner Refresh Mutex

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (success, error = null) => {
  refreshSubscribers.forEach((cb) => cb(success, error));
  refreshSubscribers = [];
};

// Event emitter callback for auth expiration
let authExpiredHandler = null;
export const setAuthExpiredHandler = (handler) => {
  authExpiredHandler = handler;
};

export async function apiClient(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = {
    ...(options.headers || {}),
  };

  // If body is NOT FormData, default to application/json
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include", // Essential for HttpOnly cookie transport
  };

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type");
    let responseData = null;

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Check if unauthorized and candidates for refresh
    if (
      response.status === 401 &&
      !endpoint.includes("/auth/login") &&
      !endpoint.includes("/auth/refresh-token") &&
      !endpoint.includes("/auth/register")
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          // Attempt silent refresh using HttpOnly refresh cookie
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          if (refreshRes.ok) {
            isRefreshing = false;
            onRefreshed(true);
            // Retry the original request
            return apiClient(endpoint, options);
          } else {
            isRefreshing = false;
            onRefreshed(false, new Error("Session expired"));
            if (authExpiredHandler) authExpiredHandler();
            throw new Error(
              responseData?.message || "Session expired. Please log in again.",
            );
          }
        } catch (refreshErr) {
          isRefreshing = false;
          onRefreshed(false, refreshErr);
          if (authExpiredHandler) authExpiredHandler();
          throw refreshErr;
        }
      } else {
        // Refresh is currently in flight, enqueue this request
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((success, error) => {
            if (success) {
              resolve(apiClient(endpoint, options));
            } else {
              reject(error || new Error("Session expired"));
            }
          });
        });
      }
    }

    if (!response.ok) {
      const errorMessage =
        responseData?.message ||
        `Request failed with status ${response.status}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.data = responseData;
      err.errors = responseData?.errors || [];
      throw err;
    }

    // Backend success format: { statuscode, data, message, success }
    return responseData;
  } catch (error) {
    throw error;
  }
}
