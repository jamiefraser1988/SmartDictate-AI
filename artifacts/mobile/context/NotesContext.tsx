import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type OutputFormat = "transcript" | "minutes" | "tasks" | "email";
export type Tone = "formal" | "informal";

export interface Note {
  id: string;
  title: string;
  transcript: string;
  summary: string;
  actionItems: string[];
  duration: number;
  createdAt: string;
  outputFormat?: OutputFormat;
  processedOutput?: string;
  tone?: Tone;
}

interface NotesContextType {
  notes: Note[];
  addNote: (note: Note) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  getNoteById: (id: string) => Note | undefined;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

const STORAGE_KEY = "@smartdictate_notes";

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotes(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  };

  const saveNotes = async (updated: Note[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const addNote = useCallback(async (note: Note) => {
    setNotes((prev) => {
      const updated = [note, ...prev];
      saveNotes(updated);
      return updated;
    });
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, ...updates } : n));
      saveNotes(updated);
      return updated;
    });
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveNotes(updated);
      return updated;
    });
  }, []);

  const getNoteById = useCallback(
    (id: string) => notes.find((n) => n.id === id),
    [notes]
  );

  return (
    <NotesContext.Provider value={{ notes, addNote, updateNote, deleteNote, getNoteById }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used inside NotesProvider");
  return ctx;
}
