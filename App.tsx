import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Navigation from "./components/Navigation";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Directory from "./pages/Directory";
import Superlatives from "./pages/Superlatives";
import Notifications from "./pages/Notifications";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import Messages from "./pages/Messages";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && <Navigation />}
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/feed"}>
          {() => (isAuthenticated ? <Feed /> : <Home />)}
        </Route>
        <Route path={"/profile/:userId?"}>
          {(params) => (isAuthenticated ? <Profile /> : <Home />)}
        </Route>
        <Route path={"/directory"}>
          {() => (isAuthenticated ? <Directory /> : <Home />)}
        </Route>
        <Route path={"/superlatives"}>
          {() => (isAuthenticated ? <Superlatives /> : <Home />)}
        </Route>
        <Route path={"/notifications"}>
          {() => (isAuthenticated ? <Notifications /> : <Home />)}
        </Route>
        <Route path={"/messages"}>
          {() => (isAuthenticated ? <Messages /> : <Home />)}
        </Route>
        <Route path={"/events"}>
          {() => (isAuthenticated ? <Events /> : <Home />)}
        </Route>
        <Route path={"/events/:eventId"}>
          {(params) => (isAuthenticated ? <EventDetails /> : <Home />)}
        </Route>
        <Route path={"/privacy"} component={PrivacyPolicy} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
