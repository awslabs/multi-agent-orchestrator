import React from 'react';

interface ChatMessageProps {
  role: string;
  content: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  return (
    <div className={`chat-message ${role}`}>
      <strong>{role}: </strong>
      <span>{typeof content === 'string' ? content : JSON.stringify(content)}</span>
    </div>
  );
};

export default ChatMessage;
