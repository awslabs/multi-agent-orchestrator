import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { Send, Loader, Github, BookOpen } from 'lucide-react';

import { generateClient, type GraphQLSubscription } from 'aws-amplify/api';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import ChatMode from './ChatMode'; 
import EmailMode from './EmailMode';
import type { Message } from '../types';
//const client = generateClient();
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
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fromEmail, setFromEmail] = useState('customer@example.com');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatMode, setIsChatMode] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [client, setClient] = useState<ReturnType<typeof generateClient> | null>(null);


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
    console.log("SUBSCRIBE")
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
          }
  
          addLog(`Received response from AI for ${destination}`);
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
    if (!client) {
      console.error('GraphQL client is not initialized');
      setResponse('Error: GraphQL client is not initialized. Please try again.');
      return;
    }
    try {


      const response = await client.graphql({
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

    <div className="min-h-screen w-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-4 flex flex-col items-center">
  <h1 className="text-4xl font-bold text-yellow-100 text-center mb-8 mt-4 drop-shadow-lg">AI-Powered E-commerce Support Simulator</h1>
  
  <div className="w-full max-w-6xl bg-orange-100 bg-opacity-10 backdrop-blur-md rounded-3xl p-8 flex flex-col shadow-2xl">
    <div className="flex justify-between items-center mb-4">
      <button
        onClick={toggleMode}
        className="bg-yellow-400 hover:bg-yellow-500 text-orange-900 font-bold p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 flex items-center"
      >
        {isChatMode ? <Mail size={24} /> : <MessageSquare size={24} />}
        <span className="ml-2">{isChatMode ? 'Email Mode' : 'Chat Mode'}</span>
      </button>
      <button
        onClick={handleReset}
        className="bg-yellow-400 hover:bg-yellow-500 text-orange-900 font-bold p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110"
      >
        <RefreshCw size={24} />
      </button>
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
      <div className="mt-4 bg-gray-100 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Logs:</h3>
        <ul className="list-disc pl-5">
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    )}
    <div className="text-center text-yellow-100 mt-8 p-6 bg-orange-600 bg-opacity-30 rounded-xl shadow-lg">
    <p className="mb-4 text-xl font-semibold">To learn more about the Multi-Agent Orchestrator:</p>
    <div className="flex justify-center space-x-6">
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
    {/* Sign Out Button */}
    <button
      onClick={handleSignOut}
      className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-300 self-center"
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


