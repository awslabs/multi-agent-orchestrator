import axios from 'axios';

const handleSendMessage = async (message: string) => {
    try {
        setIsLoading(true);
        const response = await axios.post('http://localhost:8000/chat', {
            message,
            agent_id: selectedAgent?.id,
            knowledge_base: selectedKnowledgeBase?.id || null
        });
        
        if (response.data.response) {
            // Add the message to the chat
            addMessage({
                role: 'assistant',
                content: response.data.response
            });
        } else {
            // Handle empty response
            addMessage({
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please try again.'
            });
        }
    } catch (error: any) {
        console.error('Error sending message:', error);
        // Add a user-friendly error message to the chat
        addMessage({
            role: 'assistant',
            content: error.response?.data?.detail || 
                     'Sorry, the service is experiencing high load. Please try again in a few moments.'
        });
    } finally {
        setIsLoading(false);
    }
}; 