import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

export interface IceServersResponse {
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
}

export async function getUserAudioStream(): Promise<MediaStream> {
  return mediaDevices.getUserMedia({ audio: true, video: false }) as Promise<MediaStream>;
}

export function createPeerConnection(iceServers: any[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescription> {
  return pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
}

export async function createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescription> {
  return pc.createAnswer();
}

export async function setLocalDescription(pc: RTCPeerConnection, desc: RTCSessionDescription) {
  await pc.setLocalDescription(desc);
}

export async function setRemoteDescription(pc: RTCPeerConnection, desc: RTCSessionDescription) {
  await pc.setRemoteDescription(desc);
}

export async function addIceCandidate(pc: RTCPeerConnection, candidate: any) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}
