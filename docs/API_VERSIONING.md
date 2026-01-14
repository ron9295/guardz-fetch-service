# API Versioning

## Overview
The Guardz Fetch Service API uses URI-based versioning to ensure backward compatibility and smooth API evolution.

## Current Version
**v1** - Initial stable release

## Endpoints

All endpoints are now prefixed with `/api/v1`:

### Scans
- `POST /api/v1/scans` - Start a new fetch request
- `GET /api/v1/scans/:id/results` - Get paginated results
- `GET /api/v1/scans/:id/status` - Get request status

## Examples

### Start a fetch request
```bash
curl -X POST http://localhost:3000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}'
```

### Get results
```bash
curl http://localhost:3000/api/v1/scans/{requestId}/results?cursor=0&limit=10
```

### Get status
```bash
curl http://localhost:3000/api/v1/scans/{requestId}/status
```

## Future Versions

When introducing breaking changes, create a new version (v2) while maintaining v1:

```typescript
// v2 controller example
@Controller({ path: 'scans', version: '2' })
export class AppControllerV2 {
  // New implementation
}
```

Both versions can coexist:
- `/api/v1/scans` - Legacy clients
- `/api/v2/scans` - New clients

## Swagger Documentation

API documentation is available at: `http://localhost:3000/docs`

The Swagger UI automatically groups endpoints by version.
