export const auth = {
  login: {
    heading: "Welcome to BriefTube",
    subtitle:
      "AI audio summaries of your YouTube channels, delivered automatically",
    terms:
      "By signing in, you agree to our Terms of Service and Privacy Policy",
  },
  forgotPassword: {
    heading: "Reset your password",
    subtitle: "Enter your email and we'll send you a reset link",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    submitLabel: "Send reset link",
    submittingLabel: "Sending...",
    backToLoginText: "Remember your password?",
    backToLoginLink: "Log in",
    sentHeading: "Check your email",
    sentSubtitle: (email: string) =>
      `We sent a password reset link to ${email}. Click it to set a new password.`,
    backFromSent: "Back to login",
  },
  resetPassword: {
    heading: "Set new password",
    subtitle: "Choose a strong password for your account",
    sessionLoading:
      "Loading session... If this takes too long, try clicking the reset link in your email again.",
    newPasswordLabel: "New password",
    newPasswordPlaceholder: "At least 8 characters",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordPlaceholder: "Repeat your password",
    errorMismatch: "Passwords do not match",
    errorMinLength: "Password must be at least 8 characters",
    submitLabel: "Update password",
    submittingLabel: "Updating...",
    successHeading: "Password updated",
    successSubtitle:
      "Your password has been changed. Redirecting to dashboard...",
  },
};
