import React, { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyncAIChat } from "./components/syncai/SyncAIChat";
import { AuthScreen } from "./components/AuthScreen";
import { ModelsModal } from "./components/ModelsModal";
import {
  firebaseConfigured,
  onAuthChange,
  getIdToken,
  signOutUser,
  toProfile,
  type UserProfile,
} from "./services/firebaseClient";
import { setAuthToken } from "./services/syncAIService";

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setReady(true);
      return;
    }
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(toProfile(firebaseUser));
      setAuthToken(firebaseUser ? await getIdToken() : null);
      setReady(true);
    });
    return unsub;
  }, []);

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (firebaseConfigured && !user) {
    return (
      <TooltipProvider>
        <AuthScreen />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SyncAIChat
        user={user}
        onManageModels={() => setModelsOpen(true)}
        onSignOut={() => void signOutUser()}
      />
      <ModelsModal open={modelsOpen} onClose={() => setModelsOpen(false)} />
    </TooltipProvider>
  );
};

export default App;
