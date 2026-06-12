import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then(() => {
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    SecureStore.getItemAsync('accessToken').then((token) => {
      if (!token) return;
      const API_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {authResolved ? children : null}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
