import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { installMockApi } from './mockApi';

if ((import.meta as any).env?.VITE_MOCK_API === 'true') {
  installMockApi();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
