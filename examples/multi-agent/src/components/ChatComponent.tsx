import React from 'react';

interface Message {
  role: string;
  content: string;
}

interface ChatComponentProps {
  messages: Message[];
}

const ChatComponent: React.FC<ChatComponentProps> = ({ messages }) => {
  return (
    <div className="chat-container">
      {messages.map((message, index) => (
        <div key={index} className={`message ${message.role}`}>
          {message.content}
        </div>
      ))}
    </div>
  );
};

export default ChatComponent;