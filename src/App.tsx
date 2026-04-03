/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  UserCircle, 
  Search, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Trash2, 
  ExternalLink, 
  RefreshCw,
  MessageSquare,
  Filter,
  ChevronRight,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';

// Types
interface Subreddit {
  id: string;
  name: string;
  active: boolean;
}

interface Personality {
  name: string;
  description: string;
  tone: string;
  context: string;
}

interface FilterSettings {
  minKarma: number;
  maxAgeHours: number;
  keywords: string[];
  excludeKeywords: string[];
}

interface OutreachResult {
  id: string;
  subreddit: string;
  title: string;
  author: string;
  content: string;
  url: string;
  relevance: number;
  reasoning: string;
  generatedMessage: string;
  status: 'pending' | 'sent' | 'ignored';
  timestamp: string;
}

const INITIAL_SUBREDDITS: Subreddit[] = [
  { id: '1', name: 'reactjs', active: true },
  { id: '2', name: 'webdev', active: true },
  { id: '3', name: 'javascript', active: true },
  { id: '4', name: 'saas', active: false },
];

const INITIAL_PERSONALITY: Personality = {
  name: "Helpful Expert",
  description: "A seasoned developer who provides genuine value first.",
  tone: "Professional yet friendly, technical but accessible.",
  context: "You are a developer advocate for a new React UI library. Your goal is to help people solve their UI problems and only mention your library if it's a perfect fit."
};

