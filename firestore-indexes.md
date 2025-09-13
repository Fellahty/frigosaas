# Firestore Indexes Required

## Dashboard Query Index

If you want to use the original query with ordering (for better performance), you need to create this composite index:

### Collection: `receptions`
- Fields: `tenantId` (Ascending), `createdAt` (Descending)

### How to create:
1. Go to [Firebase Console](https://console.firebase.google.com/v1/r/project/frigosaas/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `receptions`
4. Add fields:
   - `tenantId` (Ascending)
   - `createdAt` (Descending)
5. Click "Create"

### Alternative: Use the current implementation
The current implementation avoids the need for this index by:
- Fetching all receptions for the tenant
- Sorting them client-side
- Limiting to 100 records

This works well for small to medium datasets but may be slower for very large datasets.

## Other Potential Indexes

### For better performance, consider creating these indexes:

1. **Rooms query**: `rooms` collection
   - Fields: `tenantId` (Ascending), `active` (Ascending)

2. **Empty crate loans**: `empty_crate_loans` collection
   - Fields: `tenantId` (Ascending)

3. **Reservations**: `tenants/{tenantId}/reservations` collection
   - Fields: `createdAt` (Descending) - if you want to order by creation date

## Current Status
✅ **Fixed**: Dashboard now works without requiring any additional indexes
✅ **Error Handling**: Added robust error handling for failed queries
✅ **Performance**: Client-side sorting and limiting for better compatibility
