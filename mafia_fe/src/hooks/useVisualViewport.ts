import { useState, useEffect } from 'react';

export const useVisualViewport = () => {
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0
    );
    const [viewportTop, setViewportTop] = useState(0);
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return;

        const handleResize = () => {
            const height = window.visualViewport?.height || window.innerHeight;
            const top = window.visualViewport?.offsetTop || 0;
            setViewportHeight(height);
            setViewportTop(top);
            // Если высота viewport значительно меньше высоты окна, значит открыта клавиатура (учитываем погрешность)
            const isKeyboard = height < window.innerHeight * 0.85;
            setKeyboardOpen(isKeyboard);

            // Скроллим к активному элементу, если клавиатура открылась
            if (isKeyboard && document.activeElement) {
                setTimeout(() => {
                    document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize(); // Init

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    return { viewportHeight, viewportTop, keyboardOpen };
};
