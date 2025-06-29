import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { useFinancialAssistant } from '@/lib/financial-assistant-context';

export default function Navbar() {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toggleChatPanel, isChatPanelVisible } = useFinancialAssistant();

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const getInitial = () => {
    if (user?.name) {
      return user.name.charAt(0);
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-white/20 shadow-lg sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/analyzer" className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Pocket FA
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex bg-gray-100/80 p-1 rounded-xl">
              <Link
                href="/analyzer"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  router.pathname === '/analyzer'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Statement Analyzer
              </Link>
              <Link
                href="/dashboard"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  router.pathname === '/dashboard'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Dashboard
              </Link>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Desktop Chat Toggle */}
            <button
              type="button"
              onClick={toggleChatPanel}
              className={`hidden md:flex px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isChatPanelVisible 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <span className="hidden lg:inline">{isChatPanelVisible ? 'Hide Chat' : 'Show Chat'}</span>
              <span className="lg:hidden">💬</span>
            </button>

            {/* Mobile Chat Toggle */}
            <button
              type="button"
              onClick={toggleChatPanel}
              className={`md:hidden p-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isChatPanelVisible 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              💬
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 min-h-[44px] min-w-[44px]"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm sm:text-base">
                  {getInitial()}
                </div>
              </button>

              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white/95 backdrop-blur-md py-2 shadow-xl ring-1 ring-black/5 border border-white/20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
                      <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    </div>
                    
                    <Link
                      href="/profile"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Your Profile
                    </Link>
                    <Link
                      href="/profile/settings"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button
                        onClick={handleLogout}
                        className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/20 bg-white/95 backdrop-blur-md">
          <div className="px-3 py-3 space-y-1">
            <Link
              href="/analyzer"
              className={`block rounded-lg px-3 py-3 text-base font-medium transition-colors duration-200 ${
                router.pathname === '/analyzer'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Statement Analyzer
            </Link>
            <Link
              href="/dashboard"
              className={`block rounded-lg px-3 py-3 text-base font-medium transition-colors duration-200 ${
                router.pathname === '/dashboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
