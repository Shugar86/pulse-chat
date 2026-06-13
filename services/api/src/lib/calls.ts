export type CallStatus = 'dialing' | 'connected' | 'ended';

export interface CallSession {
  callId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
}

const sessions = new Map<string, CallSession>();
const activeUserCalls = new Map<string, string>(); // userId -> callId

export function createCallSession(callId: string, callerId: string, calleeId: string): CallSession | null {
  if (activeUserCalls.has(callerId) || activeUserCalls.has(calleeId)) return null;
  const session: CallSession = { callId, callerId, calleeId, status: 'dialing' };
  sessions.set(callId, session);
  activeUserCalls.set(callerId, callId);
  activeUserCalls.set(calleeId, callId);
  return session;
}

export function getCallSession(callId: string): CallSession | undefined {
  return sessions.get(callId);
}

export function connectCallSession(callId: string): boolean {
  const session = sessions.get(callId);
  if (!session || session.status !== 'dialing') return false;
  session.status = 'connected';
  session.startedAt = new Date();
  return true;
}

export function endCallSession(callId: string): CallSession | undefined {
  const session = sessions.get(callId);
  if (!session) return undefined;
  session.status = 'ended';
  session.endedAt = new Date();
  activeUserCalls.delete(session.callerId);
  activeUserCalls.delete(session.calleeId);
  return session;
}

export function getActiveCallId(userId: string): string | undefined {
  return activeUserCalls.get(userId);
}
