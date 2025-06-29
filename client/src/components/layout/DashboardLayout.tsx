import { ReactNode, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from './Navbar';
import { useAuth } from '@/hooks/useAuth';
import ChatInterface from '../dashboard/ChatInterface';
import { useFinancialAssistant } from '@/lib/financial-assistant-context';

type DashboardLayoutProps = {
  children: ReactNode;
  title?: string;
};

export default function DashboardLayout({ 
  children,
  title = 'Dashboard | Pocket Financial Advisor',
}: DashboardLayoutProps) {
  const { user, isLoading } = useAuth();
  const { isChatPanelVisible } = useFinancialAssistant();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  // Prevent body scroll when chat is open on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isChatPanelVisible && window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isChatPanelVisible]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Pocket Financial Advisor dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
        <Navbar />

        <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          {/* Desktop Layout */}
          <div className="hidden md:flex gap-6 min-h-[calc(100vh-8rem)]">
            {/* Main Content */}
            <main className="flex-1 transition-all duration-300 ease-in-out">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6">
                {children}
              </div>
            </main>

            {/* Desktop Chat Panel */}
            {isChatPanelVisible && (
              <div className="w-[400px] min-w-[350px] max-w-[500px] transition-all duration-300 ease-in-out">
                <div className="h-full bg-white/90 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl overflow-hidden">
                  <ChatInterface />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden min-h-[calc(100vh-8rem)]">
            {/* Main Content */}
            <main className="relative">
              <div className="bg-white/90 rounded-2xl border border-white/20 shadow-xl p-4 mb-20">
                {children}
              </div>
            </main>

            {/* Mobile Chat Panel - Slides up from bottom */}
            {isChatPanelVisible && (
              <div className="fixed inset-0 z-40 md:hidden">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                
                {/* Chat Panel */}
                <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out">
                  <ChatInterface />
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-white/20 bg-white/50 backdrop-blur-sm py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Pocket Financial Advisor. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
