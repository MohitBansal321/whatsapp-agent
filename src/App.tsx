/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Users, 
  Send, 
  Bot, 
  User, 
  Languages, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Search,
  ArrowLeft,
  LogOut,
  BarChart3,
  TrendingUp,
  Zap,
  DollarSign,
  ShieldCheck,
  Upload,
  Table,
  X,
  FileDown,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  doc,
  getDocs,
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  GoogleAuthProvider,
  User as FirebaseUser 
} from 'firebase/auth';
import { db, auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

// Types
interface Message {
  id: string;
  text: string;
  sender: 'agent' | 'user';
  timestamp: Date;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  loanType: string;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  lastMessage?: string;
}

interface AgentConfig {
  companyName: string;
  systemPrompt: string;
  knowledgeBase: string;
  primaryLanguage: string;
  tone: 'professional' | 'friendly' | 'urgent' | 'empathetic';
  logoUrl?: string;
  whatsappNumber?: string;
}

interface AnalyticsData {
  totalLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgResponseTime: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'admin' | 'leads' | 'analytics'>('leads');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'google' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sheetId, setSheetId] = useState('');
  
  const [config, setConfig] = useState<AgentConfig>({
    companyName: 'Bharat Loans',
    systemPrompt: `You are a professional and friendly loan conversion agent. 
Your goal is to help potential leads understand their loan options and convert them into applicants.
Be polite, helpful, and persuasive. 
CRITICAL: If the user asks a question not covered in the Knowledge Base, say "I don't have that information. Let me connect you to a human representative."
CRITICAL: Auto-detect the user's language (including Hinglish) and reply in the same language.`,
    knowledgeBase: `Personal Loan: 10.5% - 18% APR
Home Loan: 8.5% - 12% APR
Business Loan: 12% - 22% APR
Processing Fee: 1-2%
Tenure: 12 to 60 months
Eligibility: Min salary ₹25,000/month, Age 21-60`,
    primaryLanguage: 'English',
    tone: 'friendly',
    whatsappNumber: ''
  });

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalLeads: 0,
    contactedLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    avgResponseTime: '2.4s'
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  // Auth setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAuthError(null);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Fetch Companies
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'companies'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const companiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (companiesData.length === 0) {
        // Create default company if none exist
        const defaultCompany = {
          name: 'Bharat Loans',
          ownerId: user.uid,
          systemPrompt: `You are a professional and friendly loan conversion agent. 
Your goal is to help potential leads understand their loan options and convert them into applicants.
Be polite, helpful, and persuasive. 
CRITICAL: If the user asks a question not covered in the Knowledge Base, say "I don't have that information. Let me connect you to a human representative."
CRITICAL: Auto-detect the user's language (including Hinglish) and reply in the same language.`,
          knowledgeBase: `Personal Loan: 10.5% - 18% APR
Home Loan: 8.5% - 12% APR
Business Loan: 12% - 22% APR
Processing Fee: 1-2%
Tenure: 12 to 60 months
Eligibility: Min salary ₹25,000/month, Age 21-60`,
          tone: 'friendly',
          whatsappNumber: '',
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'companies'), defaultCompany);
        setCompanies([{ id: docRef.id, ...defaultCompany }]);
        setSelectedCompanyId(docRef.id);
        setConfig(defaultCompany as any);
      } else {
        setCompanies(companiesData);
        if (!selectedCompanyId || !companiesData.find(c => c.id === selectedCompanyId)) {
          setSelectedCompanyId(companiesData[0].id);
          setConfig(companiesData[0] as any);
        } else {
          const current = companiesData.find(c => c.id === selectedCompanyId);
          if (current) setConfig(current as any);
        }
      }
    }, (error) => {
      console.error("Firestore Error (Companies):", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Leads
  useEffect(() => {
    if (!user || !selectedCompanyId) return;
    
    const q = query(collection(db, 'leads'), where('companyId', '==', selectedCompanyId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
      
      // Update Analytics
      const total = leadsData.length;
      const contacted = leadsData.filter(l => l.status === 'contacted').length;
      const converted = leadsData.filter(l => l.status === 'converted').length;
      setAnalytics(prev => ({
        ...prev,
        totalLeads: total,
        contactedLeads: contacted,
        convertedLeads: converted,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0
      }));
    }, (error) => {
      console.error("Firestore Error (Leads):", error);
    });

    return () => unsubscribe();
  }, [user, selectedCompanyId]);

  const seedDemoLeads = async () => {
    if (!user || isSeeding || !selectedCompanyId) return;
    setIsSeeding(true);
    
    const initialLeads = [
      { companyId: selectedCompanyId, name: 'Rahul Sharma', phone: '+91 98765 43210', loanType: 'Personal Loan', status: 'converted', lastMessage: 'Yes, proceed with application', createdAt: serverTimestamp() },
      { companyId: selectedCompanyId, name: 'Priya Patel', phone: '+91 87654 32109', loanType: 'Home Loan', status: 'contacted', lastMessage: 'Interested in rates', createdAt: serverTimestamp() },
      { companyId: selectedCompanyId, name: 'Amit Singh', phone: '+91 76543 21098', loanType: 'Business Loan', status: 'new', createdAt: serverTimestamp() },
      { companyId: selectedCompanyId, name: 'Suresh Kumar', phone: '+91 99887 76655', loanType: 'Personal Loan', status: 'converted', lastMessage: 'Documents sent', createdAt: serverTimestamp() },
      { companyId: selectedCompanyId, name: 'Anjali Gupta', phone: '+91 88776 65544', loanType: 'Home Loan', status: 'contacted', lastMessage: 'Call me tomorrow', createdAt: serverTimestamp() },
    ];
    
    try {
      console.log("Seeding leads...");
      for (const l of initialLeads) {
        const docRef = await addDoc(collection(db, 'leads'), l);
        if (l.status !== 'new') {
          await addDoc(collection(db, `leads/${docRef.id}/messages`), {
            text: `Namaste ${l.name}! I am your assistant from ${config.companyName}. I see you are interested in a ${l.loanType}. How can I help you today?`,
            sender: 'agent',
            timestamp: serverTimestamp()
          });
        }
      }
      alert('Demo leads seeded successfully with diverse statuses!');
    } catch (error) {
      console.error("Error seeding leads:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCompanyId) return;

    setIsUploading(true);
    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('customer'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
        const loanTypeIdx = headers.findIndex(h => h.includes('loan') || h.includes('type'));

        if (nameIdx === -1 || phoneIdx === -1) {
          throw new Error('CSV must have at least "name" and "phone" columns.');
        }

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (cols.length < 2) continue;

          await addDoc(collection(db, 'leads'), {
            companyId: selectedCompanyId,
            name: cols[nameIdx],
            phone: cols[phoneIdx],
            loanType: loanTypeIdx !== -1 ? cols[loanTypeIdx] : 'Personal Loan',
            status: 'new',
            createdAt: serverTimestamp()
          });
        }
        alert('CSV leads imported successfully!');
      } else if (file.name.endsWith('.pdf')) {
        // Send to backend for PDF parsing
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Failed to parse PDF');
        
        const data = await response.json();
        if (data.leads && Array.isArray(data.leads)) {
          for (const l of data.leads) {
            await addDoc(collection(db, 'leads'), {
              ...l,
              companyId: selectedCompanyId,
              status: 'new',
              createdAt: serverTimestamp()
            });
          }
          alert(`Imported ${data.leads.length} leads from PDF!`);
        }
      } else {
        alert('Please upload a .csv or .pdf file.');
      }
      setIsAddLeadModalOpen(false);
    } catch (error: any) {
      console.error("Error uploading leads:", error);
      alert(error.message || "Failed to upload leads.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoogleSheetsSync = async () => {
    if (!sheetId || !user || !selectedCompanyId) return;
    setIsUploading(true);
    try {
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId })
      });

      if (!response.ok) throw new Error('Failed to sync Google Sheets');
      
      const data = await response.json();
      if (data.leads && Array.isArray(data.leads)) {
        for (const l of data.leads) {
          await addDoc(collection(db, 'leads'), {
            ...l,
            companyId: selectedCompanyId,
            status: 'new',
            createdAt: serverTimestamp()
          });
        }
        alert(`Synced ${data.leads.length} leads from Google Sheets!`);
      }
      setIsAddLeadModalOpen(false);
    } catch (error: any) {
      console.error("Error syncing Google Sheets:", error);
      alert(error.message || "Failed to sync Google Sheets.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-kb', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to parse Knowledge Base PDF');
      
      const data = await response.json();
      if (data.text) {
        setConfig(prev => ({
          ...prev,
          knowledgeBase: prev.knowledgeBase + '\n\n--- EXTRACTED FROM ' + file.name + ' ---\n' + data.text
        }));
        alert('Knowledge Base updated successfully from PDF!');
      }
    } catch (error: any) {
      console.error("Error uploading KB:", error);
      alert(error.message || "Failed to upload Knowledge Base.");
    }
  };

  // Fetch Messages for selected lead
  useEffect(() => {
    if (!selectedLead || !user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `leads/${selectedLead.id}/messages`), 
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          sender: data.sender,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedLead, user]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    if (!selectedLead || !user) return;

    setIsTyping(true);
    
    // Add a placeholder message for the user's voice note
    await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
      text: "🎤 Voice Note Sent",
      sender: 'user',
      timestamp: serverTimestamp()
    });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-note.webm');
      formData.append('history', JSON.stringify(messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }))));
      formData.append('config', JSON.stringify(config));

      const response = await fetch('/api/chat-audio', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const agentText = data.text || "I'm sorry, I couldn't process that audio.";

      await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
        text: agentText,
        sender: 'agent',
        timestamp: serverTimestamp()
      });

    } catch (error: any) {
      console.error("Error calling Backend Audio AI:", error);
      await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
        text: `Error processing audio: ${error.message}`,
        sender: 'agent',
        timestamp: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedLead || !user) return;

    const text = inputText;
    setInputText('');
    
    // 1. Save user message to Firestore
    await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
      text,
      sender: 'user',
      timestamp: serverTimestamp()
    });

    // Update lead's last message
    await updateDoc(doc(db, 'leads', selectedLead.id), {
      lastMessage: text,
      status: 'contacted'
    });

    setIsTyping(true);

    try {
      // 2. Prepare conversation history for memory
      // Filter out error messages and the current message (which is sent separately)
      const filteredMessages = messages.filter(m => 
        !m.text.startsWith("Error connecting to AI:") && 
        m.text !== text
      );

      // Ensure roles alternate (user, model, user, model)
      // If there are consecutive messages from the same sender, combine them
      const history: any[] = [];
      filteredMessages.forEach(m => {
        const role = m.sender === 'agent' ? 'model' : 'user';
        if (history.length > 0 && history[history.length - 1].role === role) {
          history[history.length - 1].parts[0].text += "\n" + m.text;
        } else {
          history.push({
            role,
            parts: [{ text: m.text }]
          });
        }
      });

      // Call backend API instead of using SDK directly
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history,
          config: {
            companyName: config.companyName,
            systemPrompt: config.systemPrompt,
            knowledgeBase: config.knowledgeBase,
            tone: config.tone
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText || 'Unknown Server Error');
      }

      const data = await response.json();
      const agentText = data.text || "I'm sorry, I couldn't process that.";

      // 3. Save agent response to Firestore
      await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
        text: agentText,
        sender: 'agent',
        timestamp: serverTimestamp()
      });

    } catch (error: any) {
      console.error("Error calling Backend AI:", error);
      
      let displayError = error.message || "Unknown error";
      if (displayError.includes("API key not valid")) {
        displayError = "The AI Agent's API key is invalid. Please ensure you have set 'GEMINI_API_KEY' in the AI Studio Secrets panel with a valid key from https://aistudio.google.com/app/apikey";
      } else if (displayError.includes("not configured")) {
        displayError = "The AI Agent's API key is not configured. Please add 'GEMINI_API_KEY' to your AI Studio Secrets.";
      }

      await addDoc(collection(db, `leads/${selectedLead.id}/messages`), {
        text: `Error connecting to AI: ${displayError}`,
        sender: 'agent',
        timestamp: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
    }
  };

  const startOutreach = async (lead: Lead) => {
    console.log("Starting outreach for lead:", lead.name);
    setSelectedLead(lead);
    setActiveTab('chat');
    
    // Check if there are already messages
    const q = query(collection(db, `leads/${lead.id}/messages`), orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Initial greeting if no history
      await addDoc(collection(db, `leads/${lead.id}/messages`), {
        text: `Namaste ${lead.name}! I am your assistant from ${config.companyName}. I see you are interested in a ${lead.loanType}. How can I help you today?`,
        sender: 'agent',
        timestamp: serverTimestamp()
      });
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5] font-sans text-gray-900 overflow-hidden relative">
      {!user && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-xl mb-8">
            <MessageSquare size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bharat Loans Agent</h1>
          <p className="text-gray-500 mb-8 text-center max-w-xs">
            Secure dashboard for managing loan leads and automated WhatsApp outreach.
          </p>
          
          <button 
            onClick={handleLogin}
            className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-semibold flex items-center gap-3 hover:bg-gray-50 transition-all shadow-sm hover:shadow-md"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>

          {authError && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 max-w-sm text-center">
              {authError}
            </div>
          )}
          
          <p className="mt-12 text-xs text-gray-400">
            Authorized personnel only. All activities are logged.
          </p>
        </div>
      )}
      
      {/* Sidebar Navigation */}
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-8 gap-8 shadow-sm z-10">
        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white shadow-lg mb-4 cursor-pointer relative group">
          <MessageSquare size={28} />
          
          {/* Company Switcher Dropdown */}
          <div className="absolute left-16 top-0 bg-white border border-gray-200 rounded-xl shadow-xl w-48 hidden group-hover:block z-50 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
              Select Company
            </div>
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCompanyId(c.id)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-green-50 transition-colors ${selectedCompanyId === c.id ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700'}`}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={async () => {
                const name = prompt("Enter new company name:");
                if (name && user) {
                  const newCompany = {
                    name,
                    ownerId: user.uid,
                    systemPrompt: `You are a professional and friendly loan conversion agent. 
Your goal is to help potential leads understand their loan options and convert them into applicants.
Be polite, helpful, and persuasive. 
CRITICAL: If the user asks a question not covered in the Knowledge Base, say "I don't have that information. Let me connect you to a human representative."
CRITICAL: Auto-detect the user's language (including Hinglish) and reply in the same language.`,
                    knowledgeBase: `Standard loan products and interest rates apply.`,
                    tone: 'friendly',
                    whatsappNumber: '',
                    createdAt: serverTimestamp()
                  };
                  const docRef = await addDoc(collection(db, 'companies'), newCompany);
                  setSelectedCompanyId(docRef.id);
                }
              }}
              className="w-full text-left px-4 py-3 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors border-t border-gray-100 flex items-center gap-2"
            >
              <Plus size={16} /> Add Company
            </button>
          </div>
        </div>
        
        <nav className="flex flex-col gap-6">
          <button 
            onClick={() => { console.log("Switching to chat"); setActiveTab('chat'); }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <MessageSquare size={24} />
          </button>
          <button 
            onClick={() => { console.log("Switching to leads"); setActiveTab('leads'); }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'leads' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <Users size={24} />
          </button>
          <button 
            onClick={() => { console.log("Switching to admin"); setActiveTab('admin'); }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'admin' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <Settings size={24} />
          </button>
          <button 
            onClick={() => { console.log("Switching to analytics"); setActiveTab('analytics'); }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <BarChart3 size={24} />
          </button>
        </nav>

        <div className="mt-auto mb-4 flex flex-col items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`} title={user ? 'Connected' : 'Disconnected'} />
          {user && (
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full bg-[#efeae2]"
            >
              {/* WhatsApp Header */}
              <header className="bg-[#f0f2f5] px-6 py-3 flex items-center justify-between border-b border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 overflow-hidden">
                    {selectedLead ? (
                      <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        {selectedLead.name.charAt(0)}
                      </div>
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800">
                      {selectedLead ? selectedLead.name : 'Select a Lead to Chat'}
                    </h2>
                    <p className="text-xs text-green-600 font-medium">
                      {selectedLead ? 'Online' : 'Waiting for outreach'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-gray-500">
                  <Search size={20} className="cursor-pointer" />
                  <MoreVertical size={20} className="cursor-pointer" />
                </div>
              </header>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {messages.length === 0 && !selectedLead && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                    <div className="p-6 bg-white rounded-full shadow-sm">
                      <Bot size={48} className="text-green-500" />
                    </div>
                    <p className="text-lg font-medium">WhatsApp Agent Simulator</p>
                    <p className="text-sm max-w-xs text-center">Go to the Leads tab to start a conversation with a potential customer.</p>
                  </div>
                )}
                
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`flex ${msg.sender === 'agent' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[70%] p-3 rounded-lg shadow-sm relative ${
                      msg.sender === 'agent' 
                        ? 'bg-white text-gray-800 rounded-tl-none' 
                        : 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <span className="text-[10px] text-gray-400 block text-right mt-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-lg shadow-sm rounded-tl-none">
                      <div className="flex gap-1">
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-gray-300 rounded-full" />
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-gray-300 rounded-full" />
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-gray-300 rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="bg-[#f0f2f5] p-4 flex items-center gap-4 border-t border-gray-200">
                <Smile size={24} className="text-gray-500 cursor-pointer" />
                <Paperclip size={24} className="text-gray-500 cursor-pointer" />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message"
                    disabled={!selectedLead}
                    className="w-full py-2 px-4 bg-white rounded-lg border-none focus:ring-0 text-sm disabled:opacity-50"
                  />
                </div>
                {inputText.trim() ? (
                  <button 
                    onClick={handleSendMessage}
                    className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-green-700 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button 
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-200'}`}
                  >
                    <Mic size={24} />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'leads' && (
            <motion.div 
              key="leads"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-10 flex-1 overflow-y-auto bg-white"
            >
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
                    <p className="text-gray-500 mt-1">Manage and initiate outreach to potential loan applicants.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={seedDemoLeads}
                      disabled={!user || isSeeding}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm ${
                        isSeeding ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      <Plus size={20} className={isSeeding ? 'animate-spin' : ''} />
                      {isSeeding ? 'Seeding...' : 'Seed Demo Leads'}
                    </button>
                    <button 
                      onClick={() => setIsAddLeadModalOpen(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <Plus size={20} />
                      Add Lead
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {leads.map((lead) => (
                    <div key={lead.id} className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center justify-between hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                          {lead.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{lead.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Phone size={14} /> {lead.phone}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium">{lead.loanType}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            lead.status === 'new' ? 'bg-yellow-50 text-yellow-600' :
                            lead.status === 'contacted' ? 'bg-blue-50 text-blue-600' :
                            'bg-green-50 text-green-600'
                          }`}>
                            {lead.status === 'new' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </span>
                          {lead.lastMessage && (
                            <p className="text-xs text-gray-400 mt-1 italic truncate max-w-[150px]">Last: {lead.lastMessage}</p>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => startOutreach(lead)}
                          className="bg-green-50 text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-600 hover:text-white transition-all"
                        >
                          Chat Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                      <FileText size={24} className="text-gray-400" />
                    </div>
                    <h4 className="font-semibold">Google Sheets Integration</h4>
                    <p className="text-sm text-gray-500 max-w-sm">
                      Connect your Google Sheet to automatically sync leads. The agent will monitor for new rows and initiate outreach.
                    </p>
                    <button className="mt-2 text-green-600 font-medium hover:underline">Configure Sync Settings</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-10 flex-1 overflow-y-auto bg-gray-50"
            >
              <div className="max-w-4xl mx-auto">
                <div className="mb-10">
                  <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
                  <p className="text-gray-500 mt-1">Configure your AI Agent's identity, tone, and knowledge base.</p>
                </div>

                <div className="space-y-8">
                  {/* Company Profile */}
                  <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-800 border-b border-gray-50 pb-4">
                      <ShieldCheck size={22} className="text-blue-600" />
                      <h3>Company Profile & Branding</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Company Name</label>
                        <input 
                          type="text" 
                          value={config.companyName}
                          onChange={(e) => setConfig({...config, companyName: e.target.value})}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">WhatsApp Number</label>
                        <input
                          type="text"
                          value={config.whatsappNumber || ''}
                          onChange={(e) => setConfig({...config, whatsappNumber: e.target.value})}
                          placeholder="+1234567890"
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">AI Tone of Voice</label>
                        <select 
                          value={config.tone}
                          onChange={(e) => setConfig({...config, tone: e.target.value as any})}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                          <option value="professional">Professional & Direct</option>
                          <option value="friendly">Friendly & Conversational</option>
                          <option value="urgent">Urgent & Persuasive</option>
                          <option value="empathetic">Empathetic & Supportive</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* System Prompt */}
                  <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-800 border-b border-gray-50 pb-4">
                      <Bot size={22} className="text-green-600" />
                      <h3>AI Personality & Instructions</h3>
                    </div>
                    <textarea 
                      value={config.systemPrompt}
                      onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
                      className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm leading-relaxed"
                      placeholder="Enter the core instructions for the AI..."
                    />
                    <p className="text-xs text-gray-400 italic">
                      Tip: Define the tone, goals, and how the agent should handle specific scenarios.
                    </p>
                  </section>

                  {/* Knowledge Base */}
                  <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-800 border-b border-gray-50 pb-4">
                      <FileText size={22} className="text-purple-600" />
                      <h3>Product Knowledge Base</h3>
                    </div>
                    <textarea 
                      value={config.knowledgeBase}
                      onChange={(e) => setConfig({...config, knowledgeBase: e.target.value})}
                      className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm font-mono"
                      placeholder="Paste loan details, interest rates, eligibility criteria here..."
                    />
                    <div className="flex gap-4">
                      <label className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Upload size={18} /> Upload PDF Knowledge
                        <input type="file" className="hidden" accept=".pdf" onChange={handleKbUpload} />
                      </label>
                      <button className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                        <ExternalLink size={18} /> Sync from Website
                      </button>
                    </div>
                  </section>

                  {/* Language Settings */}
                  <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-800 border-b border-gray-50 pb-4">
                      <Languages size={22} className="text-orange-600" />
                      <h3>Language Support</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Punjabi'].map(lang => (
                        <div key={lang} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <CheckCircle2 size={18} className="text-green-500" />
                          <span className="text-sm font-medium">{lang}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                        <Plus size={18} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Add More</span>
                      </div>
                    </div>
                  </section>

                  <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
                    <button 
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to clear all leads?")) {
                          try {
                            const snapshot = await getDocs(query(collection(db, 'leads'), where('companyId', '==', selectedCompanyId)));
                            for (const d of snapshot.docs) {
                              await updateDoc(doc(db, 'leads', d.id), { status: 'lost' });
                            }
                            alert("Leads marked as lost.");
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }}
                      className="px-6 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
                    >
                      Reset Demo Data
                    </button>
                    <button 
                      onClick={async () => {
                        if (!selectedCompanyId) return;
                        try {
                          await updateDoc(doc(db, 'companies', selectedCompanyId), config as any);
                          alert("Configuration saved successfully! All AI responses will now use your new company identity and tone.");
                        } catch (error) {
                          console.error("Error saving config:", error);
                          alert("Failed to save configuration.");
                        }
                      }}
                      className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-10 flex-1 overflow-y-auto bg-white"
            >
              <div className="max-w-5xl mx-auto">
                <div className="mb-10">
                  <h1 className="text-3xl font-bold text-gray-900">System Overview & ROI</h1>
                  <p className="text-gray-500 mt-1">Understanding the workflow, costs, and conversion metrics.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                  <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-600 text-white rounded-lg">
                        <TrendingUp size={20} />
                      </div>
                      <h3 className="font-bold text-green-900">Conversion Rate</h3>
                    </div>
                    <p className="text-4xl font-black text-green-700">{analytics.conversionRate}%</p>
                    <p className="text-sm text-green-600 mt-2">Lead to Application (Avg.)</p>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-600 text-white rounded-lg">
                        <DollarSign size={20} />
                      </div>
                      <h3 className="font-bold text-blue-900">Cost per Lead</h3>
                    </div>
                    <p className="text-4xl font-black text-blue-700">₹4.20</p>
                    <p className="text-sm text-blue-600 mt-2">Combined API & Token Cost</p>
                  </div>

                  <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Zap size={20} />
                      </div>
                      <h3 className="font-bold text-purple-900">Response Time</h3>
                    </div>
                    <p className="text-4xl font-black text-purple-700">&lt; 3s</p>
                    <p className="text-sm text-purple-600 mt-2">Average AI Response Latency</p>
                  </div>

                  <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-orange-600 text-white rounded-lg">
                        <Clock size={20} />
                      </div>
                      <h3 className="font-bold text-orange-900">Time Saved</h3>
                    </div>
                    <p className="text-4xl font-black text-orange-700">{Math.round(analytics.contactedLeads * 15 / 60)} hrs</p>
                    <p className="text-sm text-orange-600 mt-2">Based on 15m per lead</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Drop-off Analysis */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <BarChart3 size={24} className="text-red-600" />
                      Drop-off Analysis
                    </h2>
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <p className="text-sm text-gray-500 mb-6">Identifying where users stop replying to improve loan offers.</p>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">After Initial Greeting</span>
                            <span className="text-gray-500">45% drop-off</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-red-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">When asked for Salary Details</span>
                            <span className="text-gray-500">28% drop-off</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-orange-400 h-2 rounded-full" style={{ width: '28%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">After quoting Interest Rate</span>
                            <span className="text-gray-500">15% drop-off</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '15%' }}></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 text-sm mb-1">AI Recommendation</h4>
                        <p className="text-xs text-blue-800">High drop-off after greeting suggests the initial message might be too generic. Try updating the System Prompt to offer a specific hook, like "Check your pre-approved limit in 2 minutes."</p>
                      </div>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <DollarSign size={24} className="text-blue-600" />
                      Token & API Cost Analysis
                    </h2>
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-200">
                            <th className="text-left pb-3 font-medium">Service</th>
                            <th className="text-right pb-3 font-medium">Unit</th>
                            <th className="text-right pb-3 font-medium">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr className="hover:bg-white transition-colors">
                            <td className="py-4 font-medium">Gemini 3 Flash (Input)</td>
                            <td className="text-right text-gray-500">1K Tokens</td>
                            <td className="text-right font-bold">₹0.08</td>
                          </tr>
                          <tr className="hover:bg-white transition-colors">
                            <td className="py-4 font-medium">Gemini 3 Flash (Output)</td>
                            <td className="text-right text-gray-500">1K Tokens</td>
                            <td className="text-right font-bold">₹0.25</td>
                          </tr>
                          <tr className="hover:bg-white transition-colors">
                            <td className="py-4 font-medium">WhatsApp Business API</td>
                            <td className="text-right text-gray-500">Per Conv.</td>
                            <td className="text-right font-bold">₹0.48</td>
                          </tr>
                          <tr className="hover:bg-white transition-colors">
                            <td className="py-4 font-medium">Google Cloud Hosting</td>
                            <td className="text-right text-gray-500">Monthly</td>
                            <td className="text-right font-bold">₹1500</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="text-green-700 font-bold">
                            <td className="pt-4">Total Avg. Cost</td>
                            <td className="text-right pt-4">Per Lead</td>
                            <td className="text-right pt-4 text-lg">₹4.20</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex gap-3">
                      <Zap size={20} className="text-yellow-600 shrink-0" />
                      <p className="text-xs text-yellow-800 leading-relaxed">
                        <strong>Optimization Tip:</strong> Using Gemini 3 Flash significantly reduces costs compared to Pro models while maintaining high accuracy for loan-related conversations.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Important Aspects */}
                <div className="mt-16 pt-10 border-t border-gray-100">
                  <h2 className="text-2xl font-bold mb-8 text-center">Critical Aspects for Success</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { 
                        icon: <ShieldCheck className="text-green-600" />, 
                        title: 'Data Privacy', 
                        desc: 'Compliance with DPDP Act (India) for handling sensitive financial data.' 
                      },
                      { 
                        icon: <Languages className="text-blue-600" />, 
                        title: 'Regional Support', 
                        desc: 'Native support for 9+ Indian languages to build trust with rural leads.' 
                      },
                      { 
                        icon: <CheckCircle2 className="text-purple-600" />, 
                        title: 'Human Escalation', 
                        desc: 'Seamless handoff to human agents when complex queries arise.' 
                      },
                      { 
                        icon: <Clock className="text-orange-600" />, 
                        title: '24/7 Availability', 
                        desc: 'Instant responses even during non-business hours to capture intent.' 
                      }
                    ].map((item, i) => (
                      <div key={i} className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                        <div className="mb-4">{item.icon}</div>
                        <h4 className="font-bold mb-2">{item.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Lead Modal */}
        <AnimatePresence>
          {isAddLeadModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Add New Leads</h3>
                  <button 
                    onClick={() => {
                      setIsAddLeadModalOpen(false);
                      setUploadType(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {!uploadType ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setUploadType('file')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                      >
                        <div className="p-3 bg-gray-50 rounded-full group-hover:bg-green-100 transition-colors">
                          <Upload size={24} className="text-gray-600 group-hover:text-green-600" />
                        </div>
                        <span className="font-semibold text-gray-700">Upload File</span>
                        <span className="text-xs text-gray-400 text-center">CSV or PDF files</span>
                      </button>

                      <button 
                        onClick={() => setUploadType('google')}
                        className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                      >
                        <div className="p-3 bg-gray-50 rounded-full group-hover:bg-blue-100 transition-colors">
                          <Table size={24} className="text-gray-600 group-hover:text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-700">Google Sheets</span>
                        <span className="text-xs text-gray-400 text-center">Connect Sheet ID</span>
                      </button>
                    </div>
                  ) : uploadType === 'file' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <button onClick={() => setUploadType(null)} className="hover:underline">Back</button>
                        <span>/</span>
                        <span>File Upload</span>
                      </div>
                      
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploading ? (
                            <Loader2 size={32} className="text-green-600 animate-spin mb-3" />
                          ) : (
                            <FileDown size={32} className="text-gray-400 mb-3" />
                          )}
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-400">CSV or PDF (Max 5MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".csv,.pdf" 
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                      </label>
                      
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h5 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Format Guide</h5>
                        <p className="text-xs text-blue-600">
                          CSV should have "Name" and "Phone" columns. PDF should have clear lead details.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <button onClick={() => setUploadType(null)} className="hover:underline">Back</button>
                        <span>/</span>
                        <span>Google Sheets</span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Google Sheet ID</label>
                        <input 
                          type="text"
                          value={sheetId}
                          onChange={(e) => setSheetId(e.target.value)}
                          placeholder="Enter your Sheet ID"
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <p className="text-[10px] text-gray-400">
                          Found in the URL: docs.google.com/spreadsheets/d/<span className="text-blue-500 font-bold">ID</span>/edit
                        </p>
                      </div>

                      <button 
                        onClick={handleGoogleSheetsSync}
                        disabled={!sheetId || isUploading}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isUploading && <Loader2 size={18} className="animate-spin" />}
                        {isUploading ? 'Syncing...' : 'Connect & Sync Leads'}
                      </button>

                      <div className="bg-gray-50 p-4 rounded-lg flex items-start gap-3">
                        <ExternalLink size={16} className="text-gray-400 mt-0.5" />
                        <p className="text-xs text-gray-500">
                          Make sure to share your sheet with the service account email provided in the Admin settings.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
