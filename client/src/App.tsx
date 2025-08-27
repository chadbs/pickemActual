import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Components
import Layout from './components/Layout';

// Pages
import HomePage from './pages/HomePage';
import LeaderboardPage from './pages/LeaderboardPage';
import PicksPage from './pages/PicksPage';
import AdminPage from './pages/AdminPage';
import AdminMatchupsPage from './pages/AdminMatchupsPage';
import UserProfilePage from './pages/UserProfilePage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-cfb-green-50 to-cfb-gold-50">
          <Layout>
            <Routes>
              {/* Main App Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/picks" element={<PicksPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile/:userId" element={<UserProfilePage />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/matchups" element={<AdminMatchupsPage />} />
              
              {/* Catch all - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          
          {/* React Query DevTools - only shows in development */}
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;