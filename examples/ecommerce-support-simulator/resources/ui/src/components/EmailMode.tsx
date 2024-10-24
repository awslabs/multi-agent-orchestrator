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
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Email</h2>
        <div className="flex flex-col flex-grow">
          <form onSubmit={submitCustomerEmail} className="flex flex-col flex-grow">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">From:</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Template:</label>
              <select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
              >
                {Object.entries(emailTemplates).map(([key, value]) => (
                  <option key={key} value={key}>{String(value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-grow mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
              <textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 h-full min-h-[120px] resize-none"
                required
              />
            </div>
            <div className="mt-4">
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center text-lg py-2 px-4 rounded-lg transition-colors duration-200 ${
                  isCustomerMessageEmpty 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={isCustomerMessageEmpty}
              >
                <Send size={20} className="mr-2" />
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded-lg h-32 overflow-auto">
          <h3 className="font-semibold mb-2 text-gray-900">Response:</h3>
          <p className="text-gray-700">{customerResponse}</p>
        </div>
      </div>

      {/* Support Email */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Support Email</h2>
        <div className="flex flex-col flex-grow">
          <form onSubmit={submitSupportEmail} className="flex flex-col flex-grow">
            <div className="flex-grow mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 h-full min-h-[120px] resize-none"
                required
              />
            </div>
            <div className="mt-4">
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center text-lg py-2 px-4 rounded-lg transition-colors duration-200 ${
                  isSupportMessageEmpty 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={isSupportMessageEmpty}
              >
                <Send size={20} className="mr-2" />
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded-lg h-32 overflow-auto">
          <h3 className="font-semibold mb-2 text-gray-900">Response:</h3>
          <p className="text-gray-700">{supportResponse}</p>
        </div>
      </div>
    </div>
  );
};

export default EmailMode;