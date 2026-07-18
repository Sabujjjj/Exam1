import React, { useState, useEffect } from "react";
import { parseCSVQuestions, getCSVTemplate, encodeConfig } from "../utils";
import { ExamConfig, Question } from "../types";
import ResultsDashboard from "./ResultsDashboard";
import { 
  FileText, 
  Settings, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Play, 
  FileCode, 
  AlertCircle, 
  HelpCircle, 
  Globe, 
  ShieldCheck, 
  Database, 
  PlusCircle, 
  Trash2 
} from "lucide-react";

interface AdminPanelProps {
  onPreviewExam: (config: ExamConfig) => void;
}

export default function AdminPanel({ onPreviewExam }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"create" | "results">("create");
  
  // Configuration states
  const [title, setTitle] = useState("Weekly General Knowledge Trivia");
  const [description, setDescription] = useState("Please complete this multiple choice exam. The time limit is strict, and closing or switching this tab will trigger an automatic security submission. Good luck!");
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [strictMode, setStrictMode] = useState(true);
  const [maxFocusWarnings, setMaxFocusWarnings] = useState(3);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [csvError, setCsvError] = useState("");

  // Load default template on mount
  useEffect(() => {
    setCsvText(getCSVTemplate());
  }, []);

  // Parse questions whenever csvText changes
  useEffect(() => {
    if (!csvText.trim()) {
      setParsedQuestions([]);
      setCsvError("Paste or upload CSV data above to begin.");
      return;
    }
    
    try {
      const q = parseCSVQuestions(csvText);
      setParsedQuestions(q);
      if (q.length === 0) {
        setCsvError("No valid questions found. Check your CSV column headers.");
      } else {
        setCsvError("");
      }
    } catch (err) {
      console.error(err);
      setCsvError("Syntax error parsing CSV. Ensure proper format.");
    }
  }, [csvText]);

  // Handle Drag & Drop for CSV
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        const reader = new FileReader();
        reader.onload = (event) => {
          setCsvText(event.target?.result as string || "");
        };
        reader.readAsText(file);
      } else {
        alert("Please drop a valid .csv file.");
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string || "");
      };
      reader.readAsText(file);
    }
  };

  // Build the complete ExamConfig
  const buildConfig = (): ExamConfig => {
    return {
      title: title.trim() || "Untitled MCQ Exam",
      description: description.trim(),
      timerMinutes: Number(timerMinutes) || 10,
      shuffleQuestions,
      shuffleOptions,
      strictMode,
      maxFocusWarnings: Number(maxFocusWarnings) || 3,
      webhookUrl: webhookUrl.trim() || undefined,
      questions: parsedQuestions,
    };
  };

  // Generate Exam Share Link
  const handleGenerateExam = () => {
    if (parsedQuestions.length === 0) {
      alert("Cannot generate exam. You need at least 1 valid parsed question.");
      return;
    }
    const config = buildConfig();
    const encoded = encodeConfig(config);
    
    // Construct student link
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?exam=${encoded}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Config File (.exam JSON)
  const downloadConfigFile = () => {
    const config = buildConfig();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.exam`);
    dlAnchorElem.click();
  };

  return (
    <div id="admin-panel-container" className="max-w-6xl mx-auto space-y-8">
      {/* Platform Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 font-mono text-[11px] uppercase tracking-wider font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Serverless MCQ Generator</span>
          </div>
          <h2 className="text-2.5xl font-extrabold tracking-tight text-slate-900 font-sans">
            Exam Creator & Grading Suite
          </h2>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            Build self-contained, 100% free exams from simple CSV files. No logins or database queries required.
          </p>
        </div>

        {/* Tab Toggle Controls - Sleek style */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start md:self-auto">
          <button
            id="tab-btn-create"
            onClick={() => setActiveTab("create")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 cursor-pointer transition-all ${
              activeTab === "create"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Create Exam</span>
          </button>
          <button
            id="tab-btn-results"
            onClick={() => setActiveTab("results")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 cursor-pointer transition-all ${
              activeTab === "results"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Grading & Results DB</span>
          </button>
        </div>
      </div>

      {activeTab === "results" ? (
        <ResultsDashboard />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: Config & CSV Loader */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Basic Configurations */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2.5 flex items-center space-x-2">
                <Settings className="w-4.5 h-4.5 text-indigo-500" />
                <span>1. Exam General Config</span>
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Exam Title</label>
                  <input
                    id="exam-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Weekly Trivia Exam"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Instructions / Description</label>
                  <textarea
                    id="exam-desc-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter short instructions..."
                    rows={2}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Grid configs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Time Limit (Minutes)</label>
                  <input
                    id="exam-timer-input"
                    type="number"
                    min="1"
                    max="300"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Max Focus Violations</label>
                  <input
                    id="exam-warnings-input"
                    type="number"
                    min="1"
                    max="10"
                    value={maxFocusWarnings}
                    onChange={(e) => setMaxFocusWarnings(Math.max(1, Number(e.target.value)))}
                    disabled={!strictMode}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all">
                  <input
                    id="toggle-shuffle-q"
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Shuffle Qs</span>
                    <span className="text-[10px] text-slate-400 block">Randomizes order</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all">
                  <input
                    id="toggle-shuffle-opt"
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Shuffle Options</span>
                    <span className="text-[10px] text-slate-400 block">Scrambles choices</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all">
                  <input
                    id="toggle-strict"
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Focus Lock</span>
                    <span className="text-[10px] text-slate-400 block">Strict Anti-Cheat</span>
                  </div>
                </label>
              </div>

              {/* Google Sheets Webhook URL */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Google Sheets / Webhook Link <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 hover:underline cursor-help font-semibold" title="To collect results instantly into your private spreadsheets, configure a Google Apps Script Webhook. When students submit, their score details are automatically POSTed there.">
                    What is this?
                  </span>
                </div>
                <input
                  id="exam-webhook-input"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* 2. Questions CSV Parser */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                  <FileText className="w-4.5 h-4.5 text-indigo-500" />
                  <span>2. Upload MCQ Questions (CSV)</span>
                </h3>
                <button
                  id="btn-insert-sample"
                  onClick={() => setCsvText(getCSVTemplate())}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <span>Insert Sample CSV</span>
                </button>
              </div>

              {/* Drag & Drop File Zone */}
              <div 
                id="csv-drag-zone"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-5 text-center transition-all ${
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/30" 
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                }`}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer text-xs text-slate-600 inline-flex items-center justify-center space-x-2">
                  <span className="font-semibold text-indigo-600 hover:underline">Click to load CSV file</span>
                  <span>or drag & drop here</span>
                </label>
              </div>

              {/* Plain text area */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Or Paste Raw CSV Data Directly</label>
                <textarea
                  id="csv-textarea"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Question,Option A,Option B,Option C,Option D,Correct Answer\n"What is 2+2?",2,4,6,8,B`}
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-y"
                />
              </div>

              {/* Format Hints */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center text-slate-700">
                  <Check className="w-4 h-4 mr-1 text-emerald-600" />
                  Format Standard:
                </p>
                <p className="pl-5 text-[11px] text-slate-500">
                  Columns MUST include: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-800">Question</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-800">Option A</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-800">Option B</code>, ... and <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-800">Correct Answer</code>.
                </p>
                <p className="pl-5 text-[11px] text-slate-400">
                  * Correct Answer column accepts letters (e.g. A, B, C, D) or exact option values.
                </p>
              </div>
            </div>
          </div>

          {/* Column 2: Live Parsing Verification & Link Output */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Parsing Monitor */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <span>Validation Panel</span>
                <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Real-Time</span>
              </h3>

              {csvError ? (
                <div className="p-4 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-600" />
                  <span>{csvError}</span>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center space-x-2.5">
                  <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Success! {parsedQuestions.length} Questions parsed successfully.</span>
                </div>
              )}

              {parsedQuestions.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parsed Questions Preview</span>
                  <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-150 bg-slate-50/30">
                    {parsedQuestions.map((q, idx) => (
                      <div key={idx} className="p-3.5 text-xs">
                        <div className="font-medium text-slate-800 flex items-start">
                          <span className="text-indigo-600 font-bold font-mono mr-1.5">{idx+1}.</span>
                          <span className="flex-1 leading-relaxed">{q.question}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2.5 pl-5 text-[11px]">
                          {q.options.map((opt, oIdx) => {
                             const isCorrect = 
                               q.correctAnswer === String.fromCharCode(65 + oIdx) || 
                               q.correctAnswer.toLowerCase() === opt.toLowerCase();
                            return (
                              <div key={oIdx} className={`truncate px-1.5 py-0.5 rounded ${isCorrect ? "text-emerald-700 bg-emerald-50/50 font-bold" : "text-slate-500"}`}>
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <div className="mt-2 pl-5 text-[10px] text-slate-400 italic">
                            Explanation: {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Trigger Button */}
              <button
                id="btn-generate-exam"
                onClick={handleGenerateExam}
                disabled={parsedQuestions.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 px-4 rounded-lg text-xs transition-colors shadow-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
              >
                <Globe className="w-4 h-4" />
                <span>Generate Shareable Exam URL</span>
              </button>
            </div>

            {/* Generated Share Section */}
            {generatedLink && (
              <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-md space-y-4 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Exam Link Generated!</h4>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed">
                  The link contains the full questions database and strict settings compressed into the URL. Copy it and share with students!
                </p>

                {/* Copier input */}
                <div className="flex items-center space-x-2">
                  <input
                    id="generated-link-input"
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="flex-1 bg-slate-50 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 outline-none overflow-x-auto text-slate-600"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    id="btn-copy-link"
                    onClick={copyToClipboard}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer shrink-0"
                    title="Copy Link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                  </button>
                </div>

                {/* Sub Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    id="btn-preview-exam"
                    onClick={() => onPreviewExam(buildConfig())}
                    className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center space-x-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Run Exam Live</span>
                  </button>

                  <button
                    id="btn-download-config"
                    onClick={downloadConfigFile}
                    className="px-4 py-2 rounded-lg text-xs font-bold border border-indigo-150 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                    title="Download as standalone .exam file in case the URL becomes extremely long (for quizzes with over 50 questions)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .exam</span>
                  </button>
                </div>

                {copied && (
                  <p className="text-[10px] text-center text-emerald-600 font-bold mt-1">
                    ✓ Exam URL copied to clipboard!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
