import { useCallback, useEffect, useRef, useState } from 'react';
import { RTCPeerConnection, RTCSessionDescription, MediaStream } from 'react-native-webrtc';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  setLocalDescription,
  setRemoteDescription,
  addIceCandidate,
  getUserAudioStream,
  IceServersResponse,
} from '../lib/webrtc';

export type CallState = 'idle' | 'dialing' | 'incoming' | 'connected' | 'ended' | 'busy' | 'rejected' | 'timeout';

export interface Call {
  callId: string;
  remoteUserId: string;
  state: CallState;
}

export function useCall() {
  const socket = useSocket();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const closeCall = useCallback((callId: string) => {
    if (activeCall?.callId !== callId) return;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setActiveCall((prev) => (prev?.callId === callId ? null : prev));
  }, [activeCall]);

  const startCall = useCallback(async (toUserId: string): Promise<Call> => {
    if (!socket) throw new Error('Socket not connected');
    const id = crypto.randomUUID();
    setActiveCall({ callId: id, remoteUserId: toUserId, state: 'dialing' });

    const { data } = await api.get<IceServersResponse>('/turn/credentials');
    const pc = createPeerConnection(data.iceServers);
    pcRef.current = pc;

    const local = await getUserAudioStream();
    localStreamRef.current = local;
    local.getAudioTracks().forEach((track) => pc.addTrack(track, local));

    pc.ontrack = (event: any) => {
      remoteStreamRef.current = event.streams[0];
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { callId: id, candidate: event.candidate.toJSON() });
      }
    };

    const offer = await createOffer(pc);
    await setLocalDescription(pc, offer);
    socket.emit('call:offer', { callId: id, toUserId, sdp: offer.sdp });

    return { callId: id, remoteUserId: toUserId, state: 'dialing' };
  }, [socket]);

  const acceptCall = useCallback(async (incomingCallId: string, fromUserId: string, offerSdp: string): Promise<Call> => {
    if (!socket) throw new Error('Socket not connected');
    setActiveCall({ callId: incomingCallId, remoteUserId: fromUserId, state: 'incoming' });

    const { data } = await api.get<IceServersResponse>('/turn/credentials');
    const pc = createPeerConnection(data.iceServers);
    pcRef.current = pc;

    const local = await getUserAudioStream();
    localStreamRef.current = local;
    local.getAudioTracks().forEach((track) => pc.addTrack(track, local));

    pc.ontrack = (event: any) => {
      remoteStreamRef.current = event.streams[0];
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { callId: incomingCallId, candidate: event.candidate.toJSON() });
      }
    };

    await setRemoteDescription(pc, new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
    const answer = await createAnswer(pc);
    await setLocalDescription(pc, answer);
    socket.emit('call:answer', { callId: incomingCallId, sdp: answer.sdp });
    setActiveCall({ callId: incomingCallId, remoteUserId: fromUserId, state: 'connected' });

    return { callId: incomingCallId, remoteUserId: fromUserId, state: 'connected' };
  }, [socket]);

  const rejectCall = useCallback((callId: string) => {
    if (!socket) return;
    socket.emit('call:reject', { callId });
    closeCall(callId);
  }, [socket, closeCall]);

  const hangUp = useCallback((callId: string) => {
    if (!socket) return;
    socket.emit('call:hangup', { callId });
    closeCall(callId);
  }, [socket, closeCall]);

  useEffect(() => {
    if (!socket || !activeCall) return;
    const callId = activeCall.callId;

    const onAnswer = async ({ callId: id, sdp }: { callId: string; sdp: string }) => {
      if (id !== callId || !pcRef.current) return;
      await setRemoteDescription(pcRef.current, new RTCSessionDescription({ type: 'answer', sdp }));
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'connected' } : prev));
    };

    const onIceCandidate = async ({ callId: id, candidate }: { callId: string; candidate: any }) => {
      if (id !== callId || !pcRef.current) return;
      await addIceCandidate(pcRef.current, candidate);
    };

    const onHangUp = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      closeCall(callId);
    };

    const onReject = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'rejected' } : prev));
      closeCall(callId);
    };

    const onTimeout = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'timeout' } : prev));
      closeCall(callId);
    };

    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:hangup', onHangUp);
    socket.on('call:reject', onReject);
    socket.on('call:timeout', onTimeout);

    return () => {
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:hangup', onHangUp);
      socket.off('call:reject', onReject);
      socket.off('call:timeout', onTimeout);
    };
  }, [socket, activeCall, closeCall]);

  return {
    activeCall,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
  };
}
