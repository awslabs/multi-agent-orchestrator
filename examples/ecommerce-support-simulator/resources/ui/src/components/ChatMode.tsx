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
              ? (isCustomer ? 'bg-yellow-300 text-yellow-900' : 'bg-red-300 text-red-900')
              : 'bg-gray-300 text-gray-900'
          }`}>
            <p className="text-xs font-semibold mb-1">{senderLabel}</p>
            <ReactMarkdown 
              className="prose prose-sm max-w-none"
              components={{
                p: ({node, ...props}) => <p className="whitespace-pre-wrap" {...props} />,
                pre: ({node, ...props}) => <pre className="whitespace-pre-wrap overflow-x-auto" {...props} />
              }}
            >
              {msg.content}
            </ReactMarkdown>
            <p className="text-xs mt-1 text-gray-600">
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
      <div className="flex-1 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-4 shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold text-yellow-900 mb-4">Customer Chat</h2>
        <div ref={customerChatRef} className="flex-grow bg-yellow-100 rounded-lg p-4 overflow-y-auto mb-4 h-[calc(100%-120px)]">
          {renderMessages(true)}
        </div>
        <form onSubmit={(e) => submitMessage(e, true)} className="flex mt-auto">
          <input
            ref={customerInputRef}
            type="text"
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            className="flex-grow mr-2 p-2 rounded-lg"
            placeholder="Type a message..."
          />
          <button type="submit" className="bg-amber-500 text-white p-2 rounded-lg">
            <Send size={20} />
          </button>
        </form>
      </div>
      {/* Support Chat */}
      <div className="flex-1 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-4 shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold text-red-900 mb-4">Support Chat</h2>
        <div ref={supportChatRef} className="flex-grow bg-red-100 rounded-lg p-4 overflow-y-auto mb-4 h-[calc(100%-120px)]">
          {renderMessages(false)}
        </div>
        <form onSubmit={(e) => submitMessage(e, false)} className="flex mt-auto">
          <input
            ref={supportInputRef}
            type="text"
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            className="flex-grow mr-2 p-2 rounded-lg"
            placeholder="Type a response..."
          />
          <button type="submit" className="bg-red-500 text-white p-2 rounded-lg">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  </div>
  );
};

export default ChatMode;