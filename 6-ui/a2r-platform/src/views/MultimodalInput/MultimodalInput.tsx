/**
 * Multimodal Input Component
 * 
 * Real-time vision and audio streaming:
 * - Camera capture
 * - Microphone capture
 * - Stream preview
 * - Synchronization indicator
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Square,
  Circle,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';

// WebSocket base URL
const WS_BASE = `ws://${window.location.host}/api/v1/multimodal/ws`;

export function MultimodalInput() {
  // Stream states
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [multimodalEnabled, setMultimodalEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'drifting' | 'disconnected'>('disconnected');

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Stats
  const [framesSent, setFramesSent] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [latency, setLatency] = useState(0);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      mediaStreamRef.current = stream;
      setVisionEnabled(true);
      connectWebSocket('vision');
    } catch (err) {
      console.error('Camera error:', err);
      setVisionEnabled(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVisionEnabled(false);
    disconnectWebSocket();
  }, []);

  // Initialize microphone
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 2 },
      });

      mediaStreamRef.current = stream;

      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const monitorAudio = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          requestAnimationFrame(monitorAudio);
        }
      };
      monitorAudio();

      setAudioEnabled(true);
      connectWebSocket('audio');
    } catch (err) {
      console.error('Microphone error:', err);
      setAudioEnabled(false);
    }
  }, []);

  // Stop microphone
  const stopMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioEnabled(false);
    disconnectWebSocket();
  }, []);

  // Connect WebSocket
  const connectWebSocket = (type: 'vision' | 'audio' | 'multimodal') => {
    const ws = new WebSocket(`${WS_BASE}/${type}`);

    ws.onopen = () => {
      setConnected(true);
      setSyncStatus('synced');
    };

    ws.onclose = () => {
      setConnected(false);
      setSyncStatus('disconnected');
    };

    ws.onerror = () => {
      setSyncStatus('drifting');
    };

    wsRef.current = ws;
  };

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // Send video frames
  useEffect(() => {
    if (!visionEnabled || !videoRef.current || !wsRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 480;

    const sendFrame = () => {
      if (videoRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob && wsRef.current) {
            wsRef.current.send(blob);
            setFramesSent(prev => prev + 1);
          }
        }, 'image/jpeg', 0.8);
      }
      requestAnimationFrame(sendFrame);
    };

    const frameInterval = setInterval(sendFrame, 1000 / 30); // 30 FPS
    return () => clearInterval(frameInterval);
  }, [visionEnabled]);

  // Update sync status based on latency
  useEffect(() => {
    const checkLatency = () => {
      if (connected && wsRef.current) {
        const start = performance.now();
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        setLatency(performance.now() - start);

        if (latency > 200) {
          setSyncStatus('drifting');
        } else {
          setSyncStatus('synced');
        }
      }
    };

    const interval = setInterval(checkLatency, 5000);
    return () => clearInterval(interval);
  }, [connected, latency]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
      stopMicrophone();
      disconnectWebSocket();
    };
  }, [stopCamera, stopMicrophone, disconnectWebSocket]);

  // Start multimodal (both vision and audio)
  const startMultimodal = async () => {
    await startCamera();
    await startMicrophone();
    setMultimodalEnabled(true);
    connectWebSocket('multimodal');
  };

  // Stop all
  const stopAll = () => {
    stopCamera();
    stopMicrophone();
    setMultimodalEnabled(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Multimodal Input</h1>
          <p className="text-muted-foreground">
            Real-time vision and audio streaming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'default' : 'secondary'}>
            {connected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
          <Badge variant={syncStatus === 'synced' ? 'default' : syncStatus === 'drifting' ? 'destructive' : 'secondary'}>
            <Activity className="h-3 w-3 mr-1" />
            {syncStatus === 'synced' ? 'Synced' : syncStatus === 'drifting' ? 'Drifting' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Main Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Vision Control */}
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
              <Camera className={`h-12 w-12 ${visionEnabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <div className="flex items-center gap-2">
                <Switch
                  checked={visionEnabled}
                  onCheckedChange={visionEnabled ? stopCamera : startCamera}
                  id="vision-switch"
                />
                <Label htmlFor="vision-switch">Camera</Label>
              </div>
            </div>

            {/* Audio Control */}
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
              {audioEnabled ? (
                <Mic className="h-12 w-12 text-green-500" />
              ) : (
                <MicOff className="h-12 w-12 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={audioEnabled}
                  onCheckedChange={audioEnabled ? stopMicrophone : startMicrophone}
                  id="audio-switch"
                />
                <Label htmlFor="audio-switch">Microphone</Label>
              </div>
              {audioEnabled && (
                <div className="w-full">
                  <Slider
                    value={[audioLevel]}
                    max={255}
                    step={1}
                    className="mt-2"
                  />
                </div>
              )}
            </div>

            {/* Multimodal Control */}
            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
              {multimodalEnabled ? (
                <Video className="h-12 w-12 text-purple-500" />
              ) : (
                <VideoOff className="h-12 w-12 text-muted-foreground" />
              )}
              <div className="flex gap-2">
                <Button
                  onClick={multimodalEnabled ? stopAll : startMultimodal}
                  variant={multimodalEnabled ? 'destructive' : 'default'}
                >
                  {multimodalEnabled ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop All
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4 mr-2" />
                      Start All
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Preview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Video Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!visionEnabled && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <Camera className="h-12 w-12" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Stream Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frames Sent</span>
                <span className="font-mono">{framesSent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audio Level</span>
                <span className="font-mono">{audioLevel.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono">{latency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection</span>
                <Badge variant={connected ? 'default' : 'secondary'}>
                  {connected ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sync Status</span>
                <Badge variant={syncStatus === 'synced' ? 'default' : syncStatus === 'drifting' ? 'destructive' : 'secondary'}>
                  {syncStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Video Resolution</Label>
              <select className="w-full mt-2 p-2 border rounded-md">
                <option value="720p">1280x720 (HD)</option>
                <option value="480p">640x480 (SD)</option>
                <option value="360p">480x360 (Low)</option>
              </select>
            </div>
            <div>
              <Label>Frame Rate</Label>
              <select className="w-full mt-2 p-2 border rounded-md">
                <option value="30">30 FPS</option>
                <option value="24">24 FPS</option>
                <option value="15">15 FPS</option>
              </select>
            </div>
            <div>
              <Label>Audio Sample Rate</Label>
              <select className="w-full mt-2 p-2 border rounded-md">
                <option value="48000">48 kHz</option>
                <option value="44100">44.1 kHz</option>
                <option value="16000">16 kHz</option>
              </select>
            </div>
            <div>
              <Label>Audio Channels</Label>
              <select className="w-full mt-2 p-2 border rounded-md">
                <option value="2">Stereo (2)</option>
                <option value="1">Mono (1)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MultimodalInput;
