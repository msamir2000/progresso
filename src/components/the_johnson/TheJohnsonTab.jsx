
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Case } from '@/api/entities';
import { User } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';
import { Loader2, User as UserIcon, Bot, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function TheJohnsonTab({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [allCases, user] = await Promise.all([Case.list(), User.me()]);
        if (isMountedRef.current) {
            const currentCase = allCases.find(c => c.id === caseId);
            setCaseData(currentCase);
            setCurrentUser(user);
            
            // Start with an empty message list
            setMessages([]);
        }
      } catch (error) {
        if (isMountedRef.current) {
            console.error("Error loading initial data for The Johnson:", error);
        }
      } finally {
        if (isMountedRef.current) {
            setIsLoading(false);
        }
      }
    };

    if (caseId) {
      loadInitialData();
    }
  }, [caseId]);

  const handleSend = async () => {
    if (!input.trim() || !caseData || !currentUser) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Construct a detailed context string
      const context = `
        Case Information:
        Company Name: ${caseData.company_name}
        Case Reference: ${caseData.case_reference}
        Case Type: ${caseData.case_type}
        Appointment Date: ${caseData.appointment_date}
        Status: ${caseData.status}

        Key Details (JSON):
        ${JSON.stringify(caseData, null, 2)}
      `;

      const prompt = `
        You are "The Johnson", an expert insolvency AI assistant.
        The user "${currentUser.full_name}" is asking a question about the case: "${caseData.company_name}".
        
        Use the provided case information to answer the user's question. Be concise and accurate.
        If the information is not available in the provided context, state that clearly.
        
        User's question: "${userMessage.content}"

        Case Context:
        ---
        ${context}
        ---
      `;

      const response = await InvokeLLM({ prompt });
      const aiMessage = { role: 'assistant', content: response };
      if (isMountedRef.current) {
        setMessages(prev => [...prev, aiMessage]);
      }

    } catch (error) {
      console.error("Error invoking LLM:", error);
      if (isMountedRef.current) {
        const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-[75vh] bg-white rounded-lg shadow-sm border border-slate-200">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg font-bold">AI</span>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900">The Johnson</span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-slate-500 pt-16">
              <Bot className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">The Johnson is ready.</p>
              <p className="text-sm">Ask anything about the current case.</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`max-w-xl p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <ReactMarkdown className="prose prose-sm max-w-none">{message.content}</ReactMarkdown>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="max-w-xl p-3 rounded-lg bg-slate-100 text-slate-800">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
             </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t bg-slate-50">
        <div className="flex items-center gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            onKeyPress={(e) => { if (e.key === 'Enter' && !isLoading) handleSend(); }}
            disabled={isLoading || !caseData}
            className="bg-white"
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim() || !caseData}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
