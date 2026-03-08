import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ImportPopover from './ImportPopover.tsx'
import ViewPopover from './ViewPopover.tsx'
import { initBackground } from './Background.ts'

const hash = window.location.hash;

console.log("Current hash:", hash);

if (hash.startsWith('#/import')) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ImportPopover />
    </StrictMode>,
  )
} else if (hash.startsWith('#/view')) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ViewPopover />
    </StrictMode>,
  )
} else if (hash.startsWith('#background')) {
  initBackground();
} else {
  // Default help page for the toolbar action
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h3>5e Tools Integration</h3>
        <p>Right-click an image token to import or view monster data.</p>
        <p><small>Version 1.0.3</small></p>
      </div>
    </StrictMode>,
  )
}