const INITIAL_FILTERS: FilterSettings = {
  minKarma: 10,
  maxAgeHours: 24,
  keywords: ['help', 'advice', 'how to', 'recommendation'],
  excludeKeywords: ['hiring', 'job', 'spam'],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'personality' | 'results' | 'preferences'>('dashboard');
  const [subreddits, setSubreddits] = useState<Subreddit[]>(INITIAL_SUBREDDITS);
  const [personality, setPersonality] = useState<Personality>(INITIAL_PERSONALITY);
  const [filters, setFilters] = useState<FilterSettings>(INITIAL_FILTERS);
  const [results, setResults] = useState<OutreachResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<{ id: string, name: string, filters: FilterSettings }[]>([]);
  const [preferences, setPreferences] = useState<{ likes: string[], dislikes: string[] }>({ likes: [], dislikes: [] });
  const [ignoredList, setIgnoredList] = useState<string[]>([]);

  useEffect(() => {
    // Default to light mode as per user request "Ich mag diese Startup-Looks nicht"
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // AI Service
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), []);

  const generateOutreach = async (post: Partial<OutreachResult>) => {
    try {
      const prompt = `
        Personality: ${personality.name}
        Context: ${personality.context}
        Tone: ${personality.tone}
        
        Reddit Post Title: ${post.title}
        Reddit Post Content: ${post.content}
        Subreddit: ${post.subreddit}
        
        Task:
        1. Analyze if this post is relevant to our context.
        2. If relevant, generate a personalized, helpful outreach message that doesn't sound like spam.
        3. Provide a relevance score (0-100) and a brief reasoning.
        
        Return the response in JSON format:
        {
          "relevance": number,
          "reasoning": "string",
          "message": "string"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const data = JSON.parse(response.text || '{}');
      return data;
    } catch (error) {
      console.error("AI Generation error:", error);
      return { relevance: 0, reasoning: "Error generating", message: "" };
    }
  };

  const startScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    // Simulate scanning subreddits
    const mockPosts = [
      { id: 'p1', subreddit: 'reactjs', title: 'How to build a complex dashboard?', author: 'dev_guy', content: 'I am struggling with layout and performance in my React dashboard. Any tips?', url: '#' },
      { id: 'p2', subreddit: 'webdev', title: 'Best UI library for 2024?', author: 'frontend_gal', content: 'Looking for something modern and fast. Tired of MUI.', url: '#' },
      { id: 'p3', subreddit: 'javascript', title: 'Help with state management', author: 'js_newbie', content: 'Redux vs Context API for a small project?', url: '#' },
    ];

    const newResults: OutreachResult[] = [];

    for (let i = 0; i < mockPosts.length; i++) {
      setScanProgress(((i + 1) / mockPosts.length) * 100);
      const post = mockPosts[i];
      const aiResponse = await generateOutreach(post);
      
      newResults.push({
        ...post,
        relevance: aiResponse.relevance,
        reasoning: aiResponse.reasoning,
        generatedMessage: aiResponse.message,
        status: 'pending',
        timestamp: new Date().toLocaleTimeString(),
      });
      
      // Artificial delay for realism
      await new Promise(r => setTimeout(r, 800));
    }

    setResults(prev => [...newResults, ...prev]);
    setIsScanning(false);
    setActiveTab('results');
  };

  return (
    <div className={cn(
      "flex h-screen font-sans overflow-hidden transition-colors duration-300",
      theme === 'dark' ? "bg-[#0f1115] text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 border-r flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">OutreachPilot</h1>
              <p className={cn(
                "text-xs font-medium uppercase tracking-widest",
                theme === 'dark' ? "text-gray-500" : "text-gray-400"
              )}>Reddit Engine</p>
            </div>
          </div>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <XCircle size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
            theme={theme}
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Configuration" 
            active={activeTab === 'config'} 
            onClick={() => { setActiveTab('config'); setIsSidebarOpen(false); }} 
            theme={theme}
          />
          <SidebarItem 
            icon={<UserCircle size={20} />} 
            label="Personality" 
            active={activeTab === 'personality'} 
            onClick={() => { setActiveTab('personality'); setIsSidebarOpen(false); }} 
            theme={theme}
          />
          <SidebarItem 
            icon={<Filter size={20} />} 
            label="Preferences" 
            active={activeTab === 'preferences'} 
            onClick={() => { setActiveTab('preferences'); setIsSidebarOpen(false); }} 
            theme={theme}
          />
          <SidebarItem 
            icon={<MessageSquare size={20} />} 
            label="Outreach Results" 
            active={activeTab === 'results'} 
            onClick={() => { setActiveTab('results'); setIsSidebarOpen(false); }} 
            badge={results.filter(r => r.status === 'pending').length}
            theme={theme}
          />
        </nav>

        <div className="p-4 mt-auto">
          <button 
            onClick={startScan}
            disabled={isScanning}
            className={cn(
              "w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all duration-300",
              isScanning 
                ? (theme === 'dark' ? "bg-gray-800 text-gray-500" : "bg-gray-200 text-gray-400") 
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95"
            )}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Start Scan
              </>
            )}
          </button>
          {isScanning && (
            <div className={cn(
              "mt-3 h-1.5 rounded-full overflow-hidden",
              theme === 'dark' ? "bg-gray-800" : "bg-gray-200"
            )}>
              <motion.div 
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress}%` }}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto relative transition-colors duration-300",
        theme === 'dark' ? "bg-[#0f1115]" : "bg-gray-50"
      )}>
        <header className={cn(
          "sticky top-0 z-10 backdrop-blur-md border-b px-4 md:px-8 py-4 flex justify-between items-center transition-colors duration-300",
          theme === 'dark' ? "bg-[#0f1115]/80 border-gray-800" : "bg-white/80 border-gray-200"
        )}>
          <div className="flex items-center gap-4">
            <button className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
              <LayoutDashboard size={24} />
            </button>
            <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          </div>
          
          <div className="flex-1 max-w-md mx-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
              theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200 shadow-sm"
            )}>
              <Search size={18} className="text-gray-500" />
              <input 
                type="text" 
                placeholder="Search Reddit..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={cn(
                "p-2 rounded-lg border transition-all duration-200",
                theme === 'dark' 
                  ? "bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700" 
                  : "bg-white border-gray-200 text-indigo-600 hover:bg-gray-50 shadow-sm"
              )}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <div className={cn(
              "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors duration-300",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200 shadow-sm"
            )}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className={cn(
                "text-xs font-medium",
                theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>Live Engine</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard icon={<Search className="text-indigo-400" />} label="Subreddits" value={subreddits.filter(s => s.active).length} subValue="Active monitors" theme={theme} />
                  <StatCard icon={<CheckCircle2 className="text-green-400" />} label="Total Found" value={results.length} subValue="Posts analyzed" theme={theme} />
                  <StatCard icon={<Send className="text-blue-400" />} label="Messages Sent" value={results.filter(r => r.status === 'sent').length} subValue="Outreach success" theme={theme} />
                </div>

                <div className={cn(
                  "rounded-2xl border p-6 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="text-indigo-400" size={20} />
                    Recent Activity
                  </h3>
                  <div className="space-y-4">
                    {results.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        <AlertCircle className="mx-auto mb-3 opacity-20" size={48} />
                        <p>No activity yet. Start a scan to find relevant posts.</p>
                      </div>
                    ) : (
                      results.slice(0, 5).map(result => (
                        <div key={result.id} className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
                          theme === 'dark' ? "bg-gray-800/30 border-gray-700/50" : "bg-gray-50 border-gray-100"
                        )}>
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              result.relevance > 70 
                                ? (theme === 'dark' ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-600") 
                                : (theme === 'dark' ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-600")
                            )}>
                              {result.relevance}%
                            </div>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{result.title}</p>
                              <p className="text-xs text-gray-500">r/{result.subreddit} • {result.timestamp}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setActiveTab('results')}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              theme === 'dark' ? "hover:bg-gray-700" : "hover:bg-gray-200"
                            )}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div 
                key="config"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className={cn(
                  "rounded-2xl border p-6 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm"
                )}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold">Subreddit Monitoring</h3>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors text-white">
                      <Plus size={18} />
                      Add Subreddit
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {subreddits.map(sub => (
                      <div key={sub.id} className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
                        theme === 'dark' ? "bg-gray-800/30 border-gray-700/50" : "bg-gray-50 border-gray-100"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", sub.active ? "bg-green-500" : "bg-gray-600")} />
                          <span className="font-medium">r/{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSubreddits(subreddits.map(s => s.id === sub.id ? { ...s, active: !s.active } : s))}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                              sub.active 
                                ? (theme === 'dark' ? "bg-green-500/10 text-green-400" : "bg-green-100 text-green-700") 
                                : (theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500")
                            )}
                          >
                            {sub.active ? 'Active' : 'Paused'}
                          </button>
                          <button className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={cn(
                  "rounded-2xl border p-6 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Filter className="text-indigo-400" size={20} />
                    Scan Filters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-400">Minimum Karma</span>
                        <input 
                          type="number" 
                          value={filters.minKarma}
                          onChange={e => setFilters({...filters, minKarma: parseInt(e.target.value)})}
                          className={cn(
                            "mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                          )} 
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-400">Max Post Age (Hours)</span>
                        <input 
                          type="number" 
                          value={filters.maxAgeHours}
                          onChange={e => setFilters({...filters, maxAgeHours: parseInt(e.target.value)})}
                          className={cn(
                            "mt-1 block w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                          )} 
                        />
                      </label>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-400">Keywords</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {filters.keywords.map(kw => (
                            <span key={kw} className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors",
                              theme === 'dark' 
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                                : "bg-indigo-50 text-indigo-600 border-indigo-100"
                            )}>
                              {kw}
                              <XCircle size={12} className="cursor-pointer" />
                            </span>
                          ))}
                          <button className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border border-dashed transition-colors",
                            theme === 'dark' ? "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500" : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
                          )}>
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'preferences' && (
              <motion.div 
                key="preferences"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className={cn(
                  "rounded-2xl border p-8 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-xl font-bold mb-6">Preferences</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Likes (Keywords)</span>
                      <textarea 
                        rows={4}
                        placeholder="e.g. react, typescript, performance"
                        value={preferences.likes.join(', ')}
                        onChange={e => setPreferences({...preferences, likes: e.target.value.split(',').map(s => s.trim())})}
                        className={cn(
                          "mt-2 block w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none",
                          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                        )} 
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Dislikes (Keywords)</span>
                      <textarea 
                        rows={4}
                        placeholder="e.g. spam, hiring, job"
                        value={preferences.dislikes.join(', ')}
                        onChange={e => setPreferences({...preferences, dislikes: e.target.value.split(',').map(s => s.trim())})}
                        className={cn(
                          "mt-2 block w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none",
                          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                        )} 
                      />
                    </label>
                  </div>
                </div>

                <div className={cn(
                  "rounded-2xl border p-8 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-xl font-bold mb-6">Ignored Items ({ignoredList.length})</h3>
                  <div className="space-y-2">
                    {ignoredList.length === 0 ? (
                      <p className="text-gray-500">No items ignored yet.</p>
                    ) : (
                      ignoredList.map(id => (
                        <div key={id} className="flex items-center justify-between p-3 bg-gray-800/20 rounded-lg">
                          <span>Post ID: {id}</span>
                          <button onClick={() => setIgnoredList(ignoredList.filter(i => i !== id))} className="text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'results' && (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {results.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border transition-colors",
                      theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200 shadow-sm"
                    )}>
                      <Search className="text-gray-600" size={32} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No results yet</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Configure your subreddits and personality, then click "Start Scan" to find relevant outreach opportunities.
                    </p>
                  </div>
                ) : (
                  results
                    .filter(r => !ignoredList.includes(r.id))
                    .filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.content.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(result => (
                      <ResultCard 
                        key={result.id} 
                        result={result} 
                        onAction={(id, status) => setResults(results.map(r => r.id === id ? { ...r, status } : r))}
                        onIgnore={(id) => setIgnoredList([...ignoredList, id])}
                        theme={theme}
                      />
                    ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Sub-components
const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, badge?: number, theme: 'light' | 'dark' }> = ({ icon, label, active, onClick, badge, theme }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? (theme === 'dark' ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "bg-indigo-50 text-indigo-600 border border-indigo-100") 
          : (theme === 'dark' ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900")
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("transition-colors", active ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-300")}>
          {icon}
        </span>
        <span className="font-medium text-sm">{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: string | number, subValue: string, theme: 'light' | 'dark' }> = ({ icon, label, value, subValue, theme }) => {
  return (
    <div className={cn(
      "p-6 rounded-2xl border shadow-sm transition-colors duration-300",
      theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200"
    )}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
        )}>
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </div>
      <div className="flex flex-col">
        <span className={cn(
          "text-3xl font-bold tracking-tight transition-colors",
          theme === 'dark' ? "text-white" : "text-gray-900"
        )}>{value}</span>
        <span className="text-xs text-gray-500 mt-1">{subValue}</span>
      </div>
    </div>
  );
};

const ResultCard: React.FC<{ 
  result: OutreachResult, 
  onAction: (id: string, status: 'sent' | 'ignored') => void, 
  onIgnore: (id: string) => void,
  theme: 'light' | 'dark' 
}> = ({ result, onAction, onIgnore, theme }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      layout
      className={cn(
        "rounded-2xl border transition-all duration-300 overflow-hidden",
        result.status === 'sent' ? "border-green-500/30 opacity-75" : 
        result.status === 'ignored' ? "border-red-500/30 opacity-50" : 
        (theme === 'dark' ? "bg-[#161920] border-gray-800" : "bg-white border-gray-200 shadow-sm")
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border transition-colors",
                theme === 'dark' 
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                  : "bg-indigo-50 text-indigo-600 border-indigo-100"
              )}>
                r/{result.subreddit}
              </span>
              <span className="text-xs text-gray-500">by u/{result.author} • {result.timestamp}</span>
            </div>
            <h4 className={cn(
              "text-lg font-bold mb-2 leading-tight transition-colors",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{result.title}</h4>
            <p className="text-gray-400 text-sm line-clamp-2 mb-4">{result.content}</p>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  result.relevance > 80 ? "bg-green-500" : result.relevance > 50 ? "bg-yellow-500" : "bg-red-500"
                )} />
                <span className={cn(
                  "text-xs font-semibold transition-colors",
                  theme === 'dark' ? "text-gray-300" : "text-gray-600"
                )}>{result.relevance}% Relevant</span>
              </div>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {isExpanded ? 'Hide AI Analysis' : 'Show AI Analysis'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {result.status === 'pending' ? (
              <>
                <button 
                  onClick={() => onAction(result.id, 'sent')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Send size={16} />
                  Send
                </button>
                <button 
                  onClick={() => onIgnore(result.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                    theme === 'dark' ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  )}
                >
                  <XCircle size={16} />
                  Ignore
                </button>
              </>
            ) : (
              <div className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2",
                result.status === 'sent' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              )}>
                {result.status === 'sent' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {result.status === 'sent' ? 'Sent' : 'Ignored'}
              </div>
            )}
            <a 
              href={result.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-300 flex items-center justify-center transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "mt-6 pt-6 border-t space-y-4 transition-colors",
                theme === 'dark' ? "border-gray-800" : "border-gray-100"
              )}
            >
              <div>
                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Reasoning</h5>
                <p className={cn(
                  "text-sm italic transition-colors",
                  theme === 'dark' ? "text-gray-300" : "text-gray-600"
                )}>"{result.reasoning}"</p>
              </div>
              <div>
                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Generated Outreach</h5>
                <div className={cn(
                  "p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap transition-colors",
                  theme === 'dark' ? "bg-gray-900/50 border-gray-800 text-gray-200" : "bg-gray-50 border-gray-100 text-gray-700"
                )}>
                  {result.generatedMessage}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
