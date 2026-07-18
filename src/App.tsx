import React, { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import StudentPortal from "./components/StudentPortal";
import { ExamConfig } from "./types";
import { decodeConfig } from "./utils";
import { GraduationCap, Award, ExternalLink, Lock, Unlock } from "lucide-react";

export default function App() {
  const [activeView, setActiveView] = useState<"admin" | "student">("admin");
  const [activeConfig, setActiveConfig] = useState<ExamConfig | null>(null);

  // Admin lock state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmNewPasscode, setConfirmNewPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [storedPasscode, setStoredPasscode] = useState<string | null>(null);

  // Load passcode from localStorage on mount & check URL query parameters
  useEffect(() => {
    const saved = localStorage.getItem("exam_admin_passcode");
    setStoredPasscode(saved);

    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("exam");
    if (encoded) {
      const config = decodeConfig(encoded);
      if (config) {
        setActiveConfig(config);
        setActiveView("student");
      } else {
        alert("The shared exam link is invalid or corrupted. Loading Creator panel.");
      }
    }
  }, []);

  const handlePreviewExam = (config: ExamConfig) => {
    setActiveConfig(config);
    setActiveView("student");
  };

  const handleExitPortal = () => {
    setActiveView("admin");
    // Clear url query parameter gracefully without refreshing
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newurl }, "", newurl);
  };

  const handleSetPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode.trim()) {
      setPasscodeError("Passcode cannot be empty.");
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setPasscodeError("Passcodes do not match.");
      return;
    }
    localStorage.setItem("exam_admin_passcode", newPasscode);
    setStoredPasscode(newPasscode);
    setIsAdminUnlocked(true);
    setPasscodeError("");
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === storedPasscode) {
      setIsAdminUnlocked(true);
      setPasscodeError("");
      setPasscode("");
    } else {
      setPasscodeError("Incorrect passcode. Access denied.");
    }
  };

  const handleResetPasscode = () => {
    if (confirm("Resetting your passcode will clear ALL locally stored student results and configurations in this browser for security. Are you sure you want to proceed?")) {
      localStorage.removeItem("exam_admin_passcode");
      localStorage.removeItem("mcq_exam_saved_results");
      setStoredPasscode(null);
      setIsAdminUnlocked(false);
      setPasscode("");
      setNewPasscode("");
      setConfirmNewPasscode("");
      setPasscodeError("");
      alert("Passcode has been reset. You can now set a new passcode.");
    }
  };

  return (
    <div id="app-viewport" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased print:bg-white">
      {/* Navigation Header (Hidden when printing PDF certificates) */}
      <header id="main-header" className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden shadow-xs">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              Q
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-800">
                FreeExam <span className="text-indigo-600 font-medium">Static</span>
              </span>
              <span className="text-[9px] font-mono text-slate-400 block -mt-1">Serverless MCQ Hub</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* GitHub pages deployment ready tag */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Deployment: GitHub Pages Ready
            </div>

            {activeView === "admin" ? (
              <div className="flex items-center space-x-2">
                {isAdminUnlocked && (
                  <button
                    id="btn-lock-console"
                    onClick={() => setIsAdminUnlocked(false)}
                    className="px-3.5 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-100 border border-rose-200 cursor-pointer transition-all flex items-center space-x-1.5"
                    title="Lock Creator Panel"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Lock Creator</span>
                  </button>
                )}
                <button
                  id="btn-switch-student-mode"
                  onClick={() => {
                    setActiveConfig(null);
                    setActiveView("student");
                  }}
                  className="px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-semibold hover:bg-slate-850 flex items-center space-x-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <span>Student Lobby</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </div>
            ) : (
              <button
                id="btn-switch-admin-mode"
                onClick={handleExitPortal}
                className="px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-semibold hover:bg-slate-850 cursor-pointer flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>Back to Exam Creator</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content-window" className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 print:p-0">
        {activeView === "admin" ? (
          !isAdminUnlocked ? (
            /* Elegant Lock Screen / Security Gateway */
            <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 shadow-xs space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto border border-indigo-100">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Admin Security Gateway</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Protect exam blueprints, raw CSV answers, and student grading sheets from unauthorized client access.
                </p>
              </div>

              {storedPasscode === null ? (
                /* First-time setup */
                <form onSubmit={handleSetPasscode} className="space-y-4">
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 leading-relaxed">
                    <strong>Choose a Master Passcode:</strong> Set a secure passcode to restrict student access. It is stored safely in your current browser.
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Choose Passcode</label>
                      <input
                        type="password"
                        required
                        value={newPasscode}
                        onChange={(e) => setNewPasscode(e.target.value)}
                        placeholder="Enter numbers or text"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Passcode</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPasscode}
                        onChange={(e) => setConfirmNewPasscode(e.target.value)}
                        placeholder="Re-enter passcode"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {passcodeError && (
                    <p className="text-[11px] text-rose-600 font-bold text-center">{passcodeError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Set Master Passcode
                  </button>
                </form>
              ) : (
                /* Standard passcode check */
                <form onSubmit={handleUnlock} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passcode Required</label>
                    <input
                      type="password"
                      required
                      autoFocus
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter master passcode"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-center tracking-widest font-bold"
                    />
                  </div>

                  {passcodeError && (
                    <p className="text-[11px] text-rose-600 font-bold text-center">{passcodeError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Unlock Suite
                  </button>

                  <div className="pt-2 border-t border-slate-100 flex justify-center">
                    <button
                      type="button"
                      onClick={handleResetPasscode}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                    >
                      Reset Passcode
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <AdminPanel onPreviewExam={handlePreviewExam} />
          )
        ) : (
          <StudentPortal initialConfig={activeConfig} onExitPortal={handleExitPortal} />
        )}
      </main>

      {/* Bottom Bar Info (Sleek Theme style, hidden when printing) */}
      <footer id="main-footer" className="bg-white border-t border-slate-200 px-6 py-4 mt-12 print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-400">
            <span className="flex items-center">
              <svg className="w-3.5 h-3.5 mr-1 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </svg> 
              0.0kb Server Latency
            </span>
            <span className="flex items-center">
              <svg className="w-3.5 h-3.5 mr-1 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg> 
              Passcode Protected Gateway
            </span>
          </div>
          <div className="text-xs text-slate-400 font-medium text-center md:text-right">
            Open Source Initiative • Hosted via <span className="text-slate-600 font-semibold underline decoration-indigo-500 underline-offset-2">GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
