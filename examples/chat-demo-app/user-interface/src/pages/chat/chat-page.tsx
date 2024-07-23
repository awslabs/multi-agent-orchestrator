import { useEffect, useState } from "react";
import BaseAppLayout from "../../components/base-app-layout";
import { ChatUI } from "../../components/chat-ui/chat-ui";
import { ChatMessage, ChatMessageType } from "../../components/chat-ui/types";
import { Container, ContentLayout, SpaceBetween } from "@cloudscape-design/components";
import ChatHeader from "./chat-header";
import { StorageHelper } from "../../common/helpers/storage-helper";
import {v4 as uuidv4} from 'uuid';
import { ApiClient } from "../../common/api-client/api-client"


export default function ChatPage() {
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [sessionId, setSessionId] = useState("");
  const apiClient = new ApiClient();

  useEffect(() => {
    if (sessionId == "") {
      // retrieve sessionId
      let session_id = StorageHelper.getItem('sessionId')
      if (session_id == null) {
        // sessionId was never set, create one
        session_id = uuidv4()
        // store it
        StorageHelper.setItem('sessionId', session_id.toString())
      }
      setSessionId(session_id.toString());
      // (async () => {
      //   const items = await apiClient.history.getHistory(session_id.toString());
      //   setMessages(items);
      //   setRunning(false);
      // })
      // ();
    }
  }, [userMessage]); // Empty dependency array ensures effect runs only once

  const sendQuery = async (message: string) => {
    console.log(`call backend with: ${message}`);
    // start indicating that bot is processing the query
    setMessages((prevMessages:any) => [
      ...prevMessages,
      {
        type: ChatMessageType.AI,
        message: "",
        timestamp: Date.now()
      }])

    setCurrentResponse('');
    
      try {

        

      const response = await apiClient.chat.query('chat/query', message);

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || "Network response was not ok");
      }

      if (response.body === null) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let agentName = '';
      let currentResponse = '';
      let accumulatedContent = "";


      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsedLine = JSON.parse(line);
            //console.log("data="+JSON.stringify(parsedLine))
            switch (parsedLine.type) {
              case 'metadata':
                agentName = parsedLine.data.metadata.agentName;
                console.log("agentName="+agentName);
                //accumulatedContent=agentName+
                accumulatedContent = `## ${agentName}\n\n`;
                // You can handle other metadata here if needed
                break;
              case 'chunk':
                currentResponse = parsedLine.data;
                console.log("chunk="+currentResponse);
                accumulatedContent += currentResponse;

                //updateAssistantMessage(currentResponse, agentName);
                break;
              case 'complete':
                currentResponse = parsedLine.data;
                console.log("complete="+currentResponse);
                accumulatedContent += currentResponse;
        
                break;
              case 'error':
                console.error('Error:', parsedLine.data);
                console.log("Error"+ parsedLine.data);

                break;
            }

            setMessages((prevMessages:any) => [
              ...prevMessages.slice(0, prevMessages.length - 1), // Copy all but the last item
              {
                ...prevMessages[prevMessages.length - 1], // Copy the last item
                message: accumulatedContent // Update the message property
              }
            ]);

          } catch (error) {
            console.error('Error parsing JSON:', error);
          }
        }
      }

        

      } catch (error:any) {
        setMessages((prevMessages:any) => [
          ...prevMessages.slice(0, prevMessages.length - 1), // Copy all but the last item
          {
            ...prevMessages[prevMessages.length - 1], // Copy the last item
            message: error.message // Update the message property
          }
        ]);
      }
    
  };

  const sendMessage = async (message: string) => {
    setRunning(true);
    setUserMessage(message);
    setMessages((prevMessages:any) => [
      ...prevMessages,{
        type: ChatMessageType.Human,
        message: message,
        timestamp: Date.now()
      }
    ])
    sendQuery(message);
    setRunning(false);
  };

  const onRefreshSession = () => {
    setRunning(true);
    // generate new sessionId
    const newSessionId = uuidv4();
    // save it
    StorageHelper.setItem('sessionId', sessionId.toString());
    setSessionId(newSessionId);
    setMessages([]);
    setUserMessage("");
    setRunning(false);
  }

  return (
    <BaseAppLayout
      content={        
        <ContentLayout header={<ChatHeader onRefreshSession={onRefreshSession}/>}>
        <Container variant="stacked">
          <SpaceBetween size="xs">
            <ChatUI
              onSendMessage={sendMessage}
              messages={messages}
              running={running}
            />
          </SpaceBetween>
        </Container>  
        </ContentLayout>
      }
    />
  );
}
