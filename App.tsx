import React, { useState, useRef } from 'react';
import { Hero } from './components/Hero';
import { ResultView } from './components/ResultView';
import { FileUpload, StudyPlan, AppState } from './types';
import { aiService } from './services/groqService'; // Switched to Groq service
import { UploadCloud, X, File as FileIcon, AlertTriangle, BookText, Sparkles } from 'lucide-react';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const App: React.FC = () => {
  const [syllabus, setSyllabus] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles: FileUpload[] = [];
      let error = '';

      selectedFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          error = `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`;
        } else {
          validFiles.push({
            file,
            id: Math.random().toString(36).substring(7),
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          });
        }
      });

      if (error) setErrorMsg(error);
      else setErrorMsg(''); // Clear previous errors if successful

      setFiles(prev => [...prev, ...validFiles]);
    }
    
    // Reset input to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      // Calls the generic interface method
      const result = await aiService.generateStudyPlan(syllabus, rawFiles);
      setStudyPlan(result);
      setAppState(AppState.SUCCESS);
    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
      setErrorMsg("Failed to analyze documents. Please ensure files are valid and try again.");
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setStudyPlan(null);
    setFiles([]);
    setSyllabus('');
    setErrorMsg('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Hero />

      <main className="grow" style={{ padding: '2.5rem 0' }}>
        <div className="container">
          
          {appState === AppState.IDLE && (
            <div className="grid grid-cols-1 lg-grid-cols-12">
              {/* Left Column: Syllabus Input */}
              <div className="lg-col-span-7">
                <div className="card" style={{ height: '100%' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
                     <h2 style={{ display: 'flex', alignItems: 'center', fontSize: '1.125rem' }}>
                        <BookText size={20} style={{ marginRight: '0.5rem', color: 'var(--color-primary)' }} />
                        Syllabus
                     </h2>
                     <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Required</span>
                  </div>
                  <textarea
                    value={syllabus}
                    onChange={(e) => setSyllabus(e.target.value)}
                    placeholder="Paste your syllabus chapters, topics, and sub-topics here..."
                    className="input-textarea"
                  />
                  <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                    Tip: Be as detailed as possible for better mapping.
                  </p>
                </div>
              </div>

              {/* Right Column: File Upload */}
              <div className="lg-col-span-5">
                 <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
                      <h2 style={{ display: 'flex', alignItems: 'center', fontSize: '1.125rem' }}>
                          <UploadCloud size={20} style={{ marginRight: '0.5rem', color: 'var(--color-primary)' }} />
                          Question Papers
                      </h2>
                      <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Required</span>
                    </div>

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="upload-area grow"
                    >
                      <div style={{ width: '3rem', height: '3rem', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                        <UploadCloud size={24} color="var(--color-primary)" />
                      </div>
                      <p className="font-medium">Click to upload files</p>
                      <p className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>PDF, PNG, JPG (Max {MAX_FILE_SIZE_MB}MB)</p>
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
                      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h3 className="text-xs text-muted" style={{ textTransform: 'uppercase' }}>Uploaded Files ({files.length})</h3>
                        <div style={{ maxHeight: '12rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {files.map(f => (
                            <div key={f.id} className="file-item">
                              <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                {f.previewUrl ? (
                                  <img src={f.previewUrl} alt="preview" className="file-preview" />
                                ) : (
                                  <div style={{ width: '2rem', height: '2rem', background: 'var(--color-danger-bg)', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.75rem', flexShrink: 0 }}>
                                    <FileIcon size={16} color="var(--color-danger)" />
                                  </div>
                                )}
                                <span className="text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{f.file.name}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                                className="icon-btn"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>

              {/* Action Bar */}
              <div className="lg-col-span-12">
                 {errorMsg && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-danger-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div className="flex items-center">
                         <AlertTriangle size={20} style={{ marginRight: '0.5rem' }} />
                         {errorMsg}
                       </div>
                       <button onClick={() => setErrorMsg('')} className="icon-btn" style={{ marginLeft: '1rem' }}><X size={18} /></button>
                    </div>
                 )}
                 <button
                    onClick={handleGenerate}
                    disabled={!syllabus || files.length === 0}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }}
                 >
                    Generate Question Bank & Plan
                 </button>
              </div>
            </div>
          )}

          {appState === AppState.ANALYZING && (
             <div className="flex flex-col items-center justify-center" style={{ padding: '5rem 0' }}>
                <div style={{ position: 'relative' }}>
                   <div className="spinner"></div>
                   <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                      <Sparkles size={24} color="var(--color-primary)" />
                   </div>
                </div>
                <h3 style={{ marginTop: '2rem', fontSize: '1.25rem' }}>Analyzing Documents...</h3>
                <p className="text-muted text-center" style={{ marginTop: '0.5rem', maxWidth: '28rem' }}>
                   {aiService.name} is scanning your past papers, cross-referencing with the syllabus, and extracting key questions. This may take a minute.
                </p>
             </div>
          )}

          {appState === AppState.SUCCESS && studyPlan && (
             <ResultView plan={studyPlan} onReset={resetApp} />
          )}

          {appState === AppState.ERROR && (
             <div className="flex flex-col items-center justify-center text-center" style={{ padding: '5rem 0' }}>
                <div style={{ width: '5rem', height: '5rem', background: 'var(--color-danger-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                   <AlertTriangle size={40} color="var(--color-danger)" />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Analysis Failed</h3>
                <p className="text-muted" style={{ maxWidth: '28rem', marginBottom: '2rem' }}>
                   {errorMsg || "We couldn't process the files. Please make sure the API key is valid and the files are legible."}
                </p>
                <button 
                  onClick={() => setAppState(AppState.IDLE)}
                  className="btn btn-secondary"
                >
                  Try Again
                </button>
             </div>
          )}

        </div>
      </main>

      <footer style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '1.5rem 0' }}>
         <div className="container text-center text-sm text-muted">
            Built with React & {aiService.name}
         </div>
      </footer>
    </div>
  );
};

export default App;