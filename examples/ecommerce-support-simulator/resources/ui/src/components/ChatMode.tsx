import React, { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';
const ChatMode = ({
  messages,
  customerMessage,
  setCustomerMessage,
  supportMessage,
  setSupportMessage,
  handleCustomerSubmit,
  handleSupportSubmit,
}) => {
  const customerChatRef = useRef<HTMLDivElement>(null);
  const supportChatRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const supportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customerChatRef.current) {
      customerChatRef.current.scrollTop = customerChatRef.current.scrollHeight;
    }
    if (supportChatRef.current) {
      supportChatRef.current.scrollTop = supportChatRef.current.scrollHeight;
    }
    if (messages[messages.length - 1]?.destination === 'customer') {
      customerInputRef.current?.focus();
    } else {
      supportInputRef.current?.focus();
    }
  }, [messages]);

  const renderMessages = (isCustomer: boolean) => {
    return messages.map((msg: Message, index: number) => {
      const isVisible = isCustomer ? msg.destination === 'customer' : msg.destination === 'support';
      const isFromUI = msg.source === 'ui';
      let senderLabel: string;
      if (isCustomer) {
        senderLabel = isFromUI ? 'Me' : 'Sam from Support';
      } else {
        senderLabel = isFromUI ? 'Me' : 'Alex';
      }
      if (!isVisible) return null;
      return (
        <div key={index} className={`flex ${isFromUI ? 'justify-end' : 'justify-start'} mb-2`}>
          <div className={`rounded-lg py-2 px-4 max-w-[80%] break-words ${
            isFromUI
              ? (isCustomer ? 'bg-blue-50 border border-blue-100 text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-900')
              : 'bg-white border border-gray-200 text-gray-900'
          }`}>
            <p className={`text-xs font-semibold mb-1 ${
              isFromUI ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {senderLabel}
            </p>
            <ReactMarkdown 
              className="prose prose-sm max-w-none text-gray-900"
              components={{
                p: ({node, ...props}) => <p className="whitespace-pre-wrap" {...props} />,
                pre: ({node, ...props}) => <pre className="whitespace-pre-wrap overflow-x-auto bg-gray-50 p-2 rounded" {...props} />
              }}
            >
              {msg.content}
            </ReactMarkdown>
            <p className="text-xs mt-1 text-gray-500">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      );
    });
  };

  const submitMessage = (e: React.FormEvent, isCustomer: boolean) => {
    e.preventDefault();
    const message = isCustomer ? customerMessage : supportMessage;
    if (!message.trim()) return;
    
    const newMessage = {
      content: message,
      destination: isCustomer ? 'customer' : 'support',
      source: 'ui',
      timestamp: new Date().toISOString()
    };
    if (isCustomer) {
      handleCustomerSubmit(newMessage);
      setCustomerMessage('');
    } else {
      handleSupportSubmit(newMessage);
      setSupportMessage('');
    }
  };

  return (
    <div className="flex flex-col space-y-4 h-[700px]">
      <div className="flex-grow flex space-x-4 h-full">
        {/* Customer Chat */}
        <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Chat</h2>
          <div 
            ref={customerChatRef} 
            className="flex-grow bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4 h-[calc(100%-120px)] border border-gray-100"
          >
            {renderMessages(true)}
          </div>
          <form onSubmit={(e) => submitMessage(e, true)} className="flex mt-auto">
            <input
              ref={customerInputRef}
              type="text"
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              className="flex-grow mr-2 p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-500"
              placeholder="Type a message..."
            />
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors duration-200"
              disabled={!customerMessage.trim()}
            >
              <Send size={20} />
            </button>
          </form>
        </div>

        {/* Support Chat */}
        <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Support Chat</h2>
          <div 
            ref={supportChatRef} 
            className="flex-grow bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4 h-[calc(100%-120px)] border border-gray-100"
          >
            {renderMessages(false)}
          </div>
          <form onSubmit={(e) => submitMessage(e, false)} className="flex mt-auto">
            <input
              ref={supportInputRef}
              type="text"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              className="flex-grow mr-2 p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-500"
              placeholder="Type a response..."
            />
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors duration-200"
              disabled={!supportMessage.trim()}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatMode;