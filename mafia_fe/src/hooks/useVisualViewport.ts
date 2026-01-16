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

        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            // Если это поле ввода и мы на мобильном (проверка по ширине или тач-событиям, но тут просто по типу)
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                setKeyboardOpen(true);
            }
        };



        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        window.addEventListener('focusin', handleFocusIn);
        // Мы не используем focusout для закрытия, доверяем visualViewport, чтобы избежать мигания

        handleResize(); // Init

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
            window.removeEventListener('focusin', handleFocusIn);
        };
    }, []);

    return { viewportHeight, viewportTop, keyboardOpen };
};
