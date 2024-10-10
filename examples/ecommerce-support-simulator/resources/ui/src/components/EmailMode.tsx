import React from 'react';
import { Send } from 'lucide-react';

const EmailMode = ({
  fromEmail,
  setFromEmail,
  selectedTemplate,
  handleTemplateChange,
  customerMessage,
  setCustomerMessage,
  supportMessage,
  setSupportMessage,
  customerResponse,
  supportResponse,
  handleCustomerSubmit,
  handleSupportSubmit,
  emailTemplates
}) => {
  const submitCustomerEmail = (e: any) => {
    e.preventDefault();
    if (customerMessage.trim() === '') return;
    const newMessage = {
      content: customerMessage,
      destination: 'customer',
      source: 'ui',
      timestamp: new Date().toISOString()
    };
    handleCustomerSubmit(newMessage);
  };

  const submitSupportEmail = (e: any) => {
    e.preventDefault();
    if (supportMessage.trim() === '') return;
    const newMessage = {
      content: supportMessage,
      destination: 'support',
      source: 'ui',
      timestamp: new Date().toISOString()
    };
    handleSupportSubmit(newMessage);
  };

  const isCustomerMessageEmpty = customerMessage.trim() === '';
  const isSupportMessageEmpty = supportMessage.trim() === '';

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Customer Email */}
      <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-6 shadow-lg flex flex-col h-full">
        <h2 className="text-2xl font-bold text-yellow-900 mb-4">Customer Email</h2>
        <div className="flex flex-col flex-grow">
          <form onSubmit={submitCustomerEmail} className="flex flex-col flex-grow">
            <div className="mb-2">
              <label className="block text-sm font-medium text-yellow-900 mb-1">From:</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full p-2 rounded-lg"
                required
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-yellow-900 mb-1">Template:</label>
              <select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full p-2 rounded-lg"
              >
                {Object.entries(emailTemplates).map(([key, value]) => (
                  <option key={key} value={key}>{String(value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-grow mb-4">
              <label className="block text-sm font-medium text-yellow-900 mb-1">Message:</label>
              <textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                className="w-full p-2 rounded-lg h-full min-h-[120px] resize-none"
                required
              />
            </div>
            <div className="mt-4"> {/* Added margin top here */}
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center text-lg py-2 px-4 rounded-lg ${
                  isCustomerMessageEmpty 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
                disabled={isCustomerMessageEmpty}
              >
                <Send size={20} className="mr-2" />
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="mt-4 bg-yellow-100 p-4 rounded-lg h-32 overflow-auto">
          <h3 className="font-semibold mb-2">Response:</h3>
          <p>{customerResponse}</p>
        </div>
      </div>

      {/* Support Email */}
      <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-6 shadow-lg flex flex-col h-full">
        <h2 className="text-2xl font-bold text-red-900 mb-4">Support Email</h2>
        <div className="flex flex-col flex-grow">
          <form onSubmit={submitSupportEmail} className="flex flex-col flex-grow">
            <div className="flex-grow mb-4">
              <label className="block text-sm font-medium text-red-900 mb-1">Message:</label>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="w-full p-2 rounded-lg h-full min-h-[120px] resize-none"
                required
              />
            </div>
            <div className="mt-4"> {/* Added margin top here */}
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center text-lg py-2 px-4 rounded-lg ${
                  isSupportMessageEmpty 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
                disabled={isSupportMessageEmpty}
              >
                <Send size={20} className="mr-2" />
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="mt-4 bg-red-100 p-4 rounded-lg h-32 overflow-auto">
          <h3 className="font-semibold mb-2">Response:</h3>
          <p>{supportResponse}</p>
        </div>
      </div>
    </div>
  );
};

export default EmailMode;