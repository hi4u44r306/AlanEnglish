import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Containerfull from './Containerfull';

jest.mock('react-redux', () => {
    const state = {
        musicReducer: {
            playing: {
                id: 1,
                name: 'Test track'
            },
            curr_margin: '100px'
        }
    };

    return {
        useSelector: selector => selector(state)
    };
});

jest.mock('./MainNavbar', () => () => <nav>Navigation</nav>);
jest.mock('./MusicPlayer', () => () => <div>Player</div>);
jest.mock('./GuidedTour', () => () => null);
jest.mock('./ConversationUXGuard', () => () => null);
jest.mock('./ConversationHintCoach', () => () => null);
jest.mock('./MobileOffcanvasScrollGuard', () => () => null);
jest.mock('./AssignmentShortcut', () => () => null);

describe('Containerfull player clearance', () => {
    it('lets responsive CSS reserve the complete footer space', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/student/dashboard']}>
                <Containerfull>
                    <p>Last page content</p>
                </Containerfull>
            </MemoryRouter>
        );

        const shell = container.querySelector('.app-shell');
        const content = container.querySelector('.app-content');

        expect(content).toHaveClass('has-player');
        expect(content).not.toHaveClass('has-mini-player');
        expect(content.style.paddingBottom).toBe('');
        expect(shell.style.getPropertyValue('--app-player-space')).toBe('100px');
    });
});
