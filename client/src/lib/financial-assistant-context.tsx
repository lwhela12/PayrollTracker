import React, { createContext, useContext, useState, useCallback } from 'react';
import { nanoid } from 'nanoid';

export type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
};

interface FinancialAssistantContextProps {
  messages: Message[];
  addMessage: (text: string) => Promise<void>;
  isChatPanelVisible: boolean;
  toggleChatPanel: () => void;
  isTyping: boolean;
}

const FinancialAssistantContext = createContext<FinancialAssistantContextProps | undefined>(undefined);

export function FinancialAssistantProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatPanelVisible, setIsChatPanelVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const toggleChatPanel = useCallback(() => {
    setIsChatPanelVisible(v => !v);
  }, []);

  const addMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: nanoid(),
      sender: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate AI response
    try {
      const aiResponseText = `You said: ${text}`;
      await new Promise(res => setTimeout(res, 1000));
      const aiMessage: Message = {
        id: nanoid(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  return (
    <FinancialAssistantContext.Provider value={{ messages, addMessage, isChatPanelVisible, toggleChatPanel, isTyping }}>
      {children}
    </FinancialAssistantContext.Provider>
  );
}

export function useFinancialAssistant() {
  const ctx = useContext(FinancialAssistantContext);
  if (!ctx) throw new Error('useFinancialAssistant must be used within FinancialAssistantProvider');
  return ctx;
}
