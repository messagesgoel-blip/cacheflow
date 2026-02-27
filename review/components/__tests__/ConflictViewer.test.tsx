import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConflictViewer from '../ConflictViewer';

const baseConflict = {
  id: 'c-1',
  filename: 'report.txt',
  detected_at: '2026-02-25T18:00:00.000Z',
  status: 'unresolved' as const,
  local_version: {
    path: '/local/report.txt',
    size_bytes: 128,
    modified_at: '2026-02-25T17:50:00.000Z'
  },
  cloud_version: {
    path: '/cloud/report.txt',
    size_bytes: 129,
    modified_at: '2026-02-25T17:55:00.000Z'
  }
};

describe('ConflictViewer', () => {
  test('renders supported resolution actions only', () => {
    render(
      <ConflictViewer
        conflict={baseConflict}
        onResolve={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep cloud/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keep both/i })).not.toBeInTheDocument();
  });

  test('invokes callback with backend-compatible values', async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();

    render(
      <ConflictViewer
        conflict={baseConflict}
        onResolve={onResolve}
      />
    );

    await user.click(screen.getByRole('button', { name: /keep mine/i }));
    expect(onResolve).toHaveBeenCalledWith('keep_local');

    await user.click(screen.getByRole('button', { name: /keep cloud/i }));
    expect(onResolve).toHaveBeenCalledWith('keep_remote');
  });

  test('shows resolved banner and hides action area', () => {
    render(
      <ConflictViewer
        conflict={{ ...baseConflict, status: 'resolved' as const }}
        onResolve={jest.fn()}
      />
    );

    expect(screen.getByText(/has been resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keep mine/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keep cloud/i })).not.toBeInTheDocument();
  });
});
