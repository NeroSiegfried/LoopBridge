import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NotFound() {
  return (
    <>
      <SEO title="404 — Page Not Found" description="The page you're looking for doesn't exist." />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Schibsted Grotesk', sans-serif",
        textAlign: 'center',
        padding: '2rem',
      }}>
        <h1 style={{
          fontFamily: 'CabinetGrotesk-Bold, sans-serif',
          fontSize: 'clamp(4rem, 10vw, 8rem)',
          color: '#013352',
          marginBottom: '0',
        }}>404</h1>
        <p style={{ fontSize: '1.25rem', color: '#444b54', marginBottom: '2rem' }}>
          Oops! The page you're looking for doesn't exist.
        </p>
        <Link to="/" style={{
          padding: '0.8rem 2rem',
          borderRadius: '2rem',
          background: '#30c070',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1rem',
        }}>
          Go Home
        </Link>
      </div>
    </>
  );
}
