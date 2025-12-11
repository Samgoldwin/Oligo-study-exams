import React, { useState, useRef } from 'react';
import { Hero } from './components/Hero';
import { ResultView } from './components/ResultView';
import { FileUpload, StudyPlan, AppState } from './types';
import { generateStudyPlan } from './services/geminiService';
import { UploadCloud, X, File as FileIcon, Loader2, AlertTriangle, BookText, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [syllabus, setSyllabus] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: FileUpload[] = Array.from(e.target.files).map((item) => {
        const file = item as File;
        return {
          file,
          id: Math.random().toString(36).substring(7),
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        };
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleGenerate = async () => {
    if (!syllabus.trim()) {
      setErrorMsg("Please enter the syllabus.");
      return;
    }
    if (files.length === 0) {
      setErrorMsg("Please upload at least one previous year question paper.");
      return;
    }

    setAppState(AppState.ANALYZING);
    setErrorMsg('');

    try {
      const rawFiles = files.map(f => f.file);
      const result = await generateStudyPlan(syllabus, rawFiles);
      setStudyPlan(result);
      setAppState(AppState.SUCCESS);
    } catch (err) {
      setAppState(AppState.ERROR);
      setErrorMsg("Failed to analyze documents. Please ensure files are valid (PDF/Images) and try again.");
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setStudyPlan(null);
    setFiles([]);
    setSyllabus('');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Hero />

      <main className="flex-grow bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {appState === AppState.IDLE && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Syllabus Input */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center">
                        <BookText className="w-5 h-5 mr-2 text-primary-500" />
                        Syllabus
                     </h2>
                     <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Required</span>
                  </div>
                  <textarea
                    value={syllabus}
                    onChange={(e) => setSyllabus(e.target.value)}
                    placeholder="Paste your syllabus chapters, topics, and sub-topics here..."
                    className="w-full h-64 p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none transition-all"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Tip: Be as detailed as possible for better mapping.
                  </p>
                </div>
              </div>

              {/* Right Column: File Upload */}
              <div className="lg:col-span-5 space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center">
                          <UploadCloud className="w-5 h-5 mr-2 text-primary-500" />
                          Question Papers
                      </h2>
                      <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Required</span>
                    </div>

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-all group flex-grow min-h-[200px]"
                    >
                      <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6 text-primary-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900">Click to upload files</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG supported</p>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        multiple 
                        accept="application/pdf,image/png,image/jpeg,image/jpg"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase">Uploaded Files ({files.length})</h3>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                          {files.map(f => (
                            <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group hover:border-primary-200 transition-colors">
                              <div className="flex items-center overflow-hidden">
                                {f.previewUrl ? (
                                  <img src={f.previewUrl} alt="preview" className="w-8 h-8 object-cover rounded mr-3" />
                                ) : (
                                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mr-3 shrink-0">
                                    <FileIcon className="w-4 h-4 text-red-500" />
                                  </div>
                                )}
                                <span className="text-sm text-slate-700 truncate font-medium">{f.file.name}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                                className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>

              {/* Action Bar */}
              <div className="lg:col-span-12">
                 {errorMsg && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-700">
                       <AlertTriangle className="w-5 h-5 mr-2" />
                       {errorMsg}
                    </div>
                 )}
                 <button
                    onClick={handleGenerate}
                    disabled={!syllabus || files.length === 0}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/30 transition-all transform hover:-translate-y-0.5"
                 >
                    Generate Question Bank & Plan
                 </button>
              </div>
            </div>
          )}

          {appState === AppState.ANALYZING && (
             <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                   <div className="w-24 h-24 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                   <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <Sparkles className="w-8 h-8 text-primary-600" />
                   </div>
                </div>
                <h3 className="mt-8 text-xl font-bold text-slate-900">Analyzing Documents...</h3>
                <p className="text-slate-500 mt-2 max-w-md text-center">
                   Gemini is scanning your past papers, cross-referencing with the syllabus, and extracting key questions. This may take a minute.
                </p>
             </div>
          )}

          {appState === AppState.SUCCESS && studyPlan && (
             <ResultView plan={studyPlan} onReset={resetApp} />
          )}

          {appState === AppState.ERROR && (
             <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                   <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Analysis Failed</h3>
                <p className="text-slate-600 max-w-md mb-8">
                   {errorMsg || "We couldn't process the files. Please make sure the API key is valid and the files are legible."}
                </p>
                <button 
                  onClick={() => setAppState(AppState.IDLE)}
                  className="px-6 py-3 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Try Again
                </button>
             </div>
          )}

        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6">
         <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm">
            Built with React, Tailwind & Google Gemini API
         </div>
      </footer>
    </div>
  );
};

export default App;