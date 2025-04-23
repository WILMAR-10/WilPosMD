import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; 
import { AuthProvider } from './services/AuthContext';
import AppRouter from './AppRouter';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </HashRouter>
);