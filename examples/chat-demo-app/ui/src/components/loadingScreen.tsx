import { Loader2 } from 'lucide-react';

const LoadingScreen = ({ text = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center text-yellow-900">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-4" size={48} />
        <p className="text-gray-700 text-xl font-semibold">{text}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;