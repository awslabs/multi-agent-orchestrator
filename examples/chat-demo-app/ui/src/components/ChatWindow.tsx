import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Github, BookOpen } from 'lucide-react';
import { ChatApiClient } from '../utils/ApiClient';
import { v4 as uuidv4 } from 'uuid';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import { configureAmplify } from '../utils/amplifyConfig';
import { replaceTextEmotesWithEmojis } from './emojiHelper';
import ReactMarkdown from 'react-markdown';

interface ChatWindowProps {
  awsExportsUrl: string;
  awsExports: any;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ awsExportsUrl, awsExports }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const apiClient = new ChatApiClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const initializeAuth = async () => {
      await configureAmplify(awsExportsUrl, awsExports);
      try {
        await getCurrentUser();
        setIsAuthenticated(true);
      } catch (error) {
        console.log('Not authenticated', error);
        setIsAuthenticated(false);
      }
    };

    initializeAuth();
  }, [awsExportsUrl, awsExports]);

  const renderMessageContent = (content: string) => {
    const processedContent = replaceTextEmotesWithEmojis(content);
    return (
      <ReactMarkdown
        components={{
          p: ({ node, ...props }) => <p className="mb-2" {...props} />,
          a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          code: ({ node, ...props }) =>
            (
              <code className="block bg-gray-200 rounded p-2 my-2 whitespace-pre-wrap" {...props} />
            ),
            // Add support for headers
        h1: ({ node, ...props }) => (
          <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-xl font-bold mt-3 mb-2" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-lg font-bold mt-2 mb-1" {...props} />
        ),
        h4: ({ node, ...props }) => (
          <h4 className="text-base font-bold mt-2 mb-1" {...props} />
        ),
        h5: ({ node, ...props }) => (
          <h5 className="text-sm font-bold mt-1 mb-1" {...props} />
        ),
        h6: ({ node, ...props }) => (
          <h6 className="text-xs font-bold mt-1 mb-1" {...props} />
        ),
        // Add support for ordered and unordered lists
        ul: ({ node, ...props }) => (
          <ul className="list-disc list-inside mb-2" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal mb-2 pl-6" {...props} />
        ),
        // Add support for blockquotes
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="border-l-4 border-gray-300 pl-4 italic my-2"
            {...props}
          />
        ),
        // Add support for horizontal rules
        hr: ({ node, ...props }) => (
          <hr className="border-t border-gray-300 my-4" {...props} />
        ),
        // Add support for tables
        table: ({ node, ...props }) => (
          <table className="border-collapse table-auto w-full my-2" {...props} />
        ),
        thead: ({ node, ...props }) => (
          <thead className="bg-gray-200" {...props} />
        ),
        th: ({ node, ...props }) => (
          <th className="border px-4 py-2 text-left" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="border px-4 py-2" {...props} />
        ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  useEffect(() => {
    let session_id = localStorage.getItem('sessionId');
    if (session_id == null) {
      session_id = uuidv4();
      localStorage.setItem('sessionId', session_id);
    }
    setSessionId(session_id);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === '') return;

    const newMessage = {
      content: inputMessage,
      sender: 'You',
      timestamp: new Date().toISOString()
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInputMessage('');
    setRunning(true);

    setMessages(prevMessages => [
      ...prevMessages,
      {
        content: '',
        sender: '',
        timestamp: new Date().toISOString(),
        isWaiting: true
      }
    ]);

    try {
      const response = await apiClient.query('chat/query', inputMessage);

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulatedContent = "";
        let agentName = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            try {
              const parsedLine = JSON.parse(line);
              switch (parsedLine.type) {
                case 'metadata':
                  agentName = parsedLine.data.metadata.agentName;
                  break;
                case 'chunk':
                case 'complete':
                  accumulatedContent += parsedLine.data;
                  break;
                case 'error':
                  console.error('Error:', parsedLine.data);
                  accumulatedContent += `Error: ${parsedLine.data}\n`;
                  break;
              }

              setMessages(prevMessages => [
                ...prevMessages.slice(0, -1),
                {
                  content: accumulatedContent,
                  sender: agentName,
                  timestamp: new Date().toISOString(),
                  isWaiting: false
                }
              ]);
            } catch (error) {
              console.error('Error parsing JSON:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in API call:', error);
      setMessages(prevMessages => [
        ...prevMessages.slice(0, -1),
        {
          content: `Error: ${(error as Error).message}`,
          sender: 'System',
          timestamp: new Date().toISOString(),
          isWaiting: false
        }
      ]);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated === false) {
    return (
      <Authenticator>
        {({ user }) => {
          setIsAuthenticated(true);
          return null;
        }}
      </Authenticator>
    );
  }

  return (
    <div className="flex flex-col h-[800px] w-[1000px] bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-6 shadow-lg">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-yellow-900 mb-2">
          Multi-Agent Orchestrator Demo
        </h1>
        <p className="text-lg text-yellow-800 mb-4">
          Experience the power of intelligent routing and context management
          across multiple AI agents.
        </p>
        <p className="text-md text-yellow-700 italic">
          Type "hello" or "bonjour" to see the available agents and start
          interacting!
        </p>
      </div>
      <div className="flex-grow bg-yellow-100 rounded-lg p-4 overflow-y-auto mb-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"} mb-2`}
          >
            <div
              className={`rounded-lg py-2 px-4 max-w-[70%] ${
                msg.sender === "You"
                  ? "bg-yellow-300 text-yellow-900"
                  : "bg-gray-300 text-gray-900"
              }`}
            >
              <p className="text-xs font-semibold mb-1">{msg.sender}</p>
              {msg.isWaiting ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin" size={24} />
                </div>
              ) : renderMessageContent(msg.content)
              }

              <p className="text-xs mt-1 text-gray-600">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex mt-auto mb-4">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className="flex-grow mr-2 p-2 rounded-lg"
          placeholder="Type a message..."
          disabled={running}
        />
        <button
          type="submit"
          className="bg-amber-500 text-white p-2 rounded-lg"
          disabled={running}
        >
          <Send size={20} />
        </button>
      </form>
      <div className="text-center text-yellow-900">
        <p className="mb-2">To learn more about the Multi-Agent Orchestrator:</p>
        <div className="flex justify-center space-x-4">
          <a
            href="https://github.com/awslabs/multi-agent-orchestrator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center bg-yellow-400 hover:bg-yellow-500 text-orange-900 font-bold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            <Github size={24} className="mr-2" />
            GitHub Repo
          </a>
          <a
            href="https://awslabs.github.io/multi-agent-orchestrator/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center bg-yellow-400 hover:bg-yellow-500 text-orange-900 font-bold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            <BookOpen size={24} className="mr-2" />
            Documentation
          </a>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg"
      >
        Sign out
      </button>
    </div>
  );
};

export default ChatWindow;