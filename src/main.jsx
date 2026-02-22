import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Google Analytics (optional): set VITE_GA_MEASUREMENT_ID in .env to enable
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
if (GA_ID)
{
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); } // eslint-disable-line no-inner-declarations
  gtag('js', new Date());
  gtag('config', GA_ID);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
