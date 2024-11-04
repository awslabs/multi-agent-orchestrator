import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { Send, Code2, BookOpen, RefreshCw } from 'lucide-react';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { generateClient, type GraphQLSubscription } from 'aws-amplify/api';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import ChatMode from './ChatMode';
import EmailMode from './EmailMode';
import type { Message } from '../types';
import { configureAmplify, getAuthToken } from '../utils/amplifyConfig';


const sendCustomerMessage = /* GraphQL */ `
  query SendMessage($source: String!, $message: String!, $sessionId: String!) {
    sendMessage(source: $source, message: $message, sessionId: $sessionId) {
      MessageId
    }
  }
`;

const onResponseReceivedSubscription = /* GraphQL */ `
  subscription OnResponseReceived {
    onResponseReceived {
      destination
      message
    }
  }
`;

type OnResponseReceivedSubscription = {
  onResponseReceived: {
    message: string;
    destination: string;
  };
};

const generateSessionId = () => Math.random().toString(36).substring(2, 15);

const SupportSimulator = () => {


  const [customerMessage, setCustomerMessage] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [supportResponse, setSupportResponse] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fromEmail, setFromEmail] = useState('customer@example.com');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatMode, setIsChatMode] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [client, setClient] = useState<ReturnType<typeof generateClient> | null>(null);
  const [isBehindScenesOpen, setIsBehindScenesOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);


  const createAuthenticatedClient = async () => {
    await configureAmplify();
    const token = await getAuthToken();

    return generateClient({
      authMode: 'userPool',
      authToken: token,
    });
  };

  useEffect(() => {

    const initializeAuth = async () => {
      await configureAmplify();
      try {
        await getCurrentUser();
        setIsAuthenticated(true);
        console.log('Creating client')
        const newClient = await createAuthenticatedClient();
        setClient(newClient);
      } catch (error) {
        console.log('Not authenticated', error);
        setIsAuthenticated(false);
      }
    };

    const loadSavedStates = () => {
      try {
        const savedMode = localStorage.getItem('isChatMode');
        const savedSessionId = localStorage.getItem('sessionId');

        if (savedMode !== null) {
          setIsChatMode(JSON.parse(savedMode));
        }

        if (savedSessionId) {
          setSessionId(savedSessionId);
        } else {
          const newSessionId = generateSessionId();
          setSessionId(newSessionId);
          localStorage.setItem('sessionId', newSessionId);
        }

      } catch (error) {
        console.error('Failed to load saved states:', error);
      }
    };

    initializeAuth();
    loadSavedStates();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('isChatMode', JSON.stringify(isChatMode));
      localStorage.setItem('sessionId', sessionId);
    } catch (error) {
      console.error('Failed to save states:', error);
    }
  }, [isChatMode, sessionId]);

  useEffect(() => {

    if (!client) return;

    const subscription = client.graphql<GraphQLSubscription<OnResponseReceivedSubscription>>({
      query: onResponseReceivedSubscription
    });

    const sub = subscription.subscribe({
      next: ({ data }) => {
        console.log("data=" + JSON.stringify(data));
        if (data?.onResponseReceived?.message) {
          const { destination, message } = data.onResponseReceived;
          const newMessage = {
            content: message,
            destination,
            source: 'backend',
            timestamp: new Date().toISOString(),
          };

          setMessages((prevMessages: Message[]) => [...prevMessages, newMessage as Message]);

          if (destination === 'customer') {
            setCustomerResponse(message);
          } else if (destination === 'support') {
            setSupportResponse(message);
          }else if (destination === 'log') {
            addLog(message);
          }


        }
      },
      error: (error: any) => console.warn(error),
    });

    return () => {
      sub.unsubscribe();
    };
  }, [client]);



  const toggleMode = () => {
    setIsChatMode(prevMode => !prevMode);
  };


  const addLog = (message: string) => {
    setLogs(prevLogs => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleTemplateChange = (e: any) => {
    setSelectedTemplate(e.target.value);
    setCustomerMessage(emailTemplates[e.target.value]);
  };

  const sendMessage = async (source: string, message: string, setResponse: React.Dispatch<React.SetStateAction<string>>, setMessage: React.Dispatch<React.SetStateAction<string>>) => {
    addLog(`Sending ${source} message to backend...`);
    console.log(`Sending ${source} message to backend...`)
    let localClient;

    if (!client) {
      console.error('GraphQL client is not initialized');
      localClient = await createAuthenticatedClient();
      setClient(localClient);
    }
    else {
      localClient = client
    }
    try {
      const response = await localClient.graphql({
        query: sendCustomerMessage,
        variables: {
          source: source,
          message: message,
          sessionId: sessionId
        }
      });

      console.log("response=" + JSON.stringify(response));
      addLog(`${source} message sent successfully, waiting for response...`);

      if (source === "customer") {
        setCustomerResponse("");
      } else if (source === "support") {
        setSupportResponse("");
      }

      setMessage('');
    } catch (error) {
      console.error(`Error sending ${source} message:`, error);
      setResponse('Error processing your request. Please try again.');
    }
  };

  const handleCustomerSubmit = (newMessage: Message) => {
    setMessages((prevMessages: Message[]) => [...prevMessages, newMessage]);
    sendMessage('customer', newMessage.content, setCustomerResponse, setCustomerMessage);
  };


  const handleSupportSubmit = (newMessage: Message) => {
    setMessages((prevMessages: Message[]) => [...prevMessages, newMessage]);
    sendMessage('support', newMessage.content, setSupportResponse, setSupportMessage);
  };

  const handleReset = () => {
    setCustomerMessage('');
    setSupportMessage('');
    setCustomerResponse('');
    setSupportResponse('');
    setLogs([]);
    setShowLogs(false);
    setMessages([]);

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
  };

  const emailTemplates = {
    '': 'Select a template or write your own',
    'order_status': 'Hello, I would like to check the status of my order #12345.',
    'return_request': 'I need to return an item from my recent order. Can you help me with the process?',
    'product_inquiry': 'I have a question about the product XYZ. Can you provide more information?'
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      setClient(null);
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };


  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }


  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div className="min-h-screen w-full bg-slate-50 p-4 flex flex-col items-center">
          <div className="w-full max-w-6xl bg-white rounded-2xl p-8 flex flex-col shadow-lg border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-blue-600 mb-4">
              AI-Powered E-commerce Support Simulator
              </h1>
              <p className="text-lg text-gray-700 mb-3">
              Experience the future of customer support with our multi-agent AI system.
              </p>
              <p className="text-md text-gray-600 italic mb-0">
              Try asking "Where is my order?" or "I want to return an item" to see how our AI handles customer support inquiries!
              </p>
            </div>
  
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={toggleMode}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold p-3 rounded-lg transition-all duration-200 flex items-center border border-blue-200"
              >
                {isChatMode ? <Mail size={24} /> : <MessageSquare size={24} />}
                <span className="ml-2">{isChatMode ? 'Email Mode' : 'Chat Mode'}</span>
              </button>
              <button
                onClick={handleReset}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold p-3 rounded-lg transition-all duration-200 border border-blue-200"
              >
                <RefreshCw size={24} />
              </button>
            </div>
  
            <div className="flex justify-between mb-4">
              <div className="w-1/2 pr-2">
                <p className="text-gray-900 text-center font-semibold mb-2">
                  Customer Interface
                </p>
                <p className="text-gray-600 text-sm text-center italic">
                  Customer's view of the interaction
                </p>
              </div>
              <div className="w-1/2 pl-2">
                <p className="text-gray-900 text-center font-semibold mb-2">
                  Support Center Interface
                </p>
                <p className="text-gray-600 text-sm text-center italic">
                  Human agent's view and responses
                </p>
              </div>
            </div>
  
            {isChatMode ? (
              <ChatMode
                messages={messages}
                customerMessage={customerMessage}
                setCustomerMessage={setCustomerMessage}
                supportMessage={supportMessage}
                setSupportMessage={setSupportMessage}
                handleCustomerSubmit={handleCustomerSubmit}
                handleSupportSubmit={handleSupportSubmit}
              />
            ) : (
              <EmailMode
                fromEmail={fromEmail}
                setFromEmail={setFromEmail}
                selectedTemplate={selectedTemplate}
                handleTemplateChange={handleTemplateChange}
                customerMessage={customerMessage}
                setCustomerMessage={setCustomerMessage}
                supportMessage={supportMessage}
                setSupportMessage={setSupportMessage}
                customerResponse={customerResponse}
                supportResponse={supportResponse}
                handleCustomerSubmit={handleCustomerSubmit}
                handleSupportSubmit={handleSupportSubmit}
                emailTemplates={emailTemplates}
              />
            )}
  
            {showLogs && (
              <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Logs:</h3>
                <ul className="list-disc pl-5 text-gray-700">
                  {logs.map((log, index) => (
                    <li key={index}>{log}</li>
                  ))}
                </ul>
              </div>
            )}
  
            {/* Behind the Scenes Section */}
            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setIsBehindScenesOpen(!isBehindScenesOpen)}
                className="w-full flex justify-between items-center p-4 text-gray-900 font-semibold focus:outline-none hover:bg-gray-100 transition-colors duration-200"
              >
                <span className="text-xl">Behind the Scenes</span>
                {isBehindScenesOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </button>
              {isBehindScenesOpen && (
                <div className="p-4 bg-white border-t border-gray-200 font-mono text-xs overflow-y-auto max-h-60 text-gray-700">
                  {logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
  
            <div className="text-center mt-6">
              <a
                href="/mock_data.json"
                target='_blank'
                className="text-blue-600 hover:text-blue-700 text-sm underline transition-colors duration-200"
              >
                Access mock data for simulation
              </a>
            </div>
  
            <div className="text-center text-slate-900">
              <p className="mb-2">To learn more about the Multi-Agent Orchestrator:</p>
              <div className="flex justify-center space-x-4">
                <a
                  href="https://github.com/awslabs/multi-agent-orchestrator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2 px-4 rounded-lg transition-all duration-300"
                >
                  <Code2 size={24} className="mr-2 text-blue-700" />
                  GitHub Repo
                </a>
                <a
                  href="https://awslabs.github.io/multi-agent-orchestrator/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2 px-4 rounded-lg transition-all duration-300"
                >
                  <BookOpen size={24} className="mr-2 text-blue-700" />
                  Documentation
                </a>
                <a
                  href="https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/ecommerce-support-simulator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2 px-4 rounded-lg transition-all duration-300"
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    className="w-6 h-6 mr-2 text-blue-700"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                    <polyline points="7.5 19.79 7.5 14.6 3 12" />
                    <polyline points="21 12 16.5 14.6 16.5 19.79" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  Deploy this app!
                </a>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="mt-6 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 self-center"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </Authenticator>
  );
};

export default SupportSimulator;


