# Counter session API contract

The mobile app reads `organization.config.currency` and requests denominations through:

```graphql
currencyDenominations(currencyCode: String!) {
  id
  currencyCode
  value
  label
  sortOrder
}
```

The POS backend should resolve this query from `currency_denomination`, filtering `is_active = true` and
ordering by `sort_order`. Apply `scripts/seed-currency-denominations.sql` to the backend database to create
and seed INR, USD, EUR, GBP, and AED values. The mobile fallback exists only to keep counter opening usable
during an API outage.
