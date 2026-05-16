import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeSlotEditor } from './TimeSlotEditor.js';

describe('TimeSlotEditor', () => {
  it('name と notify_at の入力欄を表示する', () => {
    render(<TimeSlotEditor onSubmit={vi.fn()} onCancel={vi.fn()} submitLabel="作成" />);
    expect(screen.getByLabelText('時間帯名')).toBeInTheDocument();
    expect(screen.getByLabelText('通知時刻')).toBeInTheDocument();
  });

  it('initial を渡すと値で初期化される', () => {
    render(
      <TimeSlotEditor
        initial={{ name: '朝', notify_at: '07:30:00' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="保存"
      />,
    );
    expect(screen.getByLabelText('時間帯名')).toHaveValue('朝');
    expect(screen.getByLabelText('通知時刻')).toHaveValue('07:30');
  });

  it('submit で onSubmit が呼ばれる (notify_at は HH:MM:SS に補完される)', () => {
    const onSubmit = vi.fn();
    render(<TimeSlotEditor onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('時間帯名'), { target: { value: '夜' } });
    fireEvent.change(screen.getByLabelText('通知時刻'), { target: { value: '21:00' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: '夜', notify_at: '21:00:00' });
  });

  it('name が空のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<TimeSlotEditor onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('通知時刻'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/時間帯名/);
  });

  it('キャンセルボタンで onCancel が呼ばれる', () => {
    const onCancel = vi.fn();
    render(<TimeSlotEditor onSubmit={vi.fn()} onCancel={onCancel} submitLabel="作成" />);
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
