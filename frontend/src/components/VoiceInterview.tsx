// frontend/src/components/VoiceInterview.tsx
import React, { useState, useRef, useEffect } from 'react';

type Props = {
  sessionId: string;
  profile: {
    role: string;
    interviewType: string;
    yearsOfExperience: number | string;
  };
  onComplete: () => void;
};

export default function VoiceInterview({ sessionId, profile, onComplete }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRecordingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE;

  // Detect Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  useEffect(() => {
    console.log('Browser check:');
    console.log('User Agent:', navigator.userAgent);
    console.log('Is Safari:', isSafari);
    console.log('MediaRecorder available:', !!window.MediaRecorder);
    console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
    
    if (window.MediaRecorder) {
      // Safari-specific MIME types first, then others
      const types = [
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',  // AAC-LC
        'audio/mp4;codecs=aac',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      console.log('Supported MIME types:');
      types.forEach(type => {
        const supported = MediaRecorder.isTypeSupported(type);
        console.log(`  ${type}: ${supported ? '✅' : '❌'}`);
      });
    } else {
      console.error('❌ MediaRecorder not supported in this browser');
    }
  }, [isSafari]);

  function getSupportedMimeType(): string | undefined {
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Priority order: Safari types first (mp4), then others
    const types = [
      'audio/mp4',                    // Safari
      'audio/mp4;codecs=mp4a.40.2',   // Safari (AAC-LC)
      'audio/mp4;codecs=aac',         // Safari
      'audio/webm;codecs=opus',       // Chrome/Firefox
      'audio/webm',                   // Chrome/Firefox
      'audio/ogg;codecs=opus',        // Firefox
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('✅ Using MIME type:', type);
        return type;
      }
    }

    console.warn('⚠️ No preferred MIME type supported, using browser default');
    return undefined;
  }

  async function fetchNextQuestion() {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/next-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ yearsOfExperience: profile.yearsOfExperience }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error('Failed to fetch question:', error);
        throw new Error('Failed to load question');
      }

      const data = await res.json();
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);

      const audioBuffer = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
      const audio = new Audio(URL.createObjectURL(blob));
      
      audio.onended = () => {
        setTimeout(() => startRecording(), 500);
      };
      
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        alert('Failed to play question audio. Starting recording anyway...');
        setTimeout(() => startRecording(), 500);
      };
      
      await audio.play();
    } catch (err) {
      console.error('Failed to fetch question:', err);
      alert('Failed to load next question');
    } finally {
      setIsProcessing(false);
    }
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Safari-friendly constraints
          sampleRate: 44100,
          channelCount: 1,
        }
      });
      
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      const mimeType = getSupportedMimeType();
      
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
        // Safari benefits from explicit bitrate
        if (isSafari && mimeType.includes('mp4')) {
          options.audioBitsPerSecond = 128000; // 128kbps
        }
      }
      
      console.log('Creating MediaRecorder with options:', options);
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      console.log('MediaRecorder mimeType:', mediaRecorderRef.current.mimeType);
      
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('Audio chunk received:', e.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = handleRecordingStop;
      
      mediaRecorderRef.current.onerror = (e: Event) => {
        console.error('MediaRecorder error:', e);
        alert('Recording error occurred. Please try again.');
        stopRecording();
      };

      // Safari works better with larger timeslice
      const timeslice = isSafari ? 1000 : 100;
      mediaRecorderRef.current.start(timeslice);
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setTranscript('Listening...');

      detectSilence();
    } catch (err: any) {
      console.error('Recording failed:', err);
      
      let userMessage = 'Failed to start recording';
      if (err.name === 'NotAllowedError') {
        userMessage = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (err.name === 'NotFoundError') {
        userMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotSupportedError') {
        if (isSafari) {
          userMessage = 'Safari has limited recording support. For best results, please use Chrome, Firefox, or Edge.';
        } else {
          userMessage = 'Audio recording is not supported in this browser. Please try Chrome, Firefox, or Edge.';
        }
      } else {
        userMessage = `Microphone error: ${err.message}`;
      }
      
      alert(userMessage);
      setIsProcessing(false);
    }
  }

  function detectSilence() {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    let silenceStart: number | null = null;
    const SILENCE_THRESHOLD = 15;
    const SILENCE_DURATION = 2000;

    const checkAudio = () => {
      if (!isRecordingRef.current || !analyserRef.current) {
        console.log('Stopping silence detection');
        return;
      }

      analyserRef.current.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(dataArray[i] - 128);
        sum += value;
      }
      const average = sum / bufferLength;

      if (Math.random() < 0.1) {
        console.log('Audio level:', average.toFixed(2));
      }

      if (average < SILENCE_THRESHOLD) {
        if (!silenceStart) {
          silenceStart = Date.now();
          console.log('Silence started');
        } else if (Date.now() - silenceStart > SILENCE_DURATION) {
          console.log('2 seconds of silence detected, stopping recording');
          stopRecording();
          return;
        }
      } else {
        if (silenceStart) {
          console.log('Sound detected, resetting silence timer');
        }
        silenceStart = null;
      }

      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }

  function stopRecording() {
    console.log('Stopping recording...');
    isRecordingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
  }

  async function handleRecordingStop() {
    setIsProcessing(true);
    setTranscript('Processing your answer...');

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    
    console.log('Audio blob size:', audioBlob.size, 'bytes');
    console.log('MIME type:', mimeType);
    
    if (audioBlob.size === 0) {
      alert('No audio recorded. Please try again.');
      setIsProcessing(false);
      return;
    }
    
    // Determine file extension from MIME type
    let extension = 'webm';
    if (mimeType.includes('mp4')) {
      extension = 'm4a'; // Better for audio-only MP4
    } else if (mimeType.includes('ogg')) {
      extension = 'ogg';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    }
    
    const formData = new FormData();
    formData.append('audio', audioBlob, `answer.${extension}`);
    formData.append('questionNumber', questionNumber.toString());
    formData.append('yearsOfExperience', profile.yearsOfExperience.toString());

    try {
      const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/submit-answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Backend error:', errorText);
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      console.log('Response data:', data);
      
      setTranscript(data.transcript || 'No transcript received');

      if (data.evaluation) {
        const evalMsg = `
Score: ${data.evaluation.score}/100

${data.evaluation.feedback}

Strengths:
${data.evaluation.strengths?.map((s: string) => `• ${s}`).join('\n') || 'None listed'}

Areas for Improvement:
${data.evaluation.improvements?.map((i: string) => `• ${i}`).join('\n') || 'None listed'}
        `.trim();
        
        alert(evalMsg);
      }

      setTimeout(() => {
        if (questionNumber < 5) {
          fetchNextQuestion();
        } else {
          completeInterview();
        }
      }, 2000);
    } catch (err: any) {
      console.error('Failed to submit answer:', err);
      alert(`Failed to process answer: ${err.message}`);
      setIsProcessing(false);
    }
  }

  async function completeInterview() {
    try {
      await fetch(`${API_BASE}/interview/sessions/${sessionId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      onComplete();
    } catch (err) {
      console.error('Failed to complete interview:', err);
      alert('Interview data saved, but completion failed. Please check your results.');
      onComplete();
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {isSafari && (
        <div style={{ 
          marginBottom: 16, 
          padding: 12, 
          background: '#fef3c7', 
          border: '1px solid #fbbf24',
          borderRadius: 8,
          fontSize: 14,
        }}>
          ⚠️ <strong>Safari Note:</strong> For best experience, we recommend using Chrome, Firefox, or Edge.
        </div>
      )}

      <div style={{ marginBottom: 24, padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
        <h2 style={{ margin: 0, marginBottom: 12 }}>Question {questionNumber} of 5</h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, margin: '16px 0' }}>
          {currentQuestion || 'Loading question...'}
        </p>
      </div>

      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        {!isRecording && !isProcessing && questionNumber === 0 && (
          <button
            onClick={fetchNextQuestion}
            style={{
              padding: '16px 32px',
              fontSize: 18,
              background: '#3b82f6',
              color: 'white',
              border: 0,
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Start Interview
          </button>
        )}

        {isRecording && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 16px',
                background: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <p style={{ fontSize: 16, color: '#666', marginBottom: 8 }}>
              🎤 Recording... (will auto-stop after 2s silence)
            </p>
            <button
              onClick={stopRecording}
              style={{
                padding: '12px 24px',
                background: '#6b7280',
                color: 'white',
                border: 0,
                borderRadius: 8,
                cursor: 'pointer',
                marginTop: 16,
                fontWeight: 500,
              }}
            >
              Stop Manually
            </button>
          </>
        )}

        {isProcessing && (
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                margin: '0 auto 12px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ fontSize: 16, color: '#666' }}>⏳ Processing...</p>
          </div>
        )}
      </div>

      {transcript && (
        <div style={{ padding: 20, background: '#f9fafb', borderRadius: 8, minHeight: 100 }}>
          <h3 style={{ marginTop: 0 }}>Transcript</h3>
          <p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcript}</p>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}