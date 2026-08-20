import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText, CheckCircle, XCircle, Clock, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const queryClient = new QueryClient();

function AppContent() {
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['chat_sessions'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/chat/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    }
  });

  const handleNewChat = async () => {
    setActiveTab('chat');
    setActiveSessionId(null);
  };

  const handleSelectSession = (id: string) => {
    setActiveTab('chat');
    setActiveSessionId(id);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col h-full">
        <div className="p-6 shrink-0">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
            DocMind
          </h1>
        </div>
        
        <nav className="px-4 space-y-2 shrink-0">
          <button 
            onClick={() => setActiveTab('documents')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
              activeTab === 'documents' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileText size={18} />
            Documents
          </button>
          
          <button 
            onClick={handleNewChat}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
              activeTab === 'chat' && !activeSessionId
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Send size={18} />
            New Chat
          </button>
        </nav>

        <div className="flex-1 overflow-y-auto mt-6 px-4 pb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">History</h3>
          <div className="space-y-1">
            {sessions.map((session: any) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm truncate transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-slate-800 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {session.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white/50 backdrop-blur-3xl rounded-l-3xl shadow-2xl relative z-10 border-l border-white/20">
        {activeTab === 'documents' ? <DocumentsView /> : <ChatView sessionId={activeSessionId} onSessionCreated={(id) => { setActiveSessionId(id); refetchSessions(); }} />}
      </div>
    </div>
  );
}

// Documents View
function DocumentsView() {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/documents');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 3000 // Poll for status updates
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: str) => {
      await fetch(`http://localhost:8000/api/documents/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const handleUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      alert("Please upload a valid PDF file.");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('http://localhost:8000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) {
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-10 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Documents</h2>
      </div>

      {/* Upload Zone */}
      <div 
        className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          handleUpload(file);
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
            {uploading ? <Loader2 className="animate-spin w-8 h-8" /> : <Upload className="w-8 h-8" />}
          </div>
          <div>
            <p className="text-lg font-medium text-slate-700">Drag & drop your PDF here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse from your computer</p>
          </div>
          <input 
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            id="file-upload"
            onChange={(e) => {
              if (e.target.files?.[0]) handleUpload(e.target.files[0]);
            }}
          />
          <label 
            htmlFor="file-upload"
            className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shadow-lg shadow-slate-200"
          >
            Select PDF
          </label>
        </div>
      </div>

      {/* Document List */}
      <div className="mt-10 flex-1 overflow-auto">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Uploaded Files</h3>
        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center p-10 text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {documents.map((doc: any) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-shadow group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <FileText />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">{doc.original_filename}</h4>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>{doc.page_count} pages</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  {/* Status Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    doc.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                    doc.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {doc.status === 'READY' && <CheckCircle className="w-4 h-4" />}
                    {doc.status === 'FAILED' && <XCircle className="w-4 h-4" />}
                    {['UPLOADING', 'PROCESSING'].includes(doc.status) && <Clock className="w-4 h-4" />}
                    {doc.status}
                  </div>
                  
                  <button 
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete document"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Chat View
function ChatView({ sessionId, onSessionCreated }: { sessionId: string | null, onSessionCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string, sources?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (sessionId) {
      setLoading(true);
      fetch(`http://localhost:8000/api/chat/sessions/${sessionId}/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.map((m: any) => ({
            role: m.role,
            content: m.content,
            sources: m.sources
          })));
        })
        .finally(() => setLoading(false));
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        // Create new session
        const sessionRes = await fetch('http://localhost:8000/api/chat/sessions', {
          method: 'POST'
        });
        const sessionData = await sessionRes.json();
        currentSessionId = sessionData.id;
        onSessionCreated(sessionData.id);
      }

      const res = await fetch(`http://localhost:8000/api/chat/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, document_ids: null }) // Search all docs for now
      });
      
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources
      }]);
      queryClient.invalidateQueries({ queryKey: ['chat_sessions'] });
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, there was an error processing your request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800">Assistant</h2>
        <p className="text-slate-500 text-sm">Ask questions based on your uploaded documents</p>
      </div>
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            Send a message to start the conversation...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-5 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-bl-none'
              }`}>
                <div className="prose prose-sm max-w-none dark:prose-invert break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((src: any, j: number) => (
                        <div key={j} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 flex items-center gap-1 shadow-sm">
                          <FileText className="w-3 h-3" />
                          <span>{src.document_name} (Page {src.page_number})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-none p-5 flex items-center gap-2 text-slate-500">
              <Loader2 className="animate-spin w-4 h-4" /> Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="flex gap-3 relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question about your documents..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-800 placeholder-slate-400"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white rounded-xl px-6 flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
