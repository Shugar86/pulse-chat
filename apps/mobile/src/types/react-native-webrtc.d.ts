declare module 'react-native-webrtc' {
  export class RTCPeerConnection {
    constructor(config: any);
    addTrack(track: any, stream: MediaStream): any;
    createOffer(options?: any): Promise<RTCSessionDescription>;
    createAnswer(options?: any): Promise<RTCSessionDescription>;
    setLocalDescription(desc: RTCSessionDescription): Promise<void>;
    setRemoteDescription(desc: RTCSessionDescription): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    close(): void;
    ontrack?: (event: any) => void;
    onicecandidate?: (event: any) => void;
  }
  export class RTCSessionDescription {
    constructor(init: { type: 'offer' | 'answer'; sdp: string });
    sdp: string;
    type: string;
  }
  export class RTCIceCandidate {
    constructor(init: any);
    toJSON(): any;
  }
  export class MediaStream {
    getAudioTracks(): any[];
    getTracks(): any[];
  }
  export const mediaDevices: {
    getUserMedia(constraints: { audio?: boolean; video?: boolean }): Promise<MediaStream>;
  };
}
