import { useState, useEffect } from 'react';

export const useVisualViewport = () => {
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0
    );
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return;

        const handleResize = () => {
            const height = window.visualViewport?.height || window.innerHeight;
            setViewportHeight(height);
            // Если высота viewport значительно меньше высоты окна, значит открыта клавиатура
            const isKeyboard = height < window.innerHeight * 0.8;
            setKeyboardOpen(isKeyboard);
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize(); // Init

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    return { viewportHeight, keyboardOpen };
};
