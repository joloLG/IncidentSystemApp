"use client"

import { useState, useEffect } from "react"
import { RegisterPage } from "./components/register-page"
import { LoginPage } from "./components/login-page"
import { RoleSelection } from "./components/role-selection"
import { Dashboard } from "./components/dashboard"
import { AdminDashboard } from './components/admin-dashboard'
import { SuperadminDashboard } from "./components/superadmin-dashboard"
import AdminRealtimeOverlay from "@/components/admin/AdminRealtimeOverlay"
import { supabase } from "@/lib/supabase"
import { robustSignOut } from "@/lib/auth"

export default function MobileApp() {
  const [currentScreen, setCurrentScreen] = useState<
    | "login"
    | "register"
    | "role-selection"
    | "dashboard"
    | "admin"
    | "superadmin"
  >("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [selectedRoleData, setSelectedRoleData] = useState<any>(null)

  useEffect(() => {
    // Check for active session conflict redirect
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'active_session_conflict') {
        try { localStorage.setItem('mdrrmo_login_error', 'active_session_exists') } catch {}
        // Best-effort sign-out to clear any partial state
        supabase.auth.signOut().catch(() => {})
        setUserData(null)
        setIsLoggedIn(false)
        setCurrentScreen("login")
      }
    } catch {}

    // Check if user is already logged in and automatically redirect
    const storedUser = localStorage.getItem("mdrrmo_user")
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserData(user)
        setIsLoggedIn(true)
        // Automatically set screen based on user type if logged in
        if (user.user_type === "superadmin") {
          setCurrentScreen("superadmin")
        } else if (user.user_type === "admin") {
          setCurrentScreen("admin")
        } else {
          setCurrentScreen("dashboard")
        }
      } catch (parseError) {
        console.error("Error parsing stored user data in MobileApp:", parseError);
        // If data is corrupted, clear it and force login
        localStorage.removeItem("mdrrmo_user");
        setIsLoggedIn(false);
        setUserData(null);
        setCurrentScreen("login"); // Fallback to login if parsing fails
      }
    } else {
      setCurrentScreen("login"); // Ensure it starts at login if no user is found
    }
  }, []) // Empty dependency array to run only once on mount

  // Handle successful registration
  const handleRegistrationSuccess = () => {
    setCurrentScreen("login")
  }

  // Handle successful login
  const handleLoginSuccess = (user: any) => {
    setUserData(user)
    setIsLoggedIn(true)
    if (user.user_type === "superadmin") {
      setCurrentScreen("superadmin")
    } else if (user.user_type === "admin") {
      setCurrentScreen("admin")
    } else {
      setCurrentScreen("dashboard")
    }
  }

  // Handle navigation to register
  const handleGoToRegister = () => {
    setCurrentScreen("register")
  }

  // Handle navigation to login
  const handleGoToLogin = () => {
    setCurrentScreen("login")
  }

  // Handle role selection
  const handleRoleSelected = (roleData: any) => {
    setSelectedRoleData(roleData)
    setCurrentScreen("register")
  }

  // Handle navigation to role selection
  const handleGoToRoleSelection = () => {
    setCurrentScreen("role-selection")
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await robustSignOut()
    } finally {
      // Reset UI regardless
      setUserData(null)
      setIsLoggedIn(false)
      setCurrentScreen("login")
    }
  }

  // If user is logged in, show appropriate dashboard
  if (isLoggedIn) {
    if (userData?.user_type === "superadmin") {
      return (
        <>
          <AdminRealtimeOverlay />
          <SuperadminDashboard onLogoutAction={handleLogout} />
        </>
      )
    } else if (userData?.user_type === "admin") {
      return (
        <>
          <AdminRealtimeOverlay />
          <AdminDashboard onLogout={handleLogout} userData={userData} />
        </>
      )
    } else {
      return <Dashboard onLogout={handleLogout} userData={userData} />
    }
  }

  // Show login or register based on current screen
  switch (currentScreen) {
    case "role-selection":
      return <RoleSelection onRoleSelected={handleRoleSelected} onBack={handleGoToLogin} />
    case "register":
      return <RegisterPage
        onRegistrationSuccess={handleRegistrationSuccess}
        onGoToLogin={handleGoToLogin}
        selectedRoleData={selectedRoleData}
      />
    case "login":
    default:
      return <LoginPage 
        onLoginSuccess={handleLoginSuccess} 
        onGoToRegister={handleGoToRegister}
        onGoToRoleSelection={handleGoToRoleSelection}
      />
  }
}