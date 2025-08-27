import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bars3Icon, 
  XMarkIcon,
  HomeIcon,
  TrophyIcon,
  PresentationChartBarIcon,
  Cog6ToothIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import UserSelector from './UserSelector';
import { useCurrentUser } from '../hooks/useApi';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser } = useCurrentUser();

  const navigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Make Picks', href: '/picks', icon: PresentationChartBarIcon, highlight: true },
    { name: 'Leaderboard', href: '/leaderboard', icon: TrophyIcon },
  ];

  const adminNavigation = [
    { name: 'Admin', href: '/admin', icon: Cog6ToothIcon },
  ];

  const isActiveRoute = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="text-lg">🏈</div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">CFB Pick'em</h1>
                <p className="text-xs text-gray-500 -mt-1">2025</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                const isHighlight = item.highlight;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? isHighlight
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-blue-600 text-white shadow-lg'
                        : isHighlight
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                          : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                    {isHighlight && !isActive && <span className="text-xs">🏈</span>}
                  </Link>
                );
              })}

              {/* Admin Navigation */}
              {currentUser?.is_admin && (
                <>
                  <div className="h-6 w-px bg-gray-300 mx-2" />
                  {adminNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveRoute(item.href);
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>

            {/* User Selector and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <div className="bg-gray-50 rounded-xl p-1">
                <UserSelector />
              </div>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                const isHighlight = item.highlight;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActive
                        ? isHighlight
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white'
                        : isHighlight
                          ? 'bg-green-100 text-green-700 border-2 border-green-300'
                          : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span>{item.name}</span>
                    {isHighlight && !isActive && <span className="text-lg">🏈</span>}
                  </Link>
                );
              })}

              {/* Admin Mobile Navigation */}
              {currentUser?.is_admin && (
                <>
                  <div className="h-px bg-gray-200 my-2" />
                  {adminNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveRoute(item.href);
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="text-lg">🏈</div>
                <h3 className="font-bold">CFB Pick'em 2025</h3>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                College football prediction game for friends. 
                Make your picks, compete, and see who knows CFB best!
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/" className="text-gray-300 hover:text-white text-sm transition-colors flex items-center space-x-2">
                    <HomeIcon className="h-4 w-4" />
                    <span>Current Week</span>
                  </Link>
                </li>
                <li>
                  <Link to="/leaderboard" className="text-gray-300 hover:text-white text-sm transition-colors flex items-center space-x-2">
                    <TrophyIcon className="h-4 w-4" />
                    <span>Leaderboard</span>
                  </Link>
                </li>
                <li>
                  <Link to="/picks" className="text-gray-300 hover:text-white text-sm transition-colors flex items-center space-x-2">
                    <PresentationChartBarIcon className="h-4 w-4" />
                    <span>My Picks</span>
                  </Link>
                </li>
              </ul>
            </div>
            
            {/* Favorite Teams */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Featured Teams</h4>
              <p className="text-gray-300 text-sm mb-3">Games featuring these teams get priority:</p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-green-600 px-3 py-1 rounded-full text-xs font-medium">Colorado</span>
                <span className="bg-green-600 px-3 py-1 rounded-full text-xs font-medium">Colorado State</span>
                <span className="bg-red-600 px-3 py-1 rounded-full text-xs font-medium">Nebraska</span>
                <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-medium">Michigan</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © 2025 CFB Pick'em. Built with ❤️ for college football fans.
              </p>
              <div className="flex items-center space-x-4 mt-4 md:mt-0">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                <span className="text-gray-400 text-sm">Powered by real college football data</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;