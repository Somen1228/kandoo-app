import { auth } from '../config/firebase';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function getAuthToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new ApiError('Sign in to use cloud sync', 401);
  return currentUser.getIdToken();
}

export async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('Kandoo API timed out', 0);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `API request failed (${response.status})`, response.status, data);
  }
  return data;
}

export const workspaceApi = {
  get: () => apiRequest('/api/workspace'),
  save: (boards, baseRevision, force = false) => apiRequest('/api/workspace', {
    method: 'PUT',
    body: JSON.stringify({ boards, baseRevision, force }),
  }),
};
