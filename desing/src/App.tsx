import { useState } from "react";
import { Login } from "./components/Login";
import { Home } from "./components/Home";
import { DiscountCode } from "./components/DiscountCode";
import { Validation } from "./components/Validation";
import { Statistics } from "./components/Statistics";
import { Technician } from "./components/Technician";
import { Navigation } from "./components/Navigation";
import { Toaster } from "./components/ui/sonner";

type Screen =
  | "login"
  | "home"
  | "discount"
  | "validation"
  | "statistics"
  | "technician";
type UserRole = "member" | "manager" | "admin";

export default function App() {
  const [currentScreen, setCurrentScreen] =
    useState<Screen>("login");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("member");

  const handleLogin = (email: string) => {
    setUserEmail(email);

    // Mock role assignment based on email
    if (email.includes("admin")) {
      setUserRole("admin");
    } else if (email.includes("manager")) {
      setUserRole("manager");
    } else {
      setUserRole("member");
    }

    setCurrentScreen("home");
  };

  const handleLogout = () => {
    setUserEmail("");
    setUserRole("member");
    setCurrentScreen("login");
  };

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as Screen);
  };

  const handleBack = () => {
    setCurrentScreen("home");
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "login":
        return <Login onLogin={handleLogin} />;

      case "home":
        return (
          <Home
            userEmail={userEmail}
            onNavigateToDiscount={() =>
              setCurrentScreen("discount")
            }
          />
        );

      case "discount":
        return <DiscountCode onBack={handleBack} />;

      case "validation":
        return <Validation onBack={handleBack} />;

      case "statistics":
        return <Statistics onBack={handleBack} />;

      case "technician":
        return <Technician onBack={handleBack} />;

      default:
        return (
          <Home
            userEmail={userEmail}
            onNavigateToDiscount={() =>
              setCurrentScreen("discount")
            }
          />
        );
    }
  };

  return (
    <div className="min-h-screen relative">
      {renderScreen()}

      {currentScreen === "home" && (
        <Navigation
          currentScreen={currentScreen}
          userRole={userRole}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}

      <Toaster />
    </div>
  );
}