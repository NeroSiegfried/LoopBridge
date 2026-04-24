import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Toast from './Toast';
import MessagesSidebar from './MessagesSidebar';
import { useAnalytics } from '../hooks/useAnalytics';
import { useAuth } from '../context/AuthContext';
import { messagesApi } from '../api';

export default function Layout() {
  useAnalytics(); // auto-tracks page_view, page_exit, scroll_depth
  const { user } = useAuth();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    messagesApi.list(1)
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => setUnreadCount(0));
  }, [user]);

  return (
    <>
      <Navbar
        onOpenMessages={() => setMessagesOpen(true)}
        unreadCount={unreadCount}
      />
      {user && (
        <MessagesSidebar
          open={messagesOpen}
          onClose={() => setMessagesOpen(false)}
          unreadCount={unreadCount}
          onUnreadCountChange={setUnreadCount}
        />
      )}
      <Outlet />
      <Footer />
      <Toast />
    </>
  );
}
