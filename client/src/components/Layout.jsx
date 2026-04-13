import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Toast from './Toast';
import { useAnalytics } from '../hooks/useAnalytics';

export default function Layout() {
  useAnalytics(); // auto-tracks page_view, page_exit, scroll_depth

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      <Toast />
    </>
  );
}
