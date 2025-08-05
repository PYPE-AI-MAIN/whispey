import { Loader2 } from "lucide-react";

export default function LoadingSpinner() {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }