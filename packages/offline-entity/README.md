# Offline entity hook

`useOfflineEntity` is the shared React API for POS web and React Native lists. It has no GraphQL or database imports. The caller supplies a repository and an optional sync adapter.

React Native can call `useNativeOfflineEntity` from `@indyzai/pos-database/offline-entity-hook` with the active `database`. It uses existing SQLite collections and a dedicated `sync_mutations` table. Web can call `useWebOfflineEntity` from `apps/web/src/hooks/useOfflineEntity.ts` in the sibling `pos.pos-ui-new` repository. That binding opens `indyz_pos_entities_v1`, a separate IndexedDB database from the legacy `indyz_pos` store.

The web repository includes this repository as a Git submodule and imports this package through its workspace dependency.

```tsx
const products = useOfflineEntity<Product, ProductListItem>({
  tableName: 'products',
  scope,
  tenantId,
  storeId,
  repository,
  syncAdapter: {
    list: ({ first, after, search, filter, signal }) => productConnectionPage({
      page: { first, after }, filter: { ...filter, search }, signal,
    }),
    getById: ({ remoteId }) => productDetail(remoteId),
    create: ({ input, idempotencyKey }) => createProduct({ ...input, clientMutationId: idempotencyKey }),
    update: ({ record, input, idempotencyKey }) => updateProduct(record.remoteId!, { ...input, clientMutationId: idempotencyKey }),
  },
  listSelector: (record) => ({
    id: record.id,
    remoteId: record.remoteId,
    name: record.payload.name,
  }),
  serverPagination: true,
  remoteSearch: true,
  autoSync: true,
});
```

Remote `list` responses must map connection edges into `RemotePageResult`. Keep list payloads lightweight; mark them `payloadCompleteness: 'LIST'`. Detail results are stored as `FULL`. Mutation adapters must return the server record and reuse the supplied idempotency key verbatim. For event workflows such as completed sales, set `mutationMode: 'EVENT'` so each queued action remains distinct. The default `STATE` mode coalesces unsent updates to one record.

When API inputs differ from stored payloads, supply `createPayload` and `updatePayload` to produce the optimistic local record. Without them, create uses the input as the payload and update performs a shallow merge.

The hook uses `items`, `hasMore`, and `loadMore()` for FlatList, FlashList, or web virtualized lists. The list selector receives the stable local record ID. `getById(id, { refreshFromServer: true })` loads full detail on selection. The coordinator runs outside React and can also be called by a background worker.
