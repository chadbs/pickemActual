import React, { useState, useEffect } from 'react';
import { 
  UserCircleIcon, 
  PlusIcon,
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useUsers, useCreateUser, useCurrentUser } from '../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';

const UserSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { currentUser, setCurrentUser } = useCurrentUser();
  const createUserMutation = useCreateUser();
  const queryClient = useQueryClient();

  const handleUserSelect = async (user: User) => {
    try {
      // Refetch users to get latest admin status
      const { data: freshUsers } = await refetchUsers();
      const freshUser = freshUsers?.find((u: User) => u.id === user.id) || user;
      
      // Set the new current user
      setCurrentUser(freshUser);
      
      console.log('🔄 User switched to:', freshUser.name, '- Page will refresh');
      
      // Full page refresh to ensure all state is cleared
      setTimeout(() => {
        window.location.reload();
      }, 100); // Small delay to ensure localStorage is updated
      
    } catch (error) {
      console.error('Error switching user:', error);
      // Fallback to original user
      setCurrentUser(user);
      // Still refresh on error to clear any inconsistent state
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
    
    setIsOpen(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    try {
      const newUser = await createUserMutation.mutateAsync({ 
        name: newUserName.trim() 
      });
      
      // Set the new user as current
      setCurrentUser(newUser);
      
      console.log('👤 New user created and selected:', newUser.name, '- Page will refresh');
      
      // Full page refresh to show new user's clean state
      setTimeout(() => {
        window.location.reload();
      }, 100);
      
    } catch (error) {
      console.error('Failed to create user:', error);
      // Don't reload on error, let user try again
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    
    console.log('👋 User logged out - Page will refresh');
    
    // Full page refresh to clear all user state
    setTimeout(() => {
      window.location.reload();
    }, 100);
    
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-user-selector]')) {
        setIsOpen(false);
        setShowAddUser(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" data-user-selector>
      {/* Current User Display / Login Button */}
      {currentUser ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors duration-200 shadow-sm"
        >
          <UserCircleIcon className="h-5 w-5" />
          <span className="font-medium">{currentUser.name}</span>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-white text-blue-600 hover:bg-gray-100 font-medium transition-colors duration-200"
        >
          <UserCircleIcon className="h-5 w-5" />
          <span>Select Player</span>
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-hidden">
          {/* User List */}
          <div className="py-2 max-h-60 overflow-y-auto">
            {usersLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                Loading players...
              </div>
            ) : users.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No players yet
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between transition-colors duration-150"
                >
                  <div className="flex items-center space-x-3">
                    <UserCircleIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.name}
                        {user.is_admin && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      {user.email && (
                        <div className="text-sm text-gray-500">{user.email}</div>
                      )}
                    </div>
                  </div>
                  {currentUser?.id === user.id && (
                    <CheckIcon className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Add New User Section */}
          <div className="border-t border-gray-200">
            {showAddUser ? (
              <form onSubmit={handleAddUser} className="p-4">
                <div className="space-y-3">
                  <div>
                    <label htmlFor="newUserName" className="block text-sm font-medium text-gray-700">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="newUserName"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Enter your name"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      disabled={createUserMutation.isPending}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={!newUserName.trim() || createUserMutation.isPending}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                    >
                      {createUserMutation.isPending ? 'Adding...' : 'Add Me'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddUser(false);
                        setNewUserName('');
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 text-sm font-medium text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddUser(true)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors duration-150 text-blue-600"
              >
                <PlusIcon className="h-5 w-5" />
                <span className="font-medium">Add New Player</span>
              </button>
            )}
          </div>

          {/* Logout Option */}
          {currentUser && (
            <div className="border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 text-red-600 transition-colors duration-150"
              >
                Switch Player
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSelector;