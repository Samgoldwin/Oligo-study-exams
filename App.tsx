import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyncAIChat } from "./components/syncai/SyncAIChat";

const App: React.FC = () => {
  return (
    <TooltipProvider>
      <SyncAIChat />
    </TooltipProvider>
  );
};

export default App;
