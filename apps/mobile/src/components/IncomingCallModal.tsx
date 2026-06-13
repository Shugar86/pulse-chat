import React from 'react';
import { Modal } from 'react-native';
import { CallScreen } from './CallScreen';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ visible, callerName, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <CallScreen title={callerName} subtitle="Incoming call" onHangUp={onDecline} onAccept={onAccept} />
    </Modal>
  );
}
