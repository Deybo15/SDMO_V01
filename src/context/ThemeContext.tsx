import React, { createContext, useContext, useEffect } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
};

const ThemeContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
}: ThemeProviderProps) {
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add('dark');
    }, []);

    const value = {
        theme: 'dark' as Theme,
        setTheme: (theme: Theme) => {
            // Do nothing, enforce dark mode
            console.log('Theme change disabled. Dark mode enforced.');
        },
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
}
