// frontend/src/components/VoiceInterview.tsx - FIXED VERSION
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
  const [audioLevel, setAudioLevel] = useState(0); // 👈 NEW: Show audio level

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRecordingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const questionNumberRef = useRef(0);
  const silenceStartRef = useRef<number | null>(null); // 👈 FIXED: Use ref instead of local var

  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE;

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  useEffect(() => {
    console.log('🔍 Browser capabilities:');
    console.log('  - User Agent:', navigator.userAgent);
    console.log('  - Is Safari:', isSafari);
    console.log('  - MediaRecorder:', !!window.MediaRecorder);
    console.log('  - getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
    
    if (window.MediaRecorder) {
      const types = [
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      console.log('📝 Supported formats:');
      types.forEach(type => {
        console.log(`  - ${type}: ${MediaRecorder.isTypeSupported(type) ? '✅' : '❌'}`);
      });
    }
  }, [isSafari]);

  function getSupportedMimeType(): string | undefined {
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder not supported');
    }

    const types = [
      'audio/mp4',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('✅ Using format:', type);
        return type;
      }
    }

    console.warn('⚠️ No preferred format supported');
    return undefined;
  }

  async function fetchNextQuestion() {
    setIsProcessing(true);
    setTranscript('');
    
    try {
      console.log('🎯 Fetching question for session:', sessionId);
      
      const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/next-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ yearsOfExperience: profile.yearsOfExperience }),
      });

      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }

      const data = await res.json();
      
      console.log('✅ Question loaded:', {
        number: data.questionNumber,
        length: data.question?.length,
        hasAudio: !!data.audioBase64
      });

      if (!data.questionNumber) {
        throw new Error('Invalid question number');
      }

      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      questionNumberRef.current = data.questionNumber;

      // Play audio
      try {
        const audioBuffer = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audio = new Audio(URL.createObjectURL(blob));
        
        audio.onended = () => {
          console.log('🔊 Audio finished, starting recording in 500ms');
          setTimeout(() => startRecording(data.questionNumber), 500);
        };
        
        audio.onerror = () => {
          console.error('❌ Audio error, starting recording anyway');
          setTimeout(() => startRecording(data.questionNumber), 500);
        };
        
        await audio.play();
      } catch (audioErr) {
        console.error('❌ Audio error:', audioErr);
        setTimeout(() => startRecording(data.questionNumber), 500);
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch question:', err);
      alert(`Failed to load question: ${err.message}`);
      setIsProcessing(false);
    }
  }

  async function startRecording(qNum?: number) {
    try {
      const activeQuestionNumber = qNum ?? questionNumberRef.current;
      
      console.log('🎤 Starting recording for question:', activeQuestionNumber);
      
      if (!activeQuestionNumber) {
        throw new Error('Invalid question number');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio recording not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        }
      });
      
      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
        if (isSafari && mimeType.includes('mp4')) {
          options.audioBitsPerSecond = 128000;
        }
      }
      
      console.log('📹 MediaRecorder options:', options);
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('📦 Chunk:', e.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = handleRecordingStop;
      
      mediaRecorderRef.current.onerror = (e: Event) => {
        console.error('❌ MediaRecorder error:', e);
        stopRecording();
      };

      const timeslice = isSafari ? 1000 : 100;
      mediaRecorderRef.current.start(timeslice);
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setTranscript('🎤 Recording... (speak clearly)');
      setIsProcessing(false);
      silenceStartRef.current = null; // 👈 RESET

      console.log('✅ Recording started');
      detectSilence();
    } catch (err: any) {
      console.error('❌ Recording failed:', err);
      
      let userMessage = 'Failed to start recording';
      if (err.name === 'NotAllowedError') {
        userMessage = '❌ Microphone blocked!\n\n1. Click the 🔒 in address bar\n2. Allow microphone\n3. Refresh page';
      } else if (err.name === 'NotFoundError') {
        userMessage = '❌ No microphone detected. Please connect one.';
      } else if (err.name === 'NotSupportedError') {
        userMessage = isSafari 
          ? '⚠️ Limited Safari support. Use Chrome/Firefox for best results.'
          : '❌ Recording not supported. Use Chrome/Firefox/Edge.';
      } else {
        userMessage = `Microphone error: ${err.message}`;
      }
      
      alert(userMessage);
      setIsProcessing(false);
    }
  }

  // 👇 COMPLETELY REWRITTEN: Much more reliable silence detection
  function detectSilence() {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    // 🔧 FIXED VALUES:
    const SILENCE_THRESHOLD = 5;      // 👈 Changed from 15 to 5 (much less sensitive)
    const SILENCE_DURATION = 6000;     // 👈 Changed from 15000 to 3000 (3 seconds)
    const MIN_RECORDING_TIME = 2000;   // 👈 NEW: Don't stop before 2 seconds
    const recordingStartTime = Date.now();

    const checkAudio = () => {
      if (!isRecordingRef.current || !analyserRef.current) {
        console.log('⏹️ Stopping silence detection');
        return;
      }

      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate average audio level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(dataArray[i] - 128);
        sum += value;
      }
      const average = sum / bufferLength;

      // Update UI with audio level
      setAudioLevel(average);

      // Log periodically (10% chance)
      if (Math.random() < 0.1) {
        console.log('🔉 Audio level:', average.toFixed(2), 
                    silenceStartRef.current ? `(silent for ${((Date.now() - silenceStartRef.current) / 1000).toFixed(1)}s)` : '');
      }

      const recordingDuration = Date.now() - recordingStartTime;

      // Check for silence
      if (average < SILENCE_THRESHOLD) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
          console.log('🔇 Silence detected, starting timer...');
        } else {
          const silenceDuration = Date.now() - silenceStartRef.current;
          
          // Only stop if we've been recording long enough AND silent long enough
          if (recordingDuration > MIN_RECORDING_TIME && silenceDuration > SILENCE_DURATION) {
            console.log(`✅ ${SILENCE_DURATION/1000}s silence detected after ${(recordingDuration/1000).toFixed(1)}s recording`);
            stopRecording();
            return;
          }
        }
      } else {
        if (silenceStartRef.current) {
          console.log('🔊 Sound detected, resetting silence timer');
        }
        silenceStartRef.current = null;
      }

      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }

  function stopRecording() {
    console.log('⏹️ Stopping recording...');
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
    setAudioLevel(0);
  }

  async function handleRecordingStop() {
    console.log('🛑 Processing answer...');
    
    setIsProcessing(true);
    setTranscript('⏳ Transcribing...');

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    const currentQuestionNumber = questionNumberRef.current;
    
    console.log('📤 Submitting:', {
      sessionId,
      questionNumber: currentQuestionNumber,
      size: audioBlob.size,
      mimeType,
      chunks: audioChunksRef.current.length
    });
    
    if (!currentQuestionNumber) {
      alert('Error: Invalid question. Please refresh.');
      setIsProcessing(false);
      return;
    }

    if (audioBlob.size === 0) {
      alert('No audio recorded. Please try again.');
      setIsProcessing(false);
      return;
    }
    
    let extension = 'webm';
    if (mimeType.includes('mp4')) extension = 'm4a';
    else if (mimeType.includes('ogg')) extension = 'ogg';
    
    const formData = new FormData();
    formData.append('audio', audioBlob, `answer.${extension}`);
    formData.append('questionNumber', currentQuestionNumber.toString());
    formData.append('yearsOfExperience', profile.yearsOfExperience.toString());

    try {
      const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/submit-answer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Backend error:', res.status, errorText);
        
        if (res.status === 404) {
          alert(`Question not found. Please refresh and restart.`);
        } else {
          alert(`Failed (${res.status}): ${errorText}`);
        }
        
        setIsProcessing(false);
        return;
      }

      const data = await res.json();
      console.log('✅ Answer processed:', data);
      
      setTranscript(data.transcript || 'No transcript');

      if (data.evaluation) {
        console.log('📊 Evaluation:', data.evaluation);
      }

      // Next question or complete
      setTimeout(() => {
        if (currentQuestionNumber < 5) {
          console.log('📝 Next question...');
          fetchNextQuestion();
        } else {
          console.log('🎉 Interview complete!');
          completeInterview();
        }
      }, 2000);
    } catch (err: any) {
      console.error('❌ Submit failed:', err);
      alert(`Failed: ${err.message}\n\nPlease try again.`);
      setIsProcessing(false);
    }
  }

  async function completeInterview() {
    try {
      await fetch(`${API_BASE}/interview/sessions/${sessionId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('✅ Interview completed');
      onComplete();
    } catch (err) {
      console.error('❌ Complete failed:', err);
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
        }}>
          ⚠️ <strong>Safari:</strong> For best results, use Chrome/Firefox/Edge.
        </div>
      )}

      <div style={{ marginBottom: 24, padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
        <h2 style={{ margin: 0, marginBottom: 12 }}>
          Question {questionNumber || '—'} of 5
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, margin: '16px 0' }}>
          {currentQuestion || 'Loading...'}
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
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              background: '#ef4444',
              borderRadius: '50%',
              animation: 'pulse 1.5s infinite',
              position: 'relative',
            }}>
              {/* 👇 NEW: Audio level indicator */}
              <div style={{
                position: 'absolute',
                bottom: -30,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 12,
                color: '#666',
                whiteSpace: 'nowrap',
              }}>
                Level: {audioLevel.toFixed(1)}
              </div>
            </div>
            <p style={{ fontSize: 16, color: '#666', marginBottom: 8 }}>
              🎤 Recording... (auto-stops after 3s silence)
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
                fontWeight: 500,
              }}
            >
              Stop Manually
            </button>
          </>
        )}

        {isProcessing && (
          <div>
            <div style={{
              width: 40,
              height: 40,
              margin: '0 auto 12px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
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