export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'x-requested-with': 'silmara-web',
  };
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  } else if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = '{}';
  }

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique sua rede.', 0);
  }

  let data: Record<string, unknown> = {};
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('silmara:unauthorized'));
    }
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Não foi possível concluir a ação.',
      response.status,
      data,
    );
  }

  return data as T;
}

export const api = {
  get<T>(path: string) {
    return request<T>('GET', path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>('POST', path, body);
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>('PATCH', path, body);
  },
  delete<T>(path: string, body?: unknown) {
    return request<T>('DELETE', path, body);
  },
};
