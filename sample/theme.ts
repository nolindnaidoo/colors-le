// Colors-LE Sample TypeScript File

// Theme Configuration
export const lightTheme = {
  colors: {
    // Primary Colors
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryActive: '#1d4ed8',
    primaryLight: '#dbeafe',
    primaryDark: '#1e40af',

    // Secondary Colors
    secondary: '#8b5cf6',
    secondaryHover: '#7c3aed',
    secondaryActive: '#6d28d9',
    secondaryLight: '#ede9fe',
    secondaryDark: '#5b21b6',

    // Status Colors
    success: '#10b981',
    successLight: '#d1fae5',
    successDark: '#065f46',

    error: '#ef4444',
    errorLight: '#fee2e2',
    errorDark: '#991b1b',

    warning: '#f59e0b',
    warningLight: '#fef3c7',
    warningDark: '#78350f',

    info: '#3b82f6',
    infoLight: '#dbeafe',
    infoDark: '#1e40af',

    // Grayscale
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',

    // Base Colors
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',

    // Background Colors
    bgPrimary: '#ffffff',
    bgSecondary: '#f9fafb',
    bgTertiary: '#f3f4f6',

    // Text Colors
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',

    // Border Colors
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    borderDark: '#d1d5db',

    // Shadow Colors
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowMedium: 'rgba(0, 0, 0, 0.12)',
    shadowLarge: 'rgba(0, 0, 0, 0.2)',

    // Overlay Colors
    overlayLight: 'rgba(255, 255, 255, 0.9)',
    overlayDark: 'rgba(0, 0, 0, 0.75)',
  },
}

export const darkTheme = {
  colors: {
    // Primary Colors
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    primaryActive: '#2563eb',
    primaryLight: '#1e3a8a',
    primaryDark: '#dbeafe',

    // Secondary Colors
    secondary: '#a78bfa',
    secondaryHover: '#8b5cf6',
    secondaryActive: '#7c3aed',
    secondaryLight: '#4c1d95',
    secondaryDark: '#ede9fe',

    // Status Colors
    success: '#34d399',
    successLight: '#064e3b',
    successDark: '#d1fae5',

    error: '#f87171',
    errorLight: '#7f1d1d',
    errorDark: '#fee2e2',

    warning: '#fbbf24',
    warningLight: '#78350f',
    warningDark: '#fef3c7',

    info: '#60a5fa',
    infoLight: '#1e3a8a',
    infoDark: '#dbeafe',

    // Grayscale
    gray50: '#111827',
    gray100: '#1f2937',
    gray200: '#374151',
    gray300: '#4b5563',
    gray400: '#6b7280',
    gray500: '#9ca3af',
    gray600: '#d1d5db',
    gray700: '#e5e7eb',
    gray800: '#f3f4f6',
    gray900: '#f9fafb',

    // Base Colors
    white: '#000000',
    black: '#ffffff',
    transparent: 'transparent',

    // Background Colors
    bgPrimary: '#1f2937',
    bgSecondary: '#111827',
    bgTertiary: '#374151',

    // Text Colors
    textPrimary: '#f9fafb',
    textSecondary: '#d1d5db',
    textTertiary: '#9ca3af',

    // Border Colors
    border: '#374151',
    borderLight: '#1f2937',
    borderDark: '#4b5563',

    // Shadow Colors
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.4)',
    shadowLarge: 'rgba(0, 0, 0, 0.5)',

    // Overlay Colors
    overlayLight: 'rgba(31, 41, 55, 0.9)',
    overlayDark: 'rgba(0, 0, 0, 0.85)',
  },
}

// Gradients
export const gradients = {
  sunset: 'linear-gradient(to right, #ff6b6b, #feca57, #ee5a6f)',
  ocean: 'linear-gradient(120deg, #2980b9 0%, #6dd5fa 50%, #ffffff 100%)',
  forest: 'linear-gradient(45deg, #134e5e 0%, #71b280 100%)',
  aurora: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  fire: 'linear-gradient(to right, #f12711, #f5af19)',
  ice: 'linear-gradient(to right, #00d2ff, #3a7bd5)',
}

// HSL Color Functions
export const hslColors = {
  blue: 'hsl(217, 91%, 60%)',
  blueLight: 'hsl(217, 91%, 80%)',
  blueDark: 'hsl(217, 91%, 40%)',

  green: 'hsl(158, 64%, 52%)',
  greenLight: 'hsl(158, 64%, 72%)',
  greenDark: 'hsl(158, 64%, 32%)',

  yellow: 'hsl(45, 100%, 51%)',
  yellowLight: 'hsl(45, 100%, 71%)',
  yellowDark: 'hsl(45, 100%, 31%)',

  red: 'hsl(0, 84%, 60%)',
  redLight: 'hsl(0, 84%, 80%)',
  redDark: 'hsl(0, 84%, 40%)',

  purple: 'hsl(271, 76%, 53%)',
  purpleLight: 'hsl(271, 76%, 73%)',
  purpleDark: 'hsl(271, 76%, 33%)',
}

// RGBA Color Functions
export const rgbaColors = {
  overlay10: 'rgba(0, 0, 0, 0.1)',
  overlay20: 'rgba(0, 0, 0, 0.2)',
  overlay30: 'rgba(0, 0, 0, 0.3)',
  overlay50: 'rgba(0, 0, 0, 0.5)',
  overlay75: 'rgba(0, 0, 0, 0.75)',
  overlay90: 'rgba(0, 0, 0, 0.9)',

  whiteOverlay10: 'rgba(255, 255, 255, 0.1)',
  whiteOverlay20: 'rgba(255, 255, 255, 0.2)',
  whiteOverlay50: 'rgba(255, 255, 255, 0.5)',
  whiteOverlay75: 'rgba(255, 255, 255, 0.75)',
  whiteOverlay90: 'rgba(255, 255, 255, 0.9)',

  primaryOverlay: 'rgba(59, 130, 246, 0.1)',
  successOverlay: 'rgba(16, 185, 129, 0.1)',
  errorOverlay: 'rgba(239, 68, 68, 0.1)',
  warningOverlay: 'rgba(245, 158, 11, 0.1)',
}

// Type Definitions
export interface ThemeColors {
  primary: string
  secondary: string
  success: string
  error: string
  warning: string
  info: string
}

export type ColorMode = 'light' | 'dark'

// Export default theme
export const defaultTheme = lightTheme
