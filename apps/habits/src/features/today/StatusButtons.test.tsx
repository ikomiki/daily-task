import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusButtons } from './StatusButtons.js';

describe('StatusButtons', () => {
  it('完了 / スキップ / 失敗 の 3 ボタンを表示する', () => {
    render(<StatusButtons current="empty" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'スキップ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '失敗' })).toBeInTheDocument();
  });

  it('current が empty で「完了」クリックすると onChange("complete") が呼ばれる', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(onChange).toHaveBeenCalledWith('complete');
  });

  it('current が empty で「スキップ」クリックすると onChange("skip")', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });

  it('current が empty で「失敗」クリックすると onChange("fail")', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '失敗' }));
    expect(onChange).toHaveBeenCalledWith('fail');
  });

  it('current が complete で「完了」クリックすると onChange(null)（解除）', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="complete" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('current が complete で「スキップ」クリックすると onChange("skip")（切り替え）', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="complete" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });

  it('アクティブな button には aria-pressed="true" が付く', () => {
    render(<StatusButtons current="complete" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '完了' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'スキップ' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '失敗' })).toHaveAttribute('aria-pressed', 'false');
  });
});
