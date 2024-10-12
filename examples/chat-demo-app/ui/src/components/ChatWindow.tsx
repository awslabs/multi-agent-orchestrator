import React, { useState, useEffect, useRef } from 'react';
import { Send, Code2, BookOpen, RefreshCw } from 'lucide-react';
import { ChatApiClient } from '../utils/ApiClient';
import { v4 as uuidv4 } from 'uuid';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import { configureAmplify } from '../utils/amplifyConfig';
import { replaceTextEmotesWithEmojis } from './emojiHelper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import LoadingScreen from '../components/loadingScreen';

const waitMessages = [
  "Hang tight! Great things take time!",
  "Almost there... Grabbing the answers!",
  "Good things come to those who wait!",
  "Patience is a virtue, right?",
  "We’re brewing up something special!",
  "Just a second! AI is thinking hard!",
];

const getRandomWaitMessage = () => {
  return waitMessages[Math.floor(Math.random() * waitMessages.length)];
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  useEffect(() => {
    hljs.highlightAll();
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return match ? (
            <pre className="bg-yellow-50 rounded-md p-4 my-2 overflow-x-auto text-sm font-mono">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className="bg-yellow-100 text-yellow-900 px-1 rounded font-mono" {...props}>
              {children}
            </code>
          );
        },
        p: ({ node, ...props }) => <p className="mb-2" {...props} />,
        a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-2 mb-1" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-4" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal mb-2 pl-6" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-yellow-300 pl-4 italic my-2" {...props} />,
      }}
      className="markdown-content text-yellow-900"
    >
      {content}
    </ReactMarkdown>
  );
};

const ChatWindow: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [client, setClient] = useState<ReturnType<any> | null>(null);
  const [responseReceived, setResponseReceived] = useState(false);

  const createAuthenticatedClient = async () => {
    return new ChatApiClient();
  };

  useEffect(() => {
    initializeSessionId();
  }, []);

  const initializeSessionId = () => {
    let storedSessionId = localStorage.getItem('sessionId');
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem('sessionId', storedSessionId);
    }
  };

  const resetSessionId = () => {
    const newSessionId = uuidv4();
    localStorage.setItem('sessionId', newSessionId);
    setMessages([]);
  };

  const initializeClient = async (): Promise<ChatApiClient | null> => {
    try {
      await configureAmplify();
      const newClient = await createAuthenticatedClient();
      setIsAuthenticated(true);
      setClient(newClient);
      return newClient;
    } catch (error) {
      console.error('Error initializing client:', error);
      setIsAuthenticated(false);
      return null;
    }
  };

  useEffect(() => {
   initializeClient();
  }, []);


  
  
  const renderMessageContent = (content: string) => {
    const processedContent = replaceTextEmotesWithEmojis(content);
    return <MarkdownRenderer content={processedContent} />;
  };

  

  useEffect(() => {
    let session_id = localStorage.getItem('sessionId');
    if (session_id == null) {
      session_id = uuidv4();
      localStorage.setItem('sessionId', session_id);
    }
  }, []);

  useEffect(() => {
    if (responseReceived && inputRef.current) {
      inputRef.current.focus();
      setResponseReceived(false); // Reset for next response
    }
  }, [responseReceived]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === '') return;

    let currentClient = client;

    if (!currentClient) {
      setRunning(true);
      currentClient = await initializeClient();
      setRunning(false);
      if (!currentClient) {
        setMessages(prevMessages => [
          ...prevMessages,
          {
            content: "Failed to initialize the chat client. Please try again or refresh the page.",
            sender: 'System',
            timestamp: new Date().toISOString(),
            isWaiting: false
          }
        ]);
        return;
      }
    }

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
      const response = await client.query('chat/query', inputMessage);

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulatedContent = "";
        let agentName = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          //console.log("chunk="+chunk)
          const lines = chunk.split('\n');

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
      setResponseReceived(true);
      setRunning(false);

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
    return <LoadingScreen text="Please wait..." />;
  }



  return (
    <div className="flex items-center justify-center min-h-screen">
      <Authenticator>
      {({ signOut: _signOut, user: _user }) => (
          <div className="flex flex-col h-[90vh] w-[70vw] bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-6 shadow-lg">
            <div className="text-center mb-6 relative">
       <h1 className="text-3xl font-bold text-yellow-900 mb-2">
         Multi-Agent Orchestrator Demo
       </h1>
       <button
         onClick={resetSessionId}
         className="absolute top-0 right-0 bg-yellow-700 hover:bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center text-sm transition-colors duration-200"
       >
         <RefreshCw size={24} />
       </button>
       <p className="text-lg text-yellow-800 mb-4">
         Experience the power of intelligent routing and context management
         across multiple AI agents.
       </p>
       <p className="text-md text-yellow-700 italic">
       Type "hello" or "bonjour" to see the available agents, or ask questions like "How do I use agents?", "How can I use the framework to create a custom agent?", "What are the steps to customize an agent?", and more!
       </p>
     </div>
            <div className="flex-grow bg-yellow-100 rounded-lg p-4 overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div key={index} className="mb-4">
                  <div className={`rounded-lg py-2 px-4 ${
                    msg.sender === "You" 
                      ? "bg-yellow-300 text-yellow-900 ml-auto" 
                      : "bg-yellow-200 text-yellow-900"
                  }`}>
                    <p className="text-xs font-semibold mb-1">{msg.sender}</p>
                    {msg.isWaiting ? (
                      <div className="flex flex-col items-center justify-center">
                        {/* Cooler animated loader - infinity loop icon */}
                        <div className="animate-spin">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 text-indigo-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12a7 7 0 0 1 14 0M12 5a7 7 0 0 1 0 14" />
                          </svg>
                        </div>

                        {/* Funny wait message */}
                        <p className="mt-2 text-gray-600 text-sm">
                          {getRandomWaitMessage()}
                        </p>
                      </div>
                    ) : (
                      <div className="markdown-wrapper">{renderMessageContent(msg.content)}</div>
                    )}


                    <p className="text-xs mt-1 text-yellow-700">
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
                className="bg-amber-600 text-white p-2 rounded-lg"
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
                  <Code2 size={24} className="mr-2" />
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
        )}
      </Authenticator>
    </div>

  );
};

export default ChatWindow;