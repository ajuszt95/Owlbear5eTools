import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ImportPopover from './ImportPopover.tsx'
import ViewPopover from './ViewPopover.tsx'
import { initBackground } from './Background.ts'

const hash = window.location.hash;

if (hash === '#/import') {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ImportPopover />
    </StrictMode>,
  )
} else if (hash === '#/view') {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ViewPopover />
    </StrictMode>,
  )
} else {
  // If no hash, run as the background script
  initBackground();
}
