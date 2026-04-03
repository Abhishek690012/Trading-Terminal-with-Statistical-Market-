import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('MAIN IS RUNNING');
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<div style="color: yellow; padding: 20px;">DEBUG: Main started</div>';
}

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
