export interface Query<TResult, TInput = void> {
    execute(input: TInput): Promise<TResult>;
}

export interface Command<TResult, TInput> {
    execute(input: TInput): Promise<TResult>;
}
export * from "./context";
