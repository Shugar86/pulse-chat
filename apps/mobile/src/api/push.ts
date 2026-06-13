import { api } from './client';

export function registerPushToken(token: string, platform: 'android' | 'ios') {
  return api.post('/push/register', { token, platform }).then((r) => r.data);
}

export function unregisterPushToken(token: string) {
  return api.delete('/push/unregister', { data: { token } }).then((r) => r.data);
}
