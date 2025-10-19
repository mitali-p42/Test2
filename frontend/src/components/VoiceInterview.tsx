// frontend/src/components/VoiceInterview.tsx (UPDATED with Live Transcript)
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


type Props = {
  sessionId: string;
  profile: {
    role: string;
    interviewType: string;
    yearsOfExperience: number | string;
  };
  onComplete: () => void;
};

type QuestionHint = {
  hint: string;
  examples?: string[];
};

// Typewriter component
function TypewriterText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);
  

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return (
    <span>
      {displayedText}
      {currentIndex < text.length && <span className="cursor-blink">|</span>}
    </span>
  );
}
// function TabSwitchTester() {
//   const [visibilityState, setVisibilityState] = React.useState(document.visibilityState);
//   const [switchCount, setSwitchCount] = React.useState(0);

//   React.useEffect(() => {
//     const handler = () => {
//       const newState = document.visibilityState;
//       setVisibilityState(newState);
      
//       if (newState === 'hidden') {
//         setSwitchCount(prev => prev + 1);
//         console.log('🧪 TEST: Tab switch detected!');
//       }
//     };

//     document.addEventListener('visibilitychange', handler);
//     return () => document.removeEventListener('visibilitychange', handler);
//   }, []);

//   return (
//     <div style={{
//       position: 'fixed',
//       bottom: 20,
//       right: 20,
//       padding: 12,
//       background: '#1f2937',
//       color: 'white',
//       borderRadius: 8,
//       fontSize: 12,
//       zIndex: 9999,
//     }}>
//       <div><strong>Tab Detection Test</strong></div>
//       <div>State: {visibilityState}</div>
//       <div>Switches detected: {switchCount}</div>
//       <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
//         Switch tabs to test
//       </div>
//     </div>
//   );
// }

export default function VoiceInterview({ sessionId, profile, onComplete }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const navigate = useNavigate();
  const [questionNumber, setQuestionNumber] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState(''); // 🆕 Live transcript
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [hint, setHint] = useState<QuestionHint | null>(null);

  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [interviewTerminated, setInterviewTerminated] = useState(false);
  const hasRecordedTabSwitchRef = useRef(false);


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRecordingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const questionNumberRef = useRef(0);
  const silenceStartRef = useRef<number | null>(null);
  const interviewEndedEarlyRef = useRef(false);
  
  // 🆕 Live transcription refs
  const streamChunksRef = useRef<Blob[]>([]);
  const lastChunkTimeRef = useRef<number>(0);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousContextRef = useRef<string>('');

  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE;

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  useEffect(() => {
    console.log('🎚️ Difficulty state changed:', {
      currentDifficulty,
      questionNumber,
      isProcessing,
      isRecording,
      shouldShowHint: currentDifficulty === 'hard' && questionNumber > 0 && !isProcessing,
    });
  }, [currentDifficulty, questionNumber, isProcessing, isRecording]);
  // useEffect(() => {
  //   if (interviewTerminated || interviewEndedEarlyRef.current) {
  //     console.log('⏹️ Interview ended, skipping tab detection');
  //     return;
  //   }

  //   let isTabVisible = !document.hidden;
  //   hasRecordedTabSwitchRef.current = false;

  //   const handleVisibilityChange = async () => {
  //     const wasVisible = isTabVisible;
  //     isTabVisible = !document.hidden;

  //     console.log('👁️ Visibility changed:', {
  //       wasVisible,
  //       isVisible: isTabVisible,
  //       hasRecorded: hasRecordedTabSwitchRef.current,
  //     });

  //     // Only track when user LEAVES the tab (visible -> hidden)
  //     if (wasVisible && !isTabVisible && !hasRecordedTabSwitchRef.current) {
  //       console.log('🚨 User switched away from tab');
  //       hasRecordedTabSwitchRef.current = true;
  //       await recordTabSwitch();
  //     }

  //     // Reset flag when they come back
  //     if (!wasVisible && isTabVisible) {
  //       console.log('✅ User returned to tab');
  //       hasRecordedTabSwitchRef.current = false;
  //     }
  //   };
  //   document.addEventListener('visibilitychange', handleVisibilityChange);

  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, [sessionId, token, API_BASE, interviewTerminated]);

  // // 🆕 Record tab switch
  // async function recordTabSwitch() {
  //   try {
  //     console.log('📊 Recording tab switch for session:', sessionId);

  //     const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/tab-switch`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     if (!res.ok) {
  //       console.error('❌ Failed to record tab switch:', res.status);
  //       return;
  //     }

  //     const data = await res.json();
      
  //     console.log('✅ Tab switch recorded:', data);

  //     setTabSwitchCount(data.tabSwitches);

  //     if (data.shouldTerminate) {
  //       console.log('🛑 Interview terminated due to tab switches');
  //       setWarningMessage('❌ Interview terminated: You switched tabs too many times.');
  //       setInterviewTerminated(true);
  //       setShowTabWarning(true);
        
  //       // Force stop recording
  //       if (isRecording) {
  //         stopRecording();
  //       }

  //       // Auto-complete after showing message
  //       setTimeout(() => {
  //         handleTabSwitchTermination();
  //       }, 5000);
  //     } else {
  //       // Show warning
  //       setWarningMessage(data.message);
  //       setShowTabWarning(true);

  //       // Auto-hide warning after 8 seconds
  //       setTimeout(() => {
  //         setShowTabWarning(false);
  //       }, 8000);
  //     }
  //   } catch (err: any) {
  //     console.error('❌ Tab switch recording error:', err);
  //   }
  // }

  // 🆕 Handle interview termination due to tab switches
  // frontend/src/components/VoiceInterview.tsx

// 🆕 Enhanced Tab Switch Detection with multiple fallbacks
// frontend/src/components/VoiceInterview.tsx
// Replace the useEffect for tab detection with this improved version:

useEffect(() => {
  if (interviewTerminated || interviewEndedEarlyRef.current) {
    console.log('⏹️ Interview ended, skipping tab detection');
    return;
  }

  console.log('🔍 Setting up tab switch detection...');
  
  let lastTabSwitchTime = 0;
  const DEBOUNCE_MS = 2000; // 2 seconds between recordings

  // Simple, reliable tab switch detection
  const handleVisibilityChange = async () => {
    const now = Date.now();
    
    // User SWITCHED AWAY from tab (visible -> hidden)
    if (document.visibilityState === 'hidden') {
      console.log('🚨 Tab hidden - user switched away');
      
      // Debounce: don't record if we just recorded one
      if (now - lastTabSwitchTime < DEBOUNCE_MS) {
        console.log('⏭️ Skipping - too soon after last switch');
        return;
      }
      
      lastTabSwitchTime = now;
      await recordTabSwitch();
    }
    
    // User RETURNED to tab
    else if (document.visibilityState === 'visible') {
      console.log('✅ Tab visible - user returned');
    }
  };

  // Add single listener
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Log initial state
  console.log('📊 Initial visibility state:', document.visibilityState);

  // Cleanup
  return () => {
    console.log('🧹 Cleaning up tab detection');
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [sessionId, token, API_BASE, interviewTerminated]);

// Simplified recordTabSwitch function
async function recordTabSwitch() {
  if (interviewTerminated || interviewEndedEarlyRef.current) {
    console.log('⏹️ Interview already ended, ignoring tab switch');
    return;
  }

  try {
    console.log('📊 Recording tab switch for session:', sessionId);

    const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/tab-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error('❌ Tab switch recording failed:', res.status);
      return;
    }

    const data = await res.json();
    
    console.log('✅ Tab switch recorded:', {
      count: data.tabSwitches,
      shouldTerminate: data.shouldTerminate,
    });

    setTabSwitchCount(data.tabSwitches);

    if (data.shouldTerminate) {
      console.log('🛑 Terminating interview - too many tab switches');
      setWarningMessage('❌ Interview terminated: You switched tabs 3 times.');
      setInterviewTerminated(true);
      setShowTabWarning(true);
      
      if (isRecording) {
        stopRecording();
      }

      setTimeout(() => {
        handleTabSwitchTermination();
      }, 5000);
    } else {
      // Show warning
      const remaining = 3 - data.tabSwitches;
      setWarningMessage(
        `⚠️ Warning: Tab switch detected (${data.tabSwitches}/3)\n\n` +
        `You have ${remaining} warning${remaining !== 1 ? 's' : ''} remaining. ` +
        `Stay on this tab or your interview will be terminated.`
      );
      setShowTabWarning(true);

      // Auto-hide after 10 seconds
      setTimeout(() => {
        setShowTabWarning(false);
      }, 10000);
    }
  } catch (err: any) {
    console.error('❌ Tab switch recording error:', err);
  }
}

  async function handleTabSwitchTermination() {
    console.log('🛑 Terminating interview due to tab switches...');
    
    interviewEndedEarlyRef.current = true;

    if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }

  if (transcriptionIntervalRef.current) {
    clearInterval(transcriptionIntervalRef.current);
    transcriptionIntervalRef.current = null;
  }

    setIsProcessing(true);
    
    try {
    // Mark session as completed
    await fetch(`${API_BASE}/interview/sessions/${sessionId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Interview terminated, navigating to results');
    // 🆕 Navigate to results page
    navigate(`/results/${sessionId}`);
  } catch (err) {
    console.error('❌ Termination failed:', err);
    // Still navigate to results
    navigate(`/results/${sessionId}`);
  }
}
  useEffect(() => {
    console.log('🔍 Browser capabilities:');
    console.log('  - User Agent:', navigator.userAgent);
    console.log('  - Is Safari:', isSafari);
    console.log('  - MediaRecorder:', !!window.MediaRecorder);
    console.log('  - getUserMedia:', !!navigator.mediaDevices?.getUserMedia);

    if (window.MediaRecorder) {
      const types = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm'];
      console.log('📝 Supported formats:');
      types.forEach((type) => {
        console.log(`  - ${type}: ${MediaRecorder.isTypeSupported(type) ? '✅' : '❌'}`);
      });
    }
  }, [isSafari]);

  // 🆕 Cleanup transcription interval on unmount
  useEffect(() => {
    return () => {
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
    };
  }, []);

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

  async function speakText(text: string): Promise<void> {
    try {
      console.log('🔊 Generating speech:', text);

      const res = await fetch(`${API_BASE}/interview/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        console.warn('⚠️ TTS failed, skipping voice prompt');
        return;
      }

      const audioBlob = await res.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));

      return new Promise((resolve) => {
        audio.onended = () => {
          console.log('✅ Speech finished');
          resolve();
        };
        audio.onerror = () => {
          console.warn('⚠️ Speech playback failed');
          resolve();
        };
        audio.play().catch(() => {
          console.warn('⚠️ Could not play speech');
          resolve();
        });
      });
    } catch (err) {
      console.warn('⚠️ TTS error:', err);
    }
  }

  // 🆕 Transcribe audio chunk for live display
  async function transcribeChunk(audioBlob: Blob): Promise<string> {
    try {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      let extension = 'webm';
      if (mimeType.includes('mp4')) extension = 'm4a';
      else if (mimeType.includes('ogg')) extension = 'ogg';

      const formData = new FormData();
      formData.append('audio', audioBlob, `chunk-${Date.now()}.${extension}`);
      formData.append('previousContext', previousContextRef.current);

      const res = await fetch(`${API_BASE}/interview/transcribe-chunk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        console.warn('⚠️ Chunk transcription failed:', res.status);
        return '';
      }

      const data = await res.json();
      return data.text || '';
    } catch (err) {
      console.error('❌ Chunk transcription error:', err);
      return '';
    }
  }

  // 🆕 Process accumulated chunks for live transcript
  async function processLiveTranscript() {
    if (streamChunksRef.current.length === 0) return;

    const chunksToProcess = [...streamChunksRef.current];
    streamChunksRef.current = [];

    const audioBlob = new Blob(chunksToProcess, { 
      type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
    });

    const newText = await transcribeChunk(audioBlob);
    
    if (newText) {
      setLiveTranscript(prev => {
        const updated = prev ? `${prev} ${newText}` : newText;
        previousContextRef.current = updated.split(' ').slice(-50).join(' '); // Keep last 50 words as context
        return updated;
      });
    }
  }

  async function fetchNextQuestion() {
    if (interviewEndedEarlyRef.current) {
      console.log('⏹️ Interview ended early, skipping next question');
      return;
    }

    setIsProcessing(true);
    setTranscript('');
    setLiveTranscript(''); // 🆕 Clear live transcript
    previousContextRef.current = ''; // 🆕 Reset context
    setCurrentQuestion('');
    setHint(null);
    setHintError(null);
    setCurrentDifficulty(null);

    try {
      console.log('🎯 Fetching question for session:', sessionId);

      if (questionNumberRef.current > 0) {
        await speakText("Great answer! Let's move on to the next question.");
      }

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
        difficulty: data.difficulty,
        difficultyType: typeof data.difficulty,
        length: data.question?.length,
        hasAudio: !!data.audioBase64,
        fullData: data,
      });

      if (!data.questionNumber) {
        throw new Error('Invalid question number');
      }

      setQuestionNumber(data.questionNumber);
      questionNumberRef.current = data.questionNumber;

      const difficulty = (data.difficulty as 'easy' | 'medium' | 'hard') || null;
      setCurrentDifficulty(difficulty);

      if (data.questionNumber === 1) {
        await speakText("Great! Let's begin with the first question.");
      }

      try {
        const audioBuffer = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audio = new Audio(URL.createObjectURL(blob));

        audio.addEventListener('play', () => {
          console.log('🔊 Audio started, beginning typewriter effect');
          setTimeout(() => setCurrentQuestion(data.question), 100);
        });

        audio.addEventListener('ended', () => {
          console.log('🔊 Audio finished, setting processing to false');
          setIsProcessing(false);
          console.log('🔊 Starting recording in 3000ms (3 seconds)');
          setTimeout(() => startRecording(data.questionNumber), 3000);
        });

        audio.addEventListener('error', () => {
          console.error('❌ Audio error, starting recording anyway');
          setCurrentQuestion(data.question);
          setIsProcessing(false);
          setTimeout(() => startRecording(data.questionNumber), 3000);
        });

        await audio.play();
      } catch (audioErr) {
        console.error('❌ Audio error:', audioErr);
        setCurrentQuestion(data.question);
        setIsProcessing(false);
        setTimeout(() => startRecording(data.questionNumber), 3000);
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch question:', err);
      alert(`Failed to load question: ${err.message}`);
      setIsProcessing(false);
    }
  }

  async function requestHint() {
    if (!questionNumber) return;

    setLoadingHint(true);
    setHintError(null);

    try {
      const res = await fetch(`${API_BASE}/interview/sessions/${sessionId}/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionNumber }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to get hint');
      }

      const hintData = await res.json();
      console.log('💡 Hint received:', hintData);
      setHint(hintData);
    } catch (err: any) {
      console.error('❌ Hint request failed:', err);
      setHintError(err.message);
    } finally {
      setLoadingHint(false);
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
        },
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
        if (isSafari && mimeType.includes('mp4')) {
          (options as any).audioBitsPerSecond = 128000;
        }
      }

      console.log('📹 MediaRecorder options:', options);
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      streamChunksRef.current = []; // 🆕 Reset stream chunks
      setLiveTranscript(''); // 🆕 Clear live transcript
      previousContextRef.current = ''; // 🆕 Reset context

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          streamChunksRef.current.push(e.data); // 🆕 Also add to stream chunks
          console.log('📦 Chunk:', e.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = handleRecordingStop;

      mediaRecorderRef.current.onerror = (e: Event) => {
        console.error('❌ MediaRecorder error:', e);
        stopRecording();
      };

      const timeslice = isSafari ? 1000 : 500; // 🆕 Smaller chunks for live transcription
      mediaRecorderRef.current.start(timeslice);

      setIsRecording(true);
      isRecordingRef.current = true;
      setTranscript(''); // Clear final transcript
      setIsProcessing(false);
      silenceStartRef.current = null;

      // 🆕 Start live transcription interval
      transcriptionIntervalRef.current = setInterval(processLiveTranscript, 2000); // Every 2 seconds

      console.log('✅ Recording started with live transcription');
      detectSilence();
    } catch (err: any) {
      console.error('❌ Recording failed:', err);

      let userMessage = 'Failed to start recording';
      if (err.name === 'NotAllowedError') {
        userMessage =
          '❌ Microphone blocked!\n\n1. Click the 🔒 in address bar\n2. Allow microphone\n3. Refresh page';
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

  function detectSilence() {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const SILENCE_THRESHOLD = 5;
    const SILENCE_DURATION = 6000;
    const MIN_RECORDING_TIME = 2000;
    const recordingStartTime = Date.now();

    const checkAudio = () => {
      if (!isRecordingRef.current || !analyserRef.current) {
        console.log('⏹️ Stopping silence detection');
        return;
      }

      analyserRef.current.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(dataArray[i] - 128);
        sum += value;
      }
      const average = sum / bufferLength;

      setAudioLevel(average);

      if (Math.random() < 0.1) {
        console.log(
          '🔉 Audio level:',
          average.toFixed(2),
          silenceStartRef.current
            ? `(silent for ${((Date.now() - silenceStartRef.current) / 1000).toFixed(1)}s)`
            : ''
        );
      }

      const recordingDuration = Date.now() - recordingStartTime;

      if (average < SILENCE_THRESHOLD) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
          console.log('🔇 Silence detected, starting timer...');
        } else {
          const silenceDuration = Date.now() - silenceStartRef.current;

          if (recordingDuration > MIN_RECORDING_TIME && silenceDuration > SILENCE_DURATION) {
            console.log(
              `✅ ${SILENCE_DURATION / 1000}s silence detected after ${(recordingDuration / 1000).toFixed(
                1
              )}s recording`
            );
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

    // 🆕 Stop live transcription
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
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

    if (interviewEndedEarlyRef.current) {
      console.log('⏹️ Interview ended early, skipping answer processing');
      return;
    }

    setIsProcessing(true);
    setTranscript('⏳ Finalizing transcription...');

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    const currentQuestionNumber = questionNumberRef.current;

    console.log('📤 Submitting:', {
      sessionId,
      questionNumber: currentQuestionNumber,
      size: audioBlob.size,
      mimeType,
      chunks: audioChunksRef.current.length,
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

      setTimeout(() => {
        if (interviewEndedEarlyRef.current) {
          console.log('⏹️ Interview ended early, not proceeding to next question');
          return;
        }

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
    await speakText(
      "Thank you for completing the interview! Your responses have been recorded. Let's review your results."
    );

    await fetch(`${API_BASE}/interview/sessions/${sessionId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Interview completed, navigating to results');
    
    // 🆕 Navigate to results page instead of calling onComplete
    navigate(`/results/${sessionId}`);
  } catch (err) {
    console.error('❌ Complete failed:', err);
    // Still navigate to results even if completion API fails
    navigate(`/results/${sessionId}`);
  }
}

  async function handleEndInterview() {
    console.log('🛑 Ending interview early...');

    interviewEndedEarlyRef.current = true;
    setShowEndConfirm(false);

    if (isRecording) {
      console.log('⏹️ Stopping active recording...');
      stopRecording();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 🆕 Stop live transcription
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    setIsProcessing(true);
    try {
    await fetch(`${API_BASE}/interview/sessions/${sessionId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    // 🆕 Navigate to results page
    navigate(`/results/${sessionId}`);
  } catch (err) {
    console.error('❌ End interview failed:', err);
    // Still navigate to results
    navigate(`/results/${sessionId}`);
  }
}
  

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {/* <TabSwitchTester /> */}
    
      {isSafari && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 8,
          }}
        >
          ⚠️ <strong>Safari:</strong> For best results, use Chrome/Firefox/Edge.
        </div>
      )}

      {showTabWarning && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            maxWidth: 500,
            width: '90%',
            padding: 20,
            background: interviewTerminated ? '#fee2e2' : '#fef3c7',
            border: `2px solid ${interviewTerminated ? '#ef4444' : '#fbbf24'}`,
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{interviewTerminated ? '🛑' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: interviewTerminated ? '#991b1b' : '#92400e',
                fontSize: 16,
              }}>
                {interviewTerminated ? 'Interview Terminated' : `Warning ${tabSwitchCount}/2`}
              </h3>
              <p style={{ 
                margin: '0 0 8px 0', 
                color: interviewTerminated ? '#991b1b' : '#92400e',
                fontSize: 14,
                lineHeight: 1.5,
              }}>
                {warningMessage}
              </p>
              {!interviewTerminated && (
                <p style={{ 
                  margin: 0, 
                  fontSize: 13,
                  color: '#6b7280',
                }}>
                  Remaining warnings: {Math.max(0, 2 - tabSwitchCount)}
                </p>
              )}
            </div>
            {!interviewTerminated && (
              <button
                onClick={() => setShowTabWarning(false)}
                style={{
                  background: 'none',
                  border: 0,
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4,
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
      {/* 🆕 Tab Switch Counter (always visible) */}
      {/* {questionNumber > 0 && !interviewTerminated && (
        <div style={{ 
          marginBottom: 16, 
          padding: 8, 
          background: tabSwitchCount > 0 ? '#fef3c7' : '#f3f4f6',
          borderRadius: 8,
          fontSize: 13,
          textAlign: 'center',
          color: tabSwitchCount > 0 ? '#92400e' : '#6b7280',
        }}>
          {tabSwitchCount === 0 ? (
            '✅ No tab switches detected'
          ) : (
            `⚠️ Tab switches: ${tabSwitchCount}/3 (${Math.max(0, 2 - tabSwitchCount)} warnings remaining)`
          )}
        </div>
      )} */}

      <div style={{ marginBottom: 24, padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
        {questionNumber > 0 && (
          <h2 style={{ margin: 0, marginBottom: 12 }}>Question {questionNumber} of 5</h2>
        )}

        {currentQuestion ? (
          <p style={{ fontSize: 18, lineHeight: 1.6, margin: '16px 0', minHeight: 60 }}>
            <TypewriterText key={currentQuestion} text={currentQuestion} speed={50} />
          </p>
        ) : (
          <p style={{ fontSize: 18, lineHeight: 1.6, margin: '16px 0', minHeight: 60, color: '#9ca3af' }}>
            Ready to begin your interview...
          </p>
        )}
      </div>

      {/* {currentDifficulty && questionNumber > 0 && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background:
                currentDifficulty === 'easy'
                  ? '#d1fae5'
                  : currentDifficulty === 'medium'
                  ? '#fef3c7'
                  : '#fee2e2',
              color:
                currentDifficulty === 'easy'
                  ? '#065f46'
                  : currentDifficulty === 'medium'
                  ? '#92400e'
                  : '#991b1b',
            }}
          >
            {currentDifficulty === 'easy' ? '🟢 Easy' : currentDifficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'}
          </span>
        </div>
      )} */}

      {currentDifficulty === 'hard' && questionNumber > 0 && !isProcessing && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>🎯 Hard Question - Hint Available</span>
            {!hint && (
              <button
                onClick={requestHint}
                disabled={loadingHint || isRecording}
                style={{
                  padding: '6px 12px',
                  background: loadingHint || isRecording ? '#d1d5db' : '#fbbf24',
                  color: loadingHint || isRecording ? '#6b7280' : '#000',
                  border: 0,
                  borderRadius: 6,
                  cursor: loadingHint || isRecording ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                {loadingHint ? '⏳ Loading...' : '💡 Get Hint'}
              </button>
            )}
          </div>

          {hint && (
            <div
              style={{
                background: 'white',
                padding: 12,
                borderRadius: 6,
                marginTop: 8,
              }}
            >
              <p style={{ margin: 0, marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>
                <strong>💡 Hint:</strong> {hint.hint}
              </p>

              {hint.examples && hint.examples.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 13 }}>Consider:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20, fontSize: 13 }}>
                    {hint.examples.map((example, i) => (
                      <li key={i}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {hintError && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: '#fee2e2',
                borderRadius: 6,
                fontSize: 13,
                color: '#991b1b',
              }}
            >
              ⚠️ {hintError}
            </div>
          )}
        </div>
      )}

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
          <div>
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 16px',
                background: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 1.5s infinite',
                position: 'relative',
              }}
            />
            <p style={{ fontSize: 16, color: '#666', marginBottom: 8 }}>🎤 Recording... (auto-stops after 6s silence)</p>
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
          </div>
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

      {questionNumber > 0 && !showEndConfirm && !interviewEndedEarlyRef.current && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              background: '#ef4444',
              color: 'white',
              border: 0,
              borderRadius: 8,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            🛑 End Interview Early
          </button>
        </div>
      )}

      {showEndConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: 32,
              borderRadius: 16,
              maxWidth: 400,
              textAlign: 'center',
            }}
          >
            <h3 style={{ marginTop: 0 }}>End Interview?</h3>
            <p style={{ color: '#666', marginBottom: 24 }}>
              Are you sure you want to end this interview? You've answered {questionNumber} out of 5 questions.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  padding: '10px 24px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Continue Interview
              </button>
              <button
                onClick={handleEndInterview}
                style={{
                  padding: '10px 24px',
                  background: '#ef4444',
                  color: 'white',
                  border: 0,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Yes, End Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 LIVE TRANSCRIPT - Shows during recording */}
      {isRecording && liveTranscript && (
        <div style={{ 
          padding: 20, 
          background: '#dbeafe', 
          border: '2px solid #3b82f6',
          borderRadius: 8, 
          marginBottom: 16,
          minHeight: 80 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'pulse 1s infinite'
            }} />
            <h3 style={{ margin: 0, fontSize: 16, color: '#1e40af' }}>Live Transcript</h3>
          </div>
          <p style={{ 
            lineHeight: 1.6, 
            whiteSpace: 'pre-wrap',
            margin: 0,
            fontSize: 15,
            color: '#1e3a8a'
          }}>
            {liveTranscript}
          </p>
        </div>
      )}

      {/* FINAL TRANSCRIPT - Shows after recording stops */}
      {transcript && !isRecording && (
        <div style={{ padding: 20, background: '#f9fafb', borderRadius: 8, minHeight: 100 }}>
          <h3 style={{ marginTop: 0 }}>Final Transcript</h3>
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

        .cursor-blink {
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );

}