import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface CommandBarProps {
  onSubmitCommand: (command: string) => void;
  isProcessing: boolean;
  isLocked?: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onSubmitCommand, isProcessing, isLocked = false }) => {
  const [input, setInput] = useState('');

  const sampleCommands = [
    'List agents with the inspection skill',
    'Show active network sessions',
    'Check the inbox for ue_agent_001',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || isLocked) return;
    onSubmitCommand(input.trim());
    setInput('');
  };

  return (
    <div className="command-bar select-none">
      <div className="command-content">
        <div className="command-label"><Sparkles size={14} /><span>Ask the factory</span><small>Natural language control</small></div>
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing || isLocked}
              placeholder='Ask about agents, UE services, sessions, or robot tasks'
              className="command-input w-full text-white px-4 py-3 rounded-xl text-sm placeholder:text-slate-500 transition-all"
            />
            {isProcessing && (
              <div className="absolute right-3">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || isLocked}
            className="command-submit flex items-center space-x-1.5 disabled:opacity-50 text-sm font-semibold px-5 py-3 rounded-xl transition-all active:scale-[0.98]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>EXECUTE</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="command-presets flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-medium shrink-0">Try:</span>
          {sampleCommands.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSubmitCommand(cmd);
              }}
              disabled={isProcessing || isLocked}
              className="command-preset shrink-0 transition-colors active:scale-[0.98]"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
