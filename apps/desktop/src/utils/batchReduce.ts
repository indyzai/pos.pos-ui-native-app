export function batchReduce<TInput, TOutput extends Record<string, unknown>>(
    items: TInput[],
    reducers: {
        [K in keyof TOutput]: (item: TInput, acc: TOutput[K]) => TOutput[K];
    },
    initialValues: TOutput,
): TOutput {
    const result = { ...initialValues };

    for (const item of items) {
        for (const key of Object.keys(reducers) as Array<keyof TOutput>) {
            result[key] = reducers[key](item, result[key]);
        }
    }

    return result;
}
