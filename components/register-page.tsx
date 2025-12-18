"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff, AlertCircle, Check, X, UserPlus, Shield, XCircle, AlertTriangle, Lock, Languages, ScrollText } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

interface RegisterPageProps {
  onRegistrationSuccess: () => void
  onGoToLogin: () => void
  selectedRoleData?: {
    category: 'hospital' | 'er_team'
    hospitalId?: string
    erTeamId?: string
  }
}

export function RegisterPage({ onRegistrationSuccess, onGoToLogin, selectedRoleData }: RegisterPageProps) {
  const OTP_ENABLED = false
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    username: "",
    birthday: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "", // Added confirm password field
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [language, setLanguage] = useState<'en' | 'tl'>('tl')
  const [readingProgress, setReadingProgress] = useState(0)
  const [requestedRole, setRequestedRole] = useState<'user' | 'admin' | 'hospital'>('user')

  // Initialize with selected role data if provided
  useEffect(() => {
    if (selectedRoleData) {
      if (selectedRoleData.category === 'hospital') {
        setRequestedRole('hospital')
      } else if (selectedRoleData.category === 'er_team') {
        setRequestedRole('admin') // ER team members request admin access
      }
    }
  }, [selectedRoleData])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [ageVerified, setAgeVerified] = useState(false)
  const [mobileNumberError, setMobileNumberError] = useState<string | null>(null);
  const [otpMessageId, setOtpMessageId] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isOtpVerified, setIsOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [otpSuccess, setOtpSuccess] = useState("")
  const [resendTimer, setResendTimer] = useState(0)

  const translations = {
    en: {
      title: "Terms and Conditions",
      description: "Please read these terms and conditions carefully before using our service.",
      sections: [
        {
          title: "1. Account Registration",
          content: "You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.",
          icon: UserPlus
        },
        {
          title: "2. User Responsibilities",
          content: "You agree to use this service only for legitimate emergency reporting purposes. You must not use false information or impersonate others.",
          icon: Shield
        },
        {
          title: "3. Prohibited Activities",
          content: "Creating fake or misleading emergency reports, Using the service for non-emergency purposes, Harassing or abusing other users or emergency responders, Violating any laws or regulations",
          icon: XCircle
        },
        {
          title: "4. Consequences of Misuse",
          content: "Any violation of these terms may result in immediate account suspension or termination, and may be reported to the appropriate authorities.",
          icon: AlertTriangle
        },
        {
          title: "5. Privacy",
          content: "Your personal information will be handled in accordance with our Privacy Policy. Emergency reports may be shared with appropriate authorities as needed.",
          icon: Lock
        }
      ],
      close: "Close",
      accept: "I Accept"
    },
    tl: {
      title: "Mga Tuntunin at Kundisyon",
      description: "Mangyaring basahin ang mga tuntunin at kundisyon na ito nang mabuti bago gamitin ang aming serbisyo.",
      sections: [
        {
          title: "1. Pagrehistro ng Account",
          content: "Kailangan mong magbigay ng tumpak at kumpletong impormasyon sa paglikha ng account. Ikaw ang responsable sa pagpapanatili ng pagiging kumpidensyal ng iyong mga kredensyal sa account.",
          icon: UserPlus
        },
        {
          title: "2. Mga Responsibilidad ng User",
          content: "Sumasang-ayon kang gamitin ang serbisyo na ito lamang para sa lehitimong layunin ng pag-uulat ng emerhensiya. Hindi ka dapat gumamit ng maling impormasyon o magpanggap na iba.",
          icon: Shield
        },
        {
          title: "3. Mga Pinagbabawal na Gawain",
          content: "Paglikha ng pekeng o mapanlinlang na mga ulat ng emerhensiya, Paggamit ng serbisyo para sa mga layuning hindi emerhensiya, Pag-harass o pag-abuso sa ibang mga user o responder ng emerhensiya, Paglabag sa anumang mga batas o regulasyon",
          icon: XCircle
        },
        {
          title: "4. Mga Konsekwensya ng Maling Paggamit",
          content: "Ang anumang paglabag sa mga tuntunin na ito ay maaaring magresulta sa agarang suspensyon o pagtatapos ng account, at maaaring ireport sa mga naaangkop na awtoridad.",
          icon: AlertTriangle
        },
        {
          title: "5. Privacy",
          content: "Ang iyong personal na impormasyon ay haharapin ayon sa aming Patakaran sa Privacy. Ang mga ulat ng emerhensiya ay maaaring ibahagi sa mga naaangkop na awtoridad kung kinakailangan.",
          icon: Lock
        }
      ],
      close: "Isara",
      accept: "Tinatanggap Ko"
    }
  }

  // Derived validations for password and confirmation
  const password = formData.password
  const confirmPassword = formData.confirmPassword
  const passwordTooShort = password.length > 0 && password.length < 6
  const passwordMissingUpper = password.length > 0 && !/[A-Z]/.test(password)
  const passwordMissingNumber = password.length > 0 && !/[0-9]/.test(password)
  const passwordMissingSpecial = password.length > 0 && !/[^a-zA-Z0-9]/.test(password)
  const passwordInvalid = password.length > 0 && (passwordTooShort || passwordMissingUpper || passwordMissingNumber || passwordMissingSpecial)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  // Rule booleans for checklist
  const hasMinLength = password.length >= 6
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
    setSuccess("")
    if (field === "mobileNumber") {
      setOtpMessageId(null)
      setOtpCode("")
      setIsOtpVerified(false)
      setOtpError("")
      setOtpSuccess("")
      setResendTimer(0)
    }
  }

  const handleRegister = async () => {
    // Basic validation for required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.mobileNumber ||
      !formData.birthday
    ) {
      setError("Please fill in all required fields")
      return
    }

    // Age verification (12+ years old)
    const age = calculateAge(formData.birthday);
    if (age < 12) {
      setError("You must be at least 12 years old to register.")
      return
    }
    
    // Terms and conditions check
    if (!acceptedTerms) {
      setError("You must accept the terms and conditions to register.")
      return
    }

    // Password match validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Mobile number validation
    if (!/^09\d{9}$/.test(formData.mobileNumber)) {
      setError("Please provide a valid mobile number starting with 09 (11 digits).");
      setMobileNumberError("A valid PH mobile number is required.");
      return;
    }

    // Password policy validation
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter.")
      return
    }
    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number.")
      return
    }
    // Regex to check for special characters (anything not a letter, number, or common punctuation)
    // For this policy, we now require at least one special character
    if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      setError("Password must contain at least one special character.")
      return
    }

    if (OTP_ENABLED && !isOtpVerified) {
      setError("Please verify your mobile number before registering.")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData.user) {
        // Determine user type and status based on requested role
        let userType = 'user'
        let status = 'active'
        
        if (requestedRole === 'admin') {
          userType = 'admin'
          status = 'pending_admin'
        } else if (requestedRole === 'hospital') {
          userType = 'user' // Hospital accounts are still 'user' type but with hospital mapping
          status = 'pending_hospital'
        }

        // 2. Create user profile
        const profilePayload = {
          id: authData.user.id,
          firstName: formData.firstName,
          middleName: formData.middleName || null,
          lastName: formData.lastName,
          email: formData.email,
          username: formData.username,
          birthday: formData.birthday || null,
          mobileNumber: formData.mobileNumber,
          user_type: userType,
          status: status,
          requested_role: requestedRole !== 'user' ? requestedRole : null,
        }

        const { error: profileError } = await supabase
          .from('users')
          .insert(profilePayload)

        if (profileError) {
          setError("Registration failed: " + profileError.message)
          return
        }

        // 3. If requesting special role, create approval request
        if (requestedRole !== 'user') {
          const approvalPayload: any = {
            user_id: authData.user.id,
            requested_role: requestedRole,
          }

          // Add role-specific data
          if (selectedRoleData) {
            if (selectedRoleData.category === 'hospital' && selectedRoleData.hospitalId) {
              approvalPayload.hospital_id = selectedRoleData.hospitalId
            } else if (selectedRoleData.category === 'er_team') {
              approvalPayload.er_team_id = selectedRoleData.erTeamId
            }
          }

          const { error: approvalError } = await supabase
            .from('admin_approval_requests')
            .insert(approvalPayload)

          if (approvalError) {
            console.error("Approval request creation failed:", approvalError)
            // Don't fail registration, just log the error
          }
        }

        if (status === 'active') {
          setShowSuccessModal(true)
          setSuccess("Successfully sent to your email, check your email to verify the account")
        } else {
          // Show pending approval message
          setSuccess(`Account created successfully! Your ${requestedRole} account request has been sent to the MDRRMO Super Admin for approval.`)
          setShowSuccessModal(true)
        }
        setOtpCode("")
        setOtpMessageId(null)
        setIsOtpVerified(false)
        setOtpSuccess("")
        setOtpError("")
        setResendTimer(0)
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError("Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await handleRegister()
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  }

  useEffect(() => {
    if (resendTimer <= 0) {
      return
    }
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendTimer])

  // Track reading progress in terms dialog
  useEffect(() => {
    if (!showTerms) return

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      const scrollTop = target.scrollTop
      const scrollHeight = target.scrollHeight - target.clientHeight
      const progress = Math.min((scrollTop / scrollHeight) * 100, 100)
      setReadingProgress(progress)
    }

    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [showTerms])

  const handleSendOtp = async () => {
    if (!/^09\d{9}$/.test(formData.mobileNumber)) {
      setMobileNumberError('Please provide a valid mobile number starting with 09 (11 digits).')
      setOtpError("Please provide a valid mobile number before requesting a code.")
      return
    }
    setIsSendingOtp(true)
    setOtpError("")
    setOtpSuccess("")
    setIsOtpVerified(false)
    try {
      const response = await fetch("/api/semaphore/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobileNumber: formData.mobileNumber }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code.")
      }
      setOtpMessageId(data.messageId || null)
      setOtpSuccess("Verification code sent to your mobile number.")
      setResendTimer(60)
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send verification code.")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpMessageId) {
      setOtpError("Please request a verification code first.")
      return
    }
    if (!otpCode.trim()) {
      setOtpError("Please enter the verification code.")
      return
    }
    setIsVerifyingOtp(true)
    setOtpError("")
    setOtpSuccess("")
    try {
      const response = await fetch("/api/semaphore/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId: otpMessageId, code: otpCode }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Verification failed.")
      }
      setIsOtpVerified(true)
      setOtpSuccess("Mobile number verified.")
    } catch (err: any) {
      setIsOtpVerified(false)
      setOtpError(err?.message || "Verification failed.")
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/images/mdrrmo_login_register_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl relative z-10 auth-card-pop">
        <CardHeader className="text-center bg-orange-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">MDRRMO Registration</CardTitle>
          <p className="text-orange-100">Emergency Reporting System</p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName" className="text-gray-700 font-medium">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="border-orange-200 focus:border-orange-500"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="middleName" className="text-gray-700 font-medium">
                  Middle Name
                </Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => handleInputChange("middleName", e.target.value)}
                  className="border-orange-200 focus:border-orange-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lastName" className="text-gray-700 font-medium">
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="border-orange-200 focus:border-orange-500"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="border-orange-200 focus:border-orange-500"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  Username *
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className="border-orange-200 focus:border-orange-500"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="birthday" className="text-gray-700 font-medium">
                  Birthday *
                </Label>
                <div className="relative">
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => {
                      handleInputChange("birthday", e.target.value);
                      if (e.target.value) {
                        const age = calculateAge(e.target.value);
                        setAgeVerified(age >= 12);
                      }
                    }}
                    className={`border-orange-200 focus:border-orange-500 ${formData.birthday && !ageVerified ? 'border-red-500' : ''}`}
                    required
                    disabled={isLoading}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {formData.birthday && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {ageVerified ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {formData.birthday && !ageVerified && (
                  <p className="text-sm text-red-500 mt-1">You must be at least 12 years old to register.</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="mobileNumber" className="text-gray-700 font-medium">
                Mobile Number *
              </Label>
              <Input
                id="mobileNumber"
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 11) {
                    handleInputChange("mobileNumber", value);
                    if (!/^09\d{0,9}$/.test(value)) {
                      setMobileNumberError('Please enter a valid PH mobile number starting with 09.');
                    } else if (value.length < 11) {
                      setMobileNumberError('Please complete the mobile number (11 digits required).');
                    } else {
                      setMobileNumberError(null);
                    }
                  }
                }}
                maxLength={11}
                className={`border-orange-200 focus:border-orange-500 ${mobileNumberError ? 'border-red-500' : ''}`}
                placeholder="09XXXXXXXXX"
                required
                disabled={isLoading}
              />
              {mobileNumberError && <p className="text-sm text-red-500 mt-1">{mobileNumberError}</p>}
              {OTP_ENABLED && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="otpCode"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6}
                      placeholder="Enter code"
                      disabled={isLoading || isOtpVerified}
                      className="w-28 sm:w-32 border-orange-200 focus:border-orange-500"
                    />
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isLoading || isSendingOtp || resendTimer > 0 || formData.mobileNumber.length !== 11 || isOtpVerified}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {isSendingOtp ? "Sending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : isOtpVerified ? "Verified" : "Send OTP"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isLoading || isVerifyingOtp || !otpMessageId || !otpCode.trim() || isOtpVerified}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isVerifyingOtp ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                  {otpError && <p className="text-sm text-red-500">{otpError}</p>}
                  {otpSuccess && <p className="text-sm text-green-600">{otpSuccess}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`border-orange-200 focus:border-orange-500 pr-10 ${(passwordInvalid || passwordsMismatch) ? 'border-red-500 focus:border-red-500' : ''}`}
                    aria-invalid={passwordInvalid || passwordsMismatch}
                    aria-describedby="password-help password-rules password-mismatch"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <ul id="password-rules" className="mt-2 space-y-1 text-sm">
                    {!hasMinLength && (
                      <li className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">At least 6 characters</span>
                      </li>
                    )}
                    {!hasUppercase && (
                      <li className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">Contains an uppercase letter</span>
                      </li>
                    )}
                    {!hasNumber && (
                      <li className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">Contains a number</span>
                      </li>
                    )}
                    {!hasSpecial && (
                      <li className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">Contains a special character</span>
                      </li>
                    )}
                  </ul>
                )}
                {passwordsMismatch && (
                  <p id="password-mismatch" className="text-sm text-red-500 mt-1">Your password didn't match, please match them</p>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  Confirm Password *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={`border-orange-200 focus:border-orange-500 pr-10 ${passwordsMismatch ? 'border-red-500 focus:border-red-500' : ''}`}
                    aria-invalid={passwordsMismatch}
                    aria-describedby="password-mismatch"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-2 mt-2">
              <div className="mt-1">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      if (!acceptedTerms) {
                        setShowTerms(true)
                      } else {
                        setAcceptedTerms(true)
                      }
                    } else {
                      setAcceptedTerms(false)
                    }
                  }}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
                />
              </div>
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  I accept the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowTerms(true)
                    }}
                    className="text-orange-500 hover:underline font-medium"
                  >
                    Terms and Conditions
                  </button>
                </label>
                <p className="text-xs text-gray-500">
                  You must be at least 12 years old to register. By creating an account, you agree to our terms and conditions.
                </p>
              </div>
            </div>


            <Button
              type="submit"
              disabled={isLoading || !ageVerified || !acceptedTerms || passwordInvalid || passwordsMismatch || (OTP_ENABLED && !isOtpVerified)}
              className={`w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded transition-colors ${
                (!ageVerified || !acceptedTerms || passwordInvalid || passwordsMismatch || (OTP_ENABLED && !isOtpVerified)) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? "Registering..." : "Register"}
            </Button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Already have an account?{" "}
              <span className="text-orange-500 font-medium cursor-pointer hover:underline" onClick={onGoToLogin}>
                Login here
              </span>
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {requestedRole === 'user' ? 'Registration Successful!' : 'Account Request Submitted!'}
            </h3>
            <p className="text-gray-600 mb-6">{success}</p>
            {requestedRole !== 'user' ? (
              <div className="w-full space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-orange-800">Still Waiting for MDRRMO Super Admin Approval</p>
                      <p className="text-xs text-orange-700 mt-1">Kindly wait for a while. Thank you for your patience!</p>
                    </div>
                  </div>
                </div>
                <Button 
                  asChild 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => {
                    setShowSuccessModal(false)
                    onGoToLogin()
                  }}
                >
                  <button>Go Back to Login</button>
                </Button>
              </div>
            ) : (
              <Button 
                asChild 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                <button>Okay</button>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden bg-white">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
            <div
              className="h-full bg-orange-500 transition-all duration-300 ease-out"
              style={{ width: `${readingProgress}%` }}
            />
          </div>

          {/* Header */}
          <DialogHeader className="pt-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <ScrollText className="h-6 w-6 text-orange-500" />
                <DialogTitle className="text-2xl font-bold text-gray-800">
                  {translations[language].title}
                </DialogTitle>
              </div>
              <Select value={language} onValueChange={(value: 'en' | 'tl') => setLanguage(value)}>
                <SelectTrigger className="w-auto border-orange-500 text-orange-500 hover:bg-orange-50 h-8 px-3">
                  <Languages className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tl">Tagalog</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogDescription className="text-gray-600 text-base leading-relaxed">
              {translations[language].description}
            </DialogDescription>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-1 py-2 max-h-[50vh]">
            <div className="space-y-6">
              {translations[language].sections.map((section, index) => {
                const IconComponent = section.icon
                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <IconComponent className="h-5 w-5 text-orange-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 leading-tight">
                          {section.title}
                        </h3>
                        {index === 2 ? (
                          <ul className="space-y-2 text-gray-700 leading-relaxed">
                            {section.content.split(', ').map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-700 leading-relaxed text-sm">
                            {section.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTerms(false)}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {translations[language].close}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAcceptedTerms(true)
                setShowTerms(false)
              }}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium"
            >
              {translations[language].accept}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
