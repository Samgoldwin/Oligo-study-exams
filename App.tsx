import React, { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyncAIChat } from "./components/syncai/SyncAIChat";
import { AuthScreen } from "./components/AuthScreen";
import { ModelsModal } from "./components/ModelsModal";
import {
  firebaseConfigured,
  onAuthChange,
  getIdToken,
} from "./services/firebaseClient";
import { setAuthToken } from "./services/syncAIService";

const App: React.FC = () => {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [guest, setGuest] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setReady(true);
      return;
    }
    const unsub = onAuthChange(async (user) => {
      setUserUid(user?.uid ?? null);
      setAuthToken(user ? await getIdToken() : null);
      setReady(true);
    });
    return unsub;
  }, []);

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (firebaseConfigured && !userUid && !guest) {
    return (
      <TooltipProvider>
        <AuthScreen onCancelled={() => setGuest(true)} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SyncAIChat
        userUid={userUid}
        onManageModels={() => setModelsOpen(true)}
      />
      <ModelsModal open={modelsOpen} onClose={() => setModelsOpen(false)} />
    </TooltipProvider>
  );
};

export default App;
