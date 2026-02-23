import React from 'react';

export type MobileTab = 'game' | 'chat' | 'mafia' | 'participants';

interface MobileNavigationProps {
    activeTab: MobileTab;
    onTabChange: (tab: MobileTab) => void;
    unreadChat?: number;
    unreadMafiaChat?: number;
    showMafiaTab?: boolean;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
    activeTab,
    onTabChange,
    unreadChat = 0,
    unreadMafiaChat = 0,
    showMafiaTab = false
}) => {
    return (
        <nav className="mobile-nav mobile-only">
            <button
                className={activeTab === 'game' ? 'active' : ''}
                onClick={() => onTabChange('game')}
            >
                <span className="mobile-nav-icon">🎮</span>
                <span>Игра</span>
            </button>
            <button
                className={activeTab === 'chat' ? 'active' : ''}
                onClick={() => onTabChange('chat')}
                style={{ position: 'relative' }}
            >
                <span className="mobile-nav-icon">💬</span>
                <span>Чат</span>
                {unreadChat > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: 'calc(50% - 20px)',
                        background: 'var(--danger)',
                        color: 'white',
                        fontSize: '0.625rem',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        minWidth: '16px',
                        textAlign: 'center'
                    }}>
                        {unreadChat > 99 ? '99+' : unreadChat}
                    </span>
                )}
            </button>
            {showMafiaTab && (
                <button
                    className={activeTab === 'mafia' ? 'active' : ''}
                    onClick={() => onTabChange('mafia')}
                    style={{ position: 'relative' }}
                >
                    <span className="mobile-nav-icon">🔫</span>
                    <span>Мафия</span>
                    {unreadMafiaChat > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '4px',
                            right: 'calc(50% - 20px)',
                            background: 'var(--danger)',
                            color: 'white',
                            fontSize: '0.625rem',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            minWidth: '16px',
                            textAlign: 'center'
                        }}>
                            {unreadMafiaChat > 99 ? '99+' : unreadMafiaChat}
                        </span>
                    )}
                </button>
            )}
            <button
                className={activeTab === 'participants' ? 'active' : ''}
                onClick={() => onTabChange('participants')}
            >
                <span className="mobile-nav-icon">👥</span>
                <span>Игроки</span>
            </button>
        </nav>
    );
};
