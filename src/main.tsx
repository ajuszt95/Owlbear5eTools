import ReactDOM from 'react-dom/client'
import { StrictMode, useEffect, useState, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import ImportPopover from './ImportPopover'
import ViewPopover from './ViewPopover'
import { initBackground } from './Background'
import './index.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "white", background: "#800", borderRadius: "8px", margin: "10px", fontFamily: "sans-serif" }}>
          <h2>Extension Crashed (v1.0.10)</h2>
          <p>Something went wrong. Please share this error with the developer:</p>
          <pre style={{ background: "rgba(0,0,0,0.5)", padding: "10px", overflow: "auto", fontSize: "12px" }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", cursor: "pointer", background: "white", color: "black", border: "none", borderRadius: "4px" }}>Reload Extension</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Root = () => {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      console.log("main.tsx: Hash changed to:", window.location.hash);
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  console.log("main.tsx: Rendering with hash:", hash);

  if (hash.startsWith("#background")) {
    initBackground();
    return null;
  }

  if (hash.startsWith("#/import")) {
    return <ImportPopover />;
  }

  if (hash.startsWith("#/view")) {
    return <ViewPopover />;
  }

  return (
    <div style={{ padding: "20px", color: "white", background: "#222", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <h2>5e Tools Diagnostics (v1.0.10)</h2>
      <p>Current Hash: <code>{hash}</code></p>
      <p>No route matched. This usually happens if the extension was opened in a way it didn't expect.</p>
      <div style={{ marginTop: "20px", fontSize: "12px", opacity: 0.7 }}>
        <p>Expected routes:</p>
        <ul>
          <li><code>#/import?id=TOKEN_ID</code> (Import Monster)</li>
          <li><code>#/view?id=TOKEN_ID</code> (View Stat Block)</li>
          <li><code>#background</code> (Hidden worker)</li>
        </ul>
      </div>
      <div style={{ marginTop: "20px" }}>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", cursor: "pointer" }}>Check Hash Again</button>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)
