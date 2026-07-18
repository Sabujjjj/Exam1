import React, { useState, useEffect } from "react";
import { StudentResult } from "../types";
import { verifyResultHash } from "../utils";
import { 
  FileUp, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Award, 
  Users, 
  Search, 
  Download, 
  Eye, 
  X, 
  ShieldCheck, 
  ShieldAlert 
} from "lucide-react";

export default function ResultsDashboard() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "passed" | "failed" | "cheated" | "genuine">("all");
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("mcq_exam_saved_results");
    if (saved) {
      try {
        setResults(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load results from storage", err);
      }
    }
  }, []);

  // Save to localStorage when changed
  const saveResults = (newResults: StudentResult[]) => {
    setResults(newResults);
    localStorage.setItem("mcq_exam_saved_results", JSON.stringify(newResults));
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            
            // Basic duck-typing check
            if (parsed && typeof parsed.studentName === "string" && typeof parsed.score === "number") {
              const studentResult = parsed as StudentResult;
              
              // Avoid duplicates
              setResults((prev) => {
                const exists = prev.some((r) => r.id === studentResult.id);
                if (exists) return prev;
                const updated = [...prev, studentResult];
                localStorage.setItem("mcq_exam_saved_results", JSON.stringify(updated));
                return updated;
              });
            } else {
              alert(`Invalid exam result format in ${file.name}`);
            }
          } catch (err) {
            console.error("Error parsing file", err);
            alert(`Failed to parse ${file.name}`);
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please upload JSON files exported from the Student Portal.");
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const clearAllResults = () => {
    if (confirm("Are you sure you want to clear all imported student results? This cannot be undone.")) {
      saveResults([]);
    }
  };

  const deleteResult = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this student result?")) {
      const updated = results.filter((r) => r.id !== id);
      saveResults(updated);
      if (selectedResult?.id === id) {
        setSelectedResult(null);
      }
    }
  };

  // Statistics calculations
  const totalStudents = results.length;
  const passedStudents = results.filter((r) => r.percentage >= 50).length;
  const passRate = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;
  
  const scores = results.map((r) => r.score);
  const maxPossibleScores = results.map((r) => r.maxScore);
  const totalScoreObtained = scores.reduce((sum, s) => sum + s, 0);
  const totalMaxScorePossible = maxPossibleScores.reduce((sum, s) => sum + s, 0);
  const averagePercentage = totalStudents > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / totalStudents) 
    : 0;

  const academicIntegrityViolations = results.filter((r) => r.cheated || r.focusWarnings > 1).length;
  const integrityRate = totalStudents > 0 
    ? Math.round(((totalStudents - academicIntegrityViolations) / totalStudents) * 100) 
    : 100;

  // Filter & Search
  const filteredResults = results.filter((r) => {
    const matchesSearch = 
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.examTitle.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "passed") return r.percentage >= 50;
    if (filterType === "failed") return r.percentage < 50;
    if (filterType === "cheated") return r.cheated;
    if (filterType === "genuine") return verifyResultHash(r);
    
    return true;
  });

  // Export all to CSV
  const exportAllToCSV = () => {
    if (results.length === 0) return;
    
    const headers = "Student Name,Student ID,Exam Title,Score,Max Score,Percentage,Correct,Incorrect,Unanswered,Focus Warnings,Cheated/Auto-Submitted,Submitted At,Integrity Verified\n";
    const csvContent = "data:text/csv;charset=utf-8," + headers + results.map((r) => {
      const isGenuine = verifyResultHash(r) ? "YES" : "TAMPERED/UNVERIFIED";
      return `"${r.studentName}","${r.studentId}","${r.examTitle}",${r.score},${r.maxScore},${r.percentage}%,${r.correctCount},${r.incorrectCount},${r.unansweredCount},${r.focusWarnings},${r.cheated ? "YES" : "NO"},"${r.submittedAt}","${isGenuine}"`;
    }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `all_student_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="results-dashboard-root" className="space-y-6">
      {/* KPI Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div id="kpi-total-students" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Submissions</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalStudents}</p>
          </div>
        </div>

        {/* Average Class Score */}
        <div id="kpi-avg-score" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <Award className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class Average</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{averagePercentage}%</p>
          </div>
        </div>

        {/* Pass Rate */}
        <div id="kpi-pass-rate" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
            <CheckCircle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass Rate (≥50%)</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{passRate}%</p>
          </div>
        </div>

        {/* Honor Integrity Rate */}
        <div id="kpi-integrity" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Integrity Index</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{integrityRate}%</p>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div 
        id="result-upload-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive 
            ? "border-indigo-500 bg-indigo-50/30 scale-[1.01]" 
            : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50/80"
        }`}
      >
        <input 
          id="result-file-input"
          type="file" 
          multiple 
          accept=".json"
          onChange={handleFileInput} 
          className="hidden" 
        />
        <label htmlFor="result-file-input" className="cursor-pointer group flex flex-col items-center justify-center">
          <div className="p-3.5 rounded-lg bg-white shadow-xs border border-slate-200 group-hover:scale-105 transition-transform mb-3">
            <FileUp className="w-6 h-6 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Drag & Drop student JSON results here</span>
          <span className="text-xs text-slate-400 mt-1">Or click to select files from your computer</span>
        </label>
      </div>

      {/* Main Results Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
          <div className="flex items-center space-x-3">
            <h3 className="font-bold text-slate-800 text-sm">Graded Student Results</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
              {filteredResults.length} shown
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="results-search"
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 bg-white text-slate-800 transition-colors"
              />
            </div>

            {/* Filter */}
            <select
              id="results-filter"
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="all">All Submissions</option>
              <option value="passed">Score ≥ 50%</option>
              <option value="failed">Score &lt; 50%</option>
              <option value="cheated">Integrity Flagged</option>
              <option value="genuine">Verified Authentic</option>
            </select>

            {/* Actions */}
            {results.length > 0 && (
              <>
                <button
                  id="btn-export-csv"
                  onClick={exportAllToCSV}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  id="btn-clear-results"
                  onClick={clearAllResults}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table/List */}
        {filteredResults.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-semibold">No student results match the filter.</p>
            <p className="text-slate-400 text-xs mt-1">Import results JSON from students to build the database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/20">
                  <th className="py-4 px-6">Verification</th>
                  <th className="py-4 px-6">Student Info</th>
                  <th className="py-4 px-6">Exam Title</th>
                  <th className="py-4 px-6 text-center">Score</th>
                  <th className="py-4 px-6 text-center">Percentage</th>
                  <th className="py-4 px-6 text-center">Focus Violations</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-sm text-slate-800">
                {filteredResults.map((result) => {
                  const isGenuine = verifyResultHash(result);
                  return (
                    <tr 
                      key={result.id} 
                      onClick={() => setSelectedResult(result)}
                      className="hover:bg-indigo-50/15 transition-colors cursor-pointer group"
                    >
                      {/* Integrity Verification Check */}
                      <td className="py-4 px-6">
                        {isGenuine ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/55 shadow-xs" title="Cryptographically verified original score. No tampering detected.">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/55 shadow-xs animate-pulse" title="Security hash mismatch! This score certificate may have been modified by the student.">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Tampered!</span>
                          </span>
                        )}
                      </td>
                      
                      {/* Student Info */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{result.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {result.studentId || "N/A"}</div>
                      </td>

                      {/* Exam Title */}
                      <td className="py-4 px-6 max-w-[200px] truncate" title={result.examTitle}>
                        <div className="truncate text-slate-700 font-medium">{result.examTitle}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{result.submittedAt}</div>
                      </td>

                      {/* Correct / Max Score */}
                      <td className="py-4 px-6 text-center font-mono font-semibold">
                        <span className="text-indigo-600">{result.score}</span>
                        <span className="text-slate-300 mx-0.5">/</span>
                        <span className="text-slate-500">{result.maxScore}</span>
                      </td>

                      {/* Percentage */}
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex items-center justify-center font-bold text-slate-800">
                          {result.percentage}%
                        </div>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto mt-1">
                          <div 
                            className={`h-full rounded-full ${
                              result.percentage >= 80 ? "bg-emerald-500" :
                              result.percentage >= 50 ? "bg-indigo-500" : "bg-rose-500"
                            }`} 
                            style={{ width: `${result.percentage}%` }}
                          />
                        </div>
                      </td>

                      {/* Focus Violations */}
                      <td className="py-4 px-6 text-center">
                        {result.cheated ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                            Auto-Submitted
                          </span>
                        ) : result.focusWarnings > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            result.focusWarnings >= 3 ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-slate-100 text-slate-700"
                          }`}>
                            {result.focusWarnings} Warnings
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        {result.percentage >= 50 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Delete / Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedResult(result)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Inspect Exam Sheet"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => deleteResult(result.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remove Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Answer Sheet Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h4 className="text-base font-bold text-slate-900">{selectedResult.studentName}'s Scorecard</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedResult.studentId || "No ID"} • Exam: {selectedResult.examTitle}</p>
              </div>
              <button 
                onClick={() => setSelectedResult(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Final Grade</p>
                  <p className="text-lg font-extrabold text-indigo-600 mt-1">{selectedResult.score} / {selectedResult.maxScore}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Percentage</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{selectedResult.percentage}%</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tab Focus Warnings</p>
                  <p className={`text-lg font-extrabold mt-1 ${selectedResult.focusWarnings > 1 ? "text-amber-600" : "text-slate-600"}`}>
                    {selectedResult.focusWarnings}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Integrity Check</p>
                  <p className="text-lg font-bold mt-1">
                    {verifyResultHash(selectedResult) ? (
                      <span className="text-emerald-600 inline-flex items-center font-bold text-xs">
                        <ShieldCheck className="w-3.5 h-3.5 mr-0.5" />
                        Valid
                      </span>
                    ) : (
                      <span className="text-rose-600 inline-flex items-center font-bold text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 mr-0.5" />
                        Tampered
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Integrity Warning */}
              {selectedResult.cheated && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg flex items-start space-x-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Security Action Triggered:</span> This student exceeded the allowable window blur focus limit (or closed/switched browser tabs), resulting in an automatic submission of their exam to secure integrity.
                  </div>
                </div>
              )}

              {/* Detailed scorecard breakdowns */}
              <div className="space-y-4">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Score Composition</h5>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-lg">
                    <p className="text-[9px] font-bold uppercase text-emerald-700">Correct (+1)</p>
                    <p className="text-lg font-extrabold text-emerald-800 mt-0.5">{selectedResult.correctCount}</p>
                  </div>
                  <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-lg">
                    <p className="text-[9px] font-bold uppercase text-rose-700">Incorrect (-0.5)</p>
                    <p className="text-lg font-extrabold text-rose-800 mt-0.5">{selectedResult.incorrectCount}</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-[9px] font-bold uppercase text-slate-500">Unanswered (0)</p>
                    <p className="text-lg font-extrabold text-slate-700 mt-0.5">{selectedResult.unansweredCount}</p>
                  </div>
                </div>
              </div>

              {/* Hash Verification Details */}
              <div className="p-4 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1.5 bg-slate-50/30">
                <div className="font-bold text-slate-700 flex items-center mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 mr-1" />
                  Cryptographic Integrity Token
                </div>
                <div className="font-mono text-[10px] bg-white p-2.5 rounded-lg border border-slate-200 break-all select-all text-slate-600">
                  {selectedResult.hash}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  This signature guarantees that the grade certificate cannot be doctored. In case of disputes, ask the student to send their downloaded certificate JSON file and import it here to check for authenticity.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50/40 text-right">
              <button 
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
