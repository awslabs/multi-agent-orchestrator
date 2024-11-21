import React from 'react';
import ChatMessage from './ChatMessage';

interface Message {
  role: string;
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  return (
    <div className="chat-window">
      {messages.map((message, index) => (
        <ChatMessage key={index} role={message.role} content={message.content} />
      ))}
    </div>
  );
};

export default ChatWindow;
