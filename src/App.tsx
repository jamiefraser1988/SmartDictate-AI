/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  FileText, 
  CheckSquare, 
  Mail, 
  RefreshCw, 
  Copy, 
  Check,
  History,
  Trash2,
  ChevronRight,
  Settings2,
  Upload,
  FileAudio,
  FileVideo,
  AlertCircle,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

type OutputFormat = 'transcript' | 'minutes' | 'tasks' | 'email';

interface HistoryItem {
  id: string;
  uid: string;
  timestamp: number;
  input: string;
  output: string;
  format: OutputFormat;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [output, setOutput] = useState('');
  const [format, setFormat] = useState<OutputFormat>('transcript');
  const [copied, setCopied] = useState(false);
  const [inputCopied, setInputCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const MAX_CHARS = 20000; // Increased for longer transcriptions

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Error updating user profile:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Connection Test
  useEffect(() => {
    if (isAuthReady && user) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration. ");
          }
        }
      }
      testConnection();
    }
  }, [isAuthReady, user]);

  // History Sync with Firestore
  useEffect(() => {
    if (!isAuthReady || !user) {
      setHistory([]);
      return;
    }

    const path = 'history';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: HistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      setHistory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  useEffect(() => {
    if (error && input.length > 0 && input.length <= MAX_CHARS) {
      setError(null);
    }
  }, [input]);

  useEffect(() => {
    // History is now synced with Firestore
  }, []);

  const CustomBlockQuoteBlock = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Convert the children to a string and copy to clipboard
    const textToCopy = String(children).replace(/\n$/, '');
    navigator.clipboard.writeText(textToCopy);
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If it's inline code (single backticks), use your original simple styling
  if (inline) {
    return (
      <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-2 text-slate-400" {...props}>
        {children}
      </blockquote>
    );
  }
  
  // If it's a fenced block (triple backticks), wrap it in a container with the Copy button
  return (
    <div className="relative group my-4">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="bg-slate-900 p-4 rounded overflow-x-auto">
        <blockquote className='text-slate-400  ${className || }'{...props}>
          {children}
        </blockquote>
      </pre>
    </div>
  );
};


  useEffect(() => {
    // History is now synced with Firestore
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setInput(prev => {
              const next = prev + event.results[i][0].transcript + ' ';
              return next.slice(0, MAX_CHARS);
            });
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognitionRef.current.onend = () => {
        // Automatically restart ONLY if the ref says we should still be recording
        if (isRecordingRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart recognition:", e);
            setIsRecording(false);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      recognitionRef.current?.stop();
    } else {
      if (input.length >= MAX_CHARS) {
        setError(`Maximum character limit of ${MAX_CHARS} reached.`);
        return;
      }
      setIsRecording(true);
      setError(null);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Recognition start error:", e);
        setIsRecording(false);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setError("File is too large. Please upload a file smaller than 25MB.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const base64Data = await fileToBase64(file);
      const model = "gemini-3-flash-preview";
      
      const response = await genAI.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: "Transcribe the following audio/video file verbatim. Capture everything accurately. Return only the transcription." },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data
                }
              }
            ]
          }
        ]
      });

      const transcription = response.text || "";
      if (transcription) {
        setInput(prev => {
          const separator = prev ? "\n\n--- New Transcription ---\n\n" : "";
          return (prev + separator + transcription).trim().slice(0, MAX_CHARS);
        });
      } else {
        setError("Transcription returned empty. Try a different file.");
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError("Error transcribing file. Ensure it's a supported media type.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDirectMove = () => {
    if (!input.trim()) return;
    setOutput(prev => (prev ? prev + "\n\n" + input : input));
    setInput('');
    setError(null);
  };

  const handleProcess = async () => {
    if (!input.trim()) {
      setError('Please enter some text, dictate, or upload a file first.');
      return;
    }

    if (!user) {
      setError('Please sign in to process notes.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const model = "gemini-3-flash-preview";
      const prompts = {
        transcript: "Clean up the following transcript. Fix grammar, remove filler words, and improve flow while keeping the original meaning: ",
        minutes: "Transform the following notes into structured meeting minutes. Include attendees, key discussion points, and decisions: ",
        tasks: "Extract a clear, actionable task list from the following text. Use checkboxes: ",
        email: "Rewrite the following rough notes into a professional, clear email: "
      };

      const response = await genAI.models.generateContent({
        model,
        contents: prompts[format] + input,
      });

      const resultText = response.text || "No response generated.";
      setOutput(resultText);

      const path = 'history';
      try {
        await addDoc(collection(db, path), {
          uid: user.uid,
          timestamp: Date.now(),
          input,
          output: resultText,
          format
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    } catch (error) {
      console.error("Error processing with Gemini:", error);
      setError("Failed to process your request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInputToClipboard = () => {
    if (!input.trim()) return;
    navigator.clipboard.writeText(input);
    setInputCopied(true);
    setTimeout(() => setInputCopied(false), 2000);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const deleteHistoryItem = async (id: string) => {
    if (!user) return;
    const path = `history/${id}`;
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Failed to sign in with Google.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SmartDictate AI
          </h1>
          <p className="text-slate-400 mb-8">
            Transform your voice and notes into professional documents with the power of Gemini AI.
          </p>
          <button
            onClick={handleSignIn}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const loadFromHistory = (item: HistoryItem) => {
    setInput(item.input);
    setOutput(item.output);
    setFormat(item.format);
    setError(null);
    setShowHistory(false);
  };


  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              SmartDictate AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <button 
              onClick={handleSignOut}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Input Notes</h2>
              <div className="flex gap-4">
                {input.trim() && (
                  <button 
                    onClick={copyInputToClipboard}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                  >
                    {inputCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {inputCopied ? 'Copied!' : 'Copy Input'}
                  </button>
                )}
                <button 
                  onClick={clearAll}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Start typing, dictate, or upload a file..."
                className={`w-full h-80 bg-slate-950/50 border rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all resize-none ${
                  error ? 'border-red-500/50 focus:ring-red-500/30' : 'border-slate-800 focus:ring-indigo-500/50'
                }`}
              />
              
              {isUploading && (
                <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center space-y-4 z-10">
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-indigo-400 font-medium">Transcribing file...</p>
                </div>
              )}

              <div className="absolute bottom-4 left-4">
                <span className={`text-[10px] font-mono ${input.length >= MAX_CHARS ? 'text-red-400' : 'text-slate-600'}`}>
                  {input.length} / {MAX_CHARS}
                </span>
              </div>

              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="audio/*,video/*" 
                  className="hidden" 
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-colors shadow-lg"
                  title="Upload Audio/Video"
                >
                  <Upload className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleRecording}
                  className={`p-4 rounded-full shadow-lg transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                >
                  {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </motion.button>
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" /> {error}
              </motion.p>
            )}

            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-400">Select Transformation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'transcript', label: 'Clean Up', icon: RefreshCw },
                  { id: 'minutes', label: 'Minutes', icon: FileText },
                  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
                  { id: 'email', label: 'Email', icon: Mail },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFormat(item.id as OutputFormat)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2 ${
                      format === item.id 
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                        : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDirectMove}
                  disabled={isLoading || isUploading || !input.trim()}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  title="Move current chunk to result without AI processing"
                >
                  <ChevronRight className="w-5 h-5" />
                  Add to Result
                </button>
                <button
                  onClick={handleProcess}
                  disabled={isLoading || isUploading || !input.trim()}
                  className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Process with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Result</h2>
              {output && (
                <button 
                  onClick={copyToClipboard}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl p-4 overflow-auto min-h-[300px]">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm animate-pulse">Gemini is thinking...</p>
                </div>
              ) : output ? (
               <div className="markdown-body text-sm text-slate-300 leading-relaxed">
                <Markdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mt-3 mb-1" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-md font-bold text-white mt-2 mb-1" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
                    li: ({node, ...props}) => <li className="ml-2" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2" {...props} />,     
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-2 text-slate-400" {...props} />,
                  }}
                >
                  {output}
                </Markdown>
              </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-8">
                  <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">Your transformed notes will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  Recent History
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p>No history yet. Start processing notes to see them here.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/50 transition-all group cursor-pointer"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-800 rounded text-slate-400">
                          {item.format}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                            className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-2 mb-1">{item.input}</p>
                      <p className="text-xs text-slate-500 line-clamp-1 italic">{item.output}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="max-w-5xl mx-auto px-4 py-8 border-t border-slate-800/50 text-center">
        <p className="text-xs text-slate-600">
          Powered by Gemini AI • Built with React & Tailwind
        </p>
      </footer>
    </div>
  );
}

