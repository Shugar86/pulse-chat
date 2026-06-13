import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSocket } from './SocketContext';
import { useCall } from '../hooks/useCall';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { useAuthStore } from '../stores/authStore';
import type { MainStackParamList } from '../navigation/types';

interface IncomingCall {
  callId: string;
  fromUserId: string;
  displayName: string;
  sdp: string;
}

const CallContext = createContext<ReturnType<typeof useCall> | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocket();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const call = useCall();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ callId, fromUserId, sdp }: any) => {
      if (call.activeCall) {
        socket.emit('call:busy', { callId, toUserId: fromUserId });
        return;
      }
      const contactName = user?.tenants
        .flatMap((m) => (m.tenant as any).members || [])
        .find((u: any) => u.id === fromUserId)?.displayName || fromUserId;
      setIncoming({ callId, fromUserId, displayName: contactName, sdp });
    };
    socket.on('call:incoming', onIncoming);
    return () => { socket.off('call:incoming', onIncoming); };
  }, [socket, user, call.activeCall]);

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    await call.acceptCall(incoming.callId, incoming.fromUserId, incoming.sdp);
    setIncoming(null);
    navigation.navigate('Call', { userId: incoming.fromUserId, displayName: incoming.displayName });
  }, [incoming, call, navigation]);

  const handleDecline = useCallback(() => {
    if (!incoming) return;
    call.rejectCall(incoming.callId);
    setIncoming(null);
  }, [incoming, call]);

  return (
    <CallContext.Provider value={call}>
      {children}
      <IncomingCallModal
        visible={!!incoming}
        callerName={incoming?.displayName || ''}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
}
