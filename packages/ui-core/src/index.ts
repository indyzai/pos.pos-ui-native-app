export type DataState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface SelectOption<TValue extends string = string> {
  label: string;
  value: TValue;
}
