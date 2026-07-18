import Papa from "papaparse";
import { Question, ExamConfig, StudentResult } from "./types";
import LZString from "lz-string";

// Highly compact encoding/decoding using lz-string with backward-compatible fallback
export function encodeConfig(config: ExamConfig): string {
  try {
    const jsonStr = JSON.stringify(config);
    return LZString.compressToEncodedURIComponent(jsonStr);
  } catch (err) {
    console.error("Failed to encode config:", err);
    return "";
  }
}

export function decodeConfig(encoded: string): ExamConfig | null {
  try {
    // 1. Try to decompress using lz-string
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (decompressed) {
      try {
        const parsed = JSON.parse(decompressed);
        if (parsed && typeof parsed === "object" && "questions" in parsed) {
          return parsed as ExamConfig;
        }
      } catch (e) {
        // Skip and fall back to legacy decoding
      }
    }

    // 2. Legacy fallback: Base64 decoding
    const binString = atob(encoded);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr) as ExamConfig;
  } catch (err) {
    console.error("Failed to decode config with both LZString and Base64:", err);
    return null;
  }
}

// Generate security hash to prevent result tampering
export function generateResultHash(result: Omit<StudentResult, "hash">): string {
  const salt = "MCQ_EXAM_SECURE_SALT_2026";
  const payload = `${result.studentName}|${result.studentId}|${result.examTitle}|${result.score}|${result.maxScore}|${result.cheated}|${salt}`;
  
  // Simple, robust hash function (murmurhash / DJB2 combined)
  let hash1 = 5381;
  let hash2 = 2243;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 4) + hash2) ^ char;
  }
  
  const part1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${part1}-${part2}`.toUpperCase();
}

// Verify result hash integrity
export function verifyResultHash(result: StudentResult): boolean {
  const currentHash = result.hash;
  const computedHash = generateResultHash({
    id: result.id,
    studentName: result.studentName,
    studentId: result.studentId,
    examTitle: result.examTitle,
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    correctCount: result.correctCount,
    incorrectCount: result.incorrectCount,
    unansweredCount: result.unansweredCount,
    totalQuestions: result.totalQuestions,
    focusWarnings: result.focusWarnings,
    cheated: result.cheated,
    submittedAt: result.submittedAt,
  });
  return currentHash === computedHash;
}

// Intelligent CSV parser for MCQ questions
export function parseCSVQuestions(csvText: string): Question[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const questions: Question[] = [];

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn("PapaParse errors:", parsed.errors);
  }

  const rows = parsed.data as Record<string, string>[];

  rows.forEach((row, idx) => {
    // Attempt to locate fields regardless of case and trimming
    const getField = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
        );
        if (foundKey && row[foundKey] !== undefined) {
          return row[foundKey].trim();
        }
      }
      return "";
    };

    const questionText = getField(["question", "questiontext", "q"]);
    if (!questionText) return; // Skip if no question text

    // Gather options
    // Let's check for "Option A", "Option B", "Option C", "Option D" etc.,
    // or search keys containing "option" or "choice"
    const options: string[] = [];
    
    // Check Option A, B, C, D... up to Z
    for (let charCode = 65; charCode <= 90; charCode++) {
      const char = String.fromCharCode(charCode);
      const optionVal = getField([
        `option ${char}`,
        `option_${char}`,
        `choice ${char}`,
        `choice_${char}`,
        char,
      ]);
      if (optionVal) {
        options.push(optionVal);
      }
    }

    // If options are still empty, try "option 1", "option 2", etc.
    if (options.length === 0) {
      for (let i = 1; i <= 10; i++) {
        const optionVal = getField([`option ${i}`, `option_${i}`, `choice ${i}`, `choice_${i}`, String(i)]);
        if (optionVal) {
          options.push(optionVal);
        }
      }
    }

    // If still empty, collect any column with "option" in it
    if (options.length === 0) {
      Object.keys(row).forEach((k) => {
        if (k.toLowerCase().includes("option") || k.toLowerCase().includes("choice")) {
          const val = row[k].trim();
          if (val) options.push(val);
        }
      });
    }

    const correctAnswer = getField([
      "correct answer",
      "correct_answer",
      "correct",
      "answer",
      "correctoption",
    ]);

    const explanation = getField(["explanation", "reason", "exp"]);

    questions.push({
      id: `q_${Date.now()}_${idx}`,
      question: questionText,
      options: options.length > 0 ? options : ["True", "False"], // Fallback to True/False if no options found
      correctAnswer: correctAnswer || "A", // Default fallback
      explanation: explanation || undefined,
    });
  });

  return questions;
}

// Generate a template CSV
export function getCSVTemplate(): string {
  return `Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation
"What is the capital of France?",Paris,London,Berlin,Madrid,A,"Paris has been the capital since 508 AD."
"Which programming language powers web browser interactivity?",HTML,CSS,JavaScript,Python,C,"JavaScript is the official scripting language of the web."
"What is 5 + 7?",10,12,14,15,B,"Simple addition: 5 + 7 = 12."
"Is the earth flat?",True,False,,,B,"Scientific evidence demonstrates the Earth is an oblate spheroid."`;
}

// Formatting seconds into MM:SS
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
