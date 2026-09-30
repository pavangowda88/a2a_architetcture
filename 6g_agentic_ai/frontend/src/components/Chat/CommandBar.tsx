import React, { useState } from 'react';
import { Send, Sparkles, Terminal } from 'lucide-react';

interface CommandBarProps {
  onSubmitCommand: (command: string) => void;
  isProcessing: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onSubmitCommand, isProcessing }) => {
  const [input, setInput] = useState('');

  const sampleCommands = [
    'Start production of order #104.',
    'Which robots are available?',
    'Move package P104 to inspection.',
    'Stop robot R02.',
    'Show current factory status.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSubmitCommand(input.trim());
    setInput('');
  };

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-3 select-none">
      <div className="max-w-7xl mx-auto space-y-2">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <div className="flex-1 relative flex items-center">
            <div className="absolute left-3 flex items-center space-x-1.5 text-sky-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wide">ASK THE FACTORY:</span>
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing}
              placeholder='e.g. "Start production of order #104." or "Which robots are available?"'
              className="w-full bg-[#0a0d16] text-white pl-44 pr-10 py-2 rounded-xl border border-slate-800 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 text-xs font-mono placeholder:text-slate-500 transition-all shadow-inner"
            />
            {isProcessing && (
              <div className="absolute right-3">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-sky-500/10 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>EXECUTE</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
          <span className="text-slate-500 font-semibold flex items-center space-x-1 shrink-0">
            <Terminal className="w-3 h-3" />
            <span>PRESETS:</span>
          </span>
          {sampleCommands.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSubmitCommand(cmd);
              }}
              disabled={isProcessing}
              className="bg-slate-800/80 hover:bg-sky-950 hover:text-sky-300 text-slate-300 border border-slate-700/80 hover:border-sky-500/40 px-2.5 py-0.5 rounded-full transition-all shrink-0 active:scale-95"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
