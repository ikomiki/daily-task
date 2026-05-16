import type { Frequency } from '@org/habit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FrequencyPicker } from './FrequencyPicker.js';

describe('FrequencyPicker', () => {
  it('type select で type を切り替えると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    render(<FrequencyPicker value={{ type: 'daily' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('頻度の種類'), { target: { value: 'every_n_days' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'every_n_days', n: 1, anchor: expect.any(String) }),
    );
  });

  it('type=daily ではサブフォームを表示しない', () => {
    render(<FrequencyPicker value={{ type: 'daily' }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('n（日数）')).not.toBeInTheDocument();
  });

  it('type=every_n_days で n と anchor を表示する', () => {
    const value: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
    render(<FrequencyPicker value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText('n（日数）')).toHaveValue(3);
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-05-01');
  });

  it('every_n_days の n を変えると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const value: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
    render(<FrequencyPicker value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('n（日数）'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'every_n_days', n: 7, anchor: '2026-05-01' });
  });

  it('type=weekday で 7 個の曜日チェックボックスが出る', () => {
    render(<FrequencyPicker value={{ type: 'weekday', days: [1, 2] }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('月')).toBeChecked();
    expect(screen.getByLabelText('火')).toBeChecked();
    expect(screen.getByLabelText('水')).not.toBeChecked();
    expect(screen.getByLabelText('日')).not.toBeChecked();
  });

  it('weekday で曜日を toggle すると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    render(<FrequencyPicker value={{ type: 'weekday', days: [1] }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('火'));
    expect(onChange).toHaveBeenCalledWith({ type: 'weekday', days: [1, 2] });
  });

  it('type=day_of_week で weeks_of_month チェックボックス（1〜5）が出る', () => {
    render(
      <FrequencyPicker
        value={{ type: 'day_of_week', days: [4], weeks_of_month: [2, 4] }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('第 2 週')).toBeChecked();
    expect(screen.getByLabelText('第 4 週')).toBeChecked();
    expect(screen.getByLabelText('第 1 週')).not.toBeChecked();
  });

  it('type=every_n_weeks で n と day_of_week select と anchor が出る', () => {
    const value: Frequency = {
      type: 'every_n_weeks',
      n: 2,
      day_of_week: 6,
      anchor: '2026-05-01',
    };
    render(<FrequencyPicker value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText('n（週数）')).toHaveValue(2);
    expect(screen.getByLabelText('曜日')).toHaveValue('6');
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-05-01');
  });
});
