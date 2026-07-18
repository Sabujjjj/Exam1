import React, { useState, useEffect, useRef } from "react";
import { ExamConfig, StudentSession, StudentResult, Question } from "../types";
import { formatTime, generateResultHash } from "../utils";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Award, 
  Download, 
  Printer, 
  UploadCloud, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  Send,
  Play
} from "lucide-react";

interface StudentPortalProps {
  initialConfig: ExamConfig | null;
  onExitPortal: () => void;
}

export default function StudentPortal({ initialConfig, onExitPortal }: StudentPortalProps) {
  // Config loaded either via URL or direct file upload
  const [config, setConfig] = useState<ExamConfig | null>(initialConfig);
  
  // Student Session states
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isExamStarted, setIsExamStarted] = useState(false);
  
  // Active questions state (holds shuffled copy if toggled)
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  // Store mapped options if option shuffling is enabled
  const [questionOptionsMap, setQuestionOptionsMap] = useState<Record<string, string[]>>({});
  
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionText
  const [focusWarnings, setFocusWarnings] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [cheated, setCheated] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalResult, setFinalResult] = useState<StudentResult | null>(null);
  
  // Webhook submission status
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "sending" | "success" | "failed">("idle");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus lock trigger refs
  const hasStartedRef = useRef(false);
  const isSubmittedRef = useRef(false);

  // Keep refs synchronized to prevent stale closure issues in event listeners
  useEffect(() => {
    hasStartedRef.current = isExamStarted;
    isSubmittedRef.current = isSubmitted;
  }, [isExamStarted, isSubmitted]);

  // Handle local Exam Config upload if none loaded via URL
  const handleExamUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.questions)) {
            setConfig(parsed as ExamConfig);
          } else {
            alert("Invalid .exam file format.");
          }
        } catch (err) {
          alert("Failed to parse the exam file.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Scramble / Shuffle helper (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Initialize Exam Session
  const handleStartExam = () => {
    if (!studentName.trim()) {
      alert("Please enter your name to start the exam.");
      return;
    }
    if (!config) return;

    // Set countdown timer
    setTimeLeft(config.timerMinutes * 60);

    // Prepare questions
    let qs = [...config.questions];
    if (config.shuffleQuestions) {
      qs = shuffleArray(qs);
    }

    // Prepare options scrambling map
    const optMap: Record<string, string[]> = {};
    qs.forEach((q) => {
      if (config.shuffleOptions) {
        optMap[q.id] = shuffleArray(q.options);
      } else {
        optMap[q.id] = [...q.options];
      }
    });

    setShuffledQuestions(qs);
    setQuestionOptionsMap(optMap);
    setIsExamStarted(true);
    setFocusWarnings(0);
  };

  // 1. Timer Logic
  useEffect(() => {
    if (isExamStarted && !isSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit("timeout");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamStarted, isSubmitted, timeLeft]);

  // 2. Anti-Cheat Window Focus Lock Logic
  useEffect(() => {
    const handleWindowBlur = () => {
      // Trigger warnings only if exam is active, has started, and is not yet submitted
      if (!hasStartedRef.current || isSubmittedRef.current || cheated) return;
      if (!config || !config.strictMode) return;

      setFocusWarnings((prev) => {
        const nextWarnings = prev + 1;
        if (nextWarnings >= config.maxFocusWarnings) {
          setCheated(true);
          handleAutoSubmit("security_lock");
          return nextWarnings;
        } else {
          setShowWarningModal(true);
          return nextWarnings;
        }
      });
    };

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        handleWindowBlur();
      }
    });

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleWindowBlur);
    };
  }, [config, cheated]);

  // Core submit evaluator
  const calculateAndSubmitResult = (wasForcedCheating = false) => {
    if (!config) return;

    // Evaluate answers
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    config.questions.forEach((q) => {
      const selectedText = answers[q.id];
      if (!selectedText) {
        unanswered++;
        return;
      }

      // Check if correct
      // Correct answer could be exact text, or standard letter A, B, C, D
      const originalOptions = q.options;
      const letterIndex = q.correctAnswer.charCodeAt(0) - 65; // A=0, B=1, etc.
      const correctTextByLetter = originalOptions[letterIndex];

      const isCorrectText = selectedText.toLowerCase() === q.correctAnswer.toLowerCase();
      const isCorrectLetterMatch = correctTextByLetter && selectedText.toLowerCase() === correctTextByLetter.toLowerCase();

      if (isCorrectText || isCorrectLetterMatch) {
        correct++;
      } else {
        incorrect++;
      }
    });

    // Score formula: (Correct * 1) - (Incorrect * 0.5)
    // Score cannot fall below 0
    const rawScore = (correct * 1.0) - (incorrect * 0.5);
    const score = Math.max(0, Math.round(rawScore * 10) / 10);
    const maxScore = config.questions.length;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    const resultPayload: Omit<StudentResult, "hash"> = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      studentName: studentName.trim(),
      studentId: studentId.trim(),
      examTitle: config.title,
      score,
      maxScore,
      percentage,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      totalQuestions: maxScore,
      focusWarnings,
      cheated: wasForcedCheating || cheated,
      submittedAt: new Date().toLocaleString(),
    };

    // Construct cryptographic verification hash
    const signature = generateResultHash(resultPayload);
    const final: StudentResult = { ...resultPayload, hash: signature };

    setFinalResult(final);
    setIsSubmitted(true);

    // Auto trigger webhook if available
    if (config.webhookUrl) {
      triggerWebhook(final, config.webhookUrl);
    }
  };

  // Handle Automatic submissions (Timeout / Excessive tab switching)
  const handleAutoSubmit = (reason: "timeout" | "security_lock") => {
    if (isSubmittedRef.current) return;
    
    if (reason === "timeout") {
      alert("TIME EXPIRED: Your exam time has concluded. Your responses are being computed and submitted.");
    } else if (reason === "security_lock") {
      alert("SECURITY EXAM LOCK: Too many window/tab switches detected. Your exam has been locked and automatically submitted for investigation.");
    }
    
    calculateAndSubmitResult(reason === "security_lock");
  };

  const triggerWebhook = async (result: StudentResult, url: string) => {
    setWebhookStatus("sending");
    try {
      const response = await fetch(url, {
        method: "POST",
        mode: "no-cors", // Standard Google Sheets webhook configuration is usually no-cors or JSONP
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result),
      });
      setWebhookStatus("success");
    } catch (err) {
      console.error("Webhook submit failed:", err);
      setWebhookStatus("failed");
    }
  };

  const handleManualSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    const totalCount = shuffledQuestions.length;
    const unansweredCount = totalCount - answeredCount;

    let confirmMsg = "Are you sure you want to finish and submit your exam?";
    if (unansweredCount > 0) {
      confirmMsg += ` You have ${unansweredCount} unanswered questions remaining.`;
    }

    if (confirm(confirmMsg)) {
      calculateAndSubmitResult(false);
    }
  };

  // Download Student result slip file
  const downloadResultSlip = () => {
    if (!finalResult) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalResult, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `exam_result_${studentName.replace(/\s+/g, "_")}.json`);
    dlAnchorElem.click();
  };

  // Trigger Print media styles
  const handlePrintCertificate = () => {
    window.print();
  };

  // Reset state to view other configurations
  const handleExitPortalLocal = () => {
    if (!isSubmitted && isExamStarted) {
      if (!confirm("Are you sure you want to exit? Your exam is active and progress will be lost.")) {
        return;
      }
    }
    onExitPortal();
  };

  // Render Launch Board
  if (!config) {
    return (
      <div id="student-portal-unloaded" className="max-w-md mx-auto bg-white p-8 rounded-lg border border-slate-200 shadow-xs text-center space-y-6 my-10">
        <UploadCloud className="w-16 h-16 text-indigo-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-slate-900">Load MCQ Exam</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Please upload an `.exam` config file shared by your educator to begin your test.</p>
        </div>
        <div className="border border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50">
          <input 
            id="portal-exam-upload" 
            type="file" 
            accept=".exam" 
            onChange={handleExamUpload} 
            className="hidden" 
          />
          <label htmlFor="portal-exam-upload" className="cursor-pointer block text-xs font-bold text-indigo-600 hover:underline">
            Choose Standalone Exam File
          </label>
        </div>
        <button 
          onClick={onExitPortal}
          className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
        >
          Return to Admin Panel
        </button>
      </div>
    );
  }

  // Render Certificate Result page
  if (isSubmitted && finalResult) {
    return (
      <div id="exam-result-page" className="max-w-3xl mx-auto space-y-8 my-10 print:my-0">
        
        {/* Certificate Display (Optimized for standard paper printing) */}
        <div id="printable-certificate-card" className="bg-white p-10 rounded-lg border border-slate-200 shadow-xs relative overflow-hidden space-y-8 print:border-0 print:shadow-none print:p-4">
          {/* Certificate Stamp */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-100/50 rounded-full flex items-center justify-center -rotate-12 print:hidden">
            <Award className="w-20 h-20 text-slate-300" />
          </div>

          <div className="text-center space-y-3">
            <span className="font-mono text-xs font-bold text-indigo-600 tracking-widest uppercase">Verified Achievement</span>
            <h2 className="text-2.5xl font-extrabold tracking-tight text-slate-900 font-sans">Certificate of Completion</h2>
            <div className="w-20 h-1 bg-indigo-600 mx-auto rounded-full"></div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">This certifies that</p>
            <p className="text-3xl font-bold text-slate-900 border-b border-slate-100 max-w-md mx-auto pb-2">{finalResult.studentName}</p>
            {finalResult.studentId && (
              <p className="text-xs font-mono text-slate-500 mt-1">Student ID: {finalResult.studentId}</p>
            )}
          </div>

          <div className="text-center max-w-lg mx-auto space-y-2">
            <p className="text-sm text-slate-600 leading-relaxed">
              Has successfully compiled, completed, and logged performance for the comprehensive exam:
            </p>
            <p className="text-lg font-bold text-indigo-700">"{finalResult.examTitle}"</p>
          </div>

          {/* Core Scoring Dashboard Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-lg bg-slate-50 border border-slate-200 text-center max-w-xl mx-auto">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Final Grade</p>
              <p className="text-xl font-extrabold text-slate-800 mt-1">{finalResult.score} / {finalResult.maxScore}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Percentage</p>
              <p className="text-xl font-extrabold text-indigo-600 mt-1">{finalResult.percentage}%</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Correct Attempts</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-1">{finalResult.correctCount}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tab Violations</p>
              <p className={`text-xl font-extrabold mt-1 ${finalResult.cheated ? "text-rose-600" : "text-slate-500"}`}>
                {finalResult.cheated ? "FORCED" : `${finalResult.focusWarnings} Warnings`}
              </p>
            </div>
          </div>

          {/* Certificate Verification Signature stamp */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-6 gap-4 text-xs">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Evaluation Timestamp</span>
              <p className="font-mono text-slate-600">{finalResult.submittedAt}</p>
            </div>
            
            <div className="text-center sm:text-right space-y-1 max-w-xs">
              <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">Cryptographic Security Check</span>
              <p className="font-mono text-[9px] text-slate-500 break-all bg-slate-50 p-1.5 rounded-lg border border-slate-200">{finalResult.hash}</p>
            </div>
          </div>
        </div>

        {/* User Interaction Actions Box */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4 print:hidden">
          <h4 className="font-bold text-slate-900 text-sm">Submit Grades & Back up</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Please export your grades slip JSON file and send it back to your educator so they can upload it into their database dashboard. Or print this certificate directly to PDF.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              id="btn-download-slip"
              onClick={downloadResultSlip}
              className="px-4 py-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Grades Slip (.json)</span>
            </button>

            <button
              id="btn-print-cert"
              onClick={handlePrintCertificate}
              className="px-4 py-3 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>Print Certificate (PDF)</span>
            </button>

            <button
              id="btn-exit-student-portal"
              onClick={handleExitPortalLocal}
              className="px-4 py-3 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Back to Lobby</span>
            </button>
          </div>

          {/* Webhook Status Display */}
          {config.webhookUrl && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between">
              <span className="text-slate-500 font-bold">Automatic Spreadsheet Webhook Sync:</span>
              {webhookStatus === "sending" && <span className="text-indigo-600 font-bold animate-pulse">Sending grade details...</span>}
              {webhookStatus === "success" && <span className="text-emerald-600 font-bold flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-0.5" /> Synchronized Successfully!</span>}
              {webhookStatus === "failed" && <span className="text-rose-600 font-bold">Web Hook connection timed out. Please send grades manually.</span>}
              {webhookStatus === "idle" && <span className="text-slate-400 font-medium">Standby</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render active taking state
  if (isExamStarted && shuffledQuestions.length > 0) {
    const currentQuestion = shuffledQuestions[activeQuestionIndex];
    const choices = questionOptionsMap[currentQuestion.id] || [];

    // Color-coding class for timer
    const isTimerUrgent = timeLeft < 60;

    return (
      <div id="student-portal-active-exam" className="max-w-4xl mx-auto space-y-6 my-6 relative select-none">
        
        {/* Sticky Header with Timer and Progress Bar */}
        <div className="sticky top-4 bg-white/95 backdrop-blur-xs p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
              Question {activeQuestionIndex + 1} of {shuffledQuestions.length}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-[200px]" title={config.title}>
              {config.title}
            </span>
          </div>

          <div className="flex items-center space-x-5">
            {config.strictMode && (
              <div className="flex items-center text-amber-600 text-xs font-bold space-x-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Warnings:</span>
                <span>{focusWarnings} / {config.maxFocusWarnings}</span>
              </div>
            )}

            <div className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg font-mono text-sm font-bold ${
              isTimerUrgent ? "bg-rose-50 text-rose-600 animate-pulse border border-rose-200" : "bg-slate-100 text-slate-800 border border-slate-200/50"
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Progress horizontal line indicator */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300" 
            style={{ width: `${((activeQuestionIndex + 1) / shuffledQuestions.length) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question panel */}
          <div className="lg:col-span-8 bg-white p-8 rounded-lg border border-slate-200 shadow-xs space-y-6">
            
            {/* Question title */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-indigo-600 font-mono uppercase tracking-wider">Question Statement</span>
              <p className="text-lg font-bold text-slate-900 leading-relaxed">{currentQuestion.question}</p>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {choices.map((option, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx);
                const isSelected = answers[currentQuestion.id] === option;

                return (
                  <button
                    key={oIdx}
                    id={`option-${currentQuestion.id}-${letter}`}
                    onClick={() => {
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: option,
                      }));
                    }}
                    className={`w-full text-left px-5 py-4 rounded-lg border text-sm font-medium transition-all cursor-pointer flex items-center space-x-3 ${
                      isSelected 
                        ? "border-indigo-600 bg-indigo-50/20 text-indigo-900 shadow-xs" 
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold border ${
                      isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}>
                      {letter}
                    </span>
                    <span className="flex-1">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Pagination Button triggers */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                id="btn-prev-q"
                onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIndex === 0}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer flex items-center space-x-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {activeQuestionIndex < shuffledQuestions.length - 1 ? (
                <button
                  id="btn-next-q"
                  onClick={() => setActiveQuestionIndex((prev) => Math.min(shuffledQuestions.length - 1, prev + 1))}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1 cursor-pointer transition-colors shadow-xs"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="btn-exam-submit"
                  onClick={handleManualSubmit}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 cursor-pointer transition-colors shadow-md uppercase tracking-wider"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Exam</span>
                </button>
              )}
            </div>
          </div>

          {/* Sidebar tracker grid */}
          <div className="lg:col-span-4 bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">Exam Tracker</h4>
            
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider">
              Click a number to quickly toggle between questions. Colored indicators show completed items.
            </p>

            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
              {shuffledQuestions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isActive = idx === activeQuestionIndex;

                return (
                  <button
                    key={q.id}
                    id={`tracker-dot-${idx}`}
                    onClick={() => setActiveQuestionIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer border ${
                      isActive ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-100" :
                      isAnswered ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-md bg-indigo-600 border border-indigo-600 shrink-0"></div>
                <span>Current Question</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-md bg-emerald-50 border border-emerald-200 shrink-0"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-md bg-slate-50 border border-slate-200 shrink-0"></div>
                <span>Unanswered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Focus warning pop up overlays */}
        {showWarningModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg max-w-sm text-center border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-rose-700 text-base">SECURITY WARNING DETECTED!</h4>
              
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  You switched browser tabs, opened another application, or clicked outside the active test workspace.
                </p>
                <p className="font-bold text-slate-850">
                  Focus Warning: {focusWarnings} of {config.maxFocusWarnings} allowable attempts.
                </p>
                <p className="text-[10px] text-slate-400">
                  If you exceed the maximum attempts, your scorecard will lock and auto-submit immediately with zero final warning.
                </p>
              </div>

              <button
                id="btn-resume-exam"
                onClick={() => setShowWarningModal(false)}
                className="w-full py-2.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer transition-colors"
              >
                I Understand, Resume Exam
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render entry Lobby
  return (
    <div id="student-portal-lobby" className="max-w-xl mx-auto bg-white p-8 rounded-lg border border-slate-200 shadow-xs space-y-6 my-10">
      <div className="text-center space-y-2 border-b border-slate-100 pb-4">
        <span className="font-mono text-xs font-bold text-indigo-600 uppercase tracking-wider">Exam Entrance Lobby</span>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">{config.title}</h3>
        {config.description && (
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">{config.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Duration limit</span>
          <span className="text-base font-bold text-slate-800">{config.timerMinutes} Minutes</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Questions</span>
          <span className="text-base font-bold text-slate-800">{config.questions.length} Items</span>
        </div>
      </div>

      {config.strictMode && (
        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg flex items-start space-x-3 text-xs text-amber-800 leading-relaxed animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Anti-Cheat Focus Lock Active:</span>
            <p className="text-[11px] text-amber-700">
              Opening secondary search tabs, reloading, switching windows, or taking screenshot capture loops will increase your focus count warning. Exceeding {config.maxFocusWarnings} alerts triggers automatic submission.
            </p>
          </div>
        </div>
      )}

      {/* Input Credentials Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">Your Full Name *</label>
          <input
            id="student-name-input"
            type="text"
            required
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">Roll No. / Student ID <span className="text-slate-450 font-normal">(Optional)</span></label>
          <input
            id="student-id-input"
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. CS2026-44"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
        <button
          id="btn-start-exam"
          onClick={handleStartExam}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-lg text-xs transition-colors shadow-xs tracking-wider uppercase cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <Play className="w-4 h-4" />
          <span>Launch & Start Exam</span>
        </button>

        <button
          id="btn-lobby-exit"
          onClick={handleExitPortalLocal}
          className="w-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3.5 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center"
        >
          <span>Exit Entrance Lobby</span>
        </button>
      </div>
    </div>
  );
}
