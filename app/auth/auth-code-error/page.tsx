export default function AuthCodeError() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
            <p className="text-gray-600 mb-4">There was an error confirming your email. Please try logging in again.</p>
            <a href="/" className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }
  