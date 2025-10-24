// Colors-LE Sample JavaScript/JSX File
import React from 'react'
import styled from 'styled-components'

// Styled Components
const Button = styled.button`
  background-color: #3b82f6;
  color: #ffffff;
  border: 2px solid #2563eb;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;

  &:hover {
    background-color: #2563eb;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:active {
    background-color: #1d4ed8;
  }

  &.success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: #059669;
  }

  &.danger {
    background-color: #ef4444;
    border-color: #dc2626;
    color: white;
  }
`

const Card = styled.div`
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  padding: 1.5rem;
`

const Alert = styled.div`
  padding: 1rem;
  border-radius: 0.375rem;
  border-left: 4px solid;

  &.success {
    background-color: #d1fae5;
    border-color: #10b981;
    color: #065f46;
  }

  &.error {
    background-color: #fee2e2;
    border-color: #ef4444;
    color: #991b1b;
  }

  &.warning {
    background-color: #fef3c7;
    border-color: #f59e0b;
    color: #78350f;
  }

  &.info {
    background-color: #dbeafe;
    border-color: #3b82f6;
    color: #1e40af;
  }
`

// Inline Styles Object
const styles = {
  container: {
    backgroundColor: '#f9fafb',
    color: '#111827',
    padding: '2rem',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    padding: '1rem',
    borderRadius: '0.5rem',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    borderRadius: '0.5rem',
  },
  status: {
    success: {
      backgroundColor: '#d1fae5',
      color: '#065f46',
    },
    error: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
    },
    warning: {
      backgroundColor: '#fef3c7',
      color: '#78350f',
    },
    info: {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
    },
  },
  gradient: {
    sunset: {
      background: 'linear-gradient(to right, #ff6b6b, #feca57, #ee5a6f)',
    },
    ocean: {
      background: 'linear-gradient(120deg, #2980b9 0%, #6dd5fa 50%, #ffffff 100%)',
    },
    forest: {
      background: 'linear-gradient(45deg, #134e5e 0%, #71b280 100%)',
    },
  },
}

// Component with Inline Styles
export function App() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Colors-LE Demo</h1>
      </div>

      <Card>
        <h2 style={{ color: '#374151' }}>Card Component</h2>
        <p style={{ color: '#6b7280' }}>This is a card with styled components.</p>
      </Card>

      <Button>Primary Button</Button>
      <Button className="success">Success Button</Button>
      <Button className="danger">Danger Button</Button>

      <Alert className="success">Success alert message</Alert>
      <Alert className="error">Error alert message</Alert>
      <Alert className="warning">Warning alert message</Alert>
      <Alert className="info">Info alert message</Alert>

      <div style={styles.gradient.sunset}>Sunset Gradient</div>
      <div style={styles.gradient.ocean}>Ocean Gradient</div>
      <div style={styles.gradient.forest}>Forest Gradient</div>

      {/* JSX with direct inline styles */}
      <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '1rem' }}>
        Direct Inline Style
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #e5e7eb' }}>
        RGBA Background
      </div>

      <div style={{ color: 'hsl(217, 19%, 27%)', backgroundColor: 'hsl(220, 13%, 91%)' }}>
        HSL Colors
      </div>

      <span style={{ color: '#10b981' }}>Green Text</span>
      <span style={{ color: '#ef4444' }}>Red Text</span>
      <span style={{ color: '#f59e0b' }}>Orange Text</span>
      <span style={{ color: '#3b82f6' }}>Blue Text</span>
    </div>
  )
}

// CSS-in-JS with emotion
const emotionStyles = {
  container: css`
    background-color: #f9fafb;
    color: #111827;
    padding: 2rem;
  `,
  button: css`
    background-color: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

    &:hover {
      background-color: #2563eb;
    }
  `,
}

export default App
