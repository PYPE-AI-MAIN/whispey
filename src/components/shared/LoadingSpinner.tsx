import { Loader2 } from "lucide-react";

export default function LoadingSpinner() {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }