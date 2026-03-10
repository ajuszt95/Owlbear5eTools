import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import ImportPopover from './ImportPopover'
import ViewPopover from './ViewPopover'
import { initBackground } from './Background'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!);

const render = () => {
  const hash = window.location.hash;
  console.log("main.tsx: Rendering with hash:", hash);

  if (hash.startsWith("#background")) {
    // Background script doesn't need to render anything to the DOM
    // but we called it for initialization
    initBackground();
  } else if (hash.startsWith("#/import")) {
    root.render(
      <StrictMode>
        <ImportPopover />
      </StrictMode>
    );
  } else if (hash.startsWith("#/view")) {
    root.render(
      <StrictMode>
        <ViewPopover />
      </StrictMode>
    );
  } else {
    // Default / Help page or unexpected route
    root.render(
      <StrictMode>
        <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#eee', background: '#222', minHeight: '100vh' }}>
          <h3>5e Tools Integration</h3>
          <p>Right-click an image token to import or view monster data.</p>
          <hr style={{ borderColor: '#444' }} />
          <p><small>Debug Info:</small></p>
          <p><small>Hash: <code>{hash || "(empty)"}</code></small></p>
          <p><small>Version: 1.0.7</small></p>
        </div>
      </StrictMode>
    );
  }
};

// Initial render
render();

// Handle hash changes (though popovers are usually fresh loads)
window.addEventListener("hashchange", render);
