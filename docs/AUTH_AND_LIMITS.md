# Authentication & Rate Limiting

## 🔐 API Key Authentication

The Guardz Fetch Service uses API Key authentication to secure its endpoints.

### Usage
You must include your API key in every request using one of the following methods:

**1. Header: `x-api-key` (Recommended)**
```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/scans
```

**2. Header: `Authorization` (Bearer Token)**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/scans
```

### Getting an API Key
*   **Admin Key**: For development and initial setup, an Admin API Key is configured via the environment variable `ADMIN_API_KEY`.
    *   Default value in Docker: `123456`
*   **User Keys**: In a production scenario, unique API keys are generated for each user and stored in the database.

---

## 🚦 Rate Limiting

To prevent abuse and Ensure service stability, the application implements distributed rate limiting using Redis.

### Limits
The following limits are enforced:

*   **Global Limit**: 100 requests per minute by default.
*   **Scan Submission (`POST /scans`)**: 20 requests per minute.

### Configuration
Rate limits can be adjusted using environment variables in `docker-compose.yml` or `.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `THROTTLE_TTL` | `60000` | The time window in milliseconds (default: 60s). |
| `THROTTLE_LIMIT` | `100` | The maximum number of requests allowed within the window. |

### Exceeding Limits
If you exceed the rate limit, the API will respond with:

*   **Status Code**: `429 Too Many Requests`
*   **Body**:
    ```json
    {
      "statusCode": 429,
      "message": "ThrottlerException: Too Many Requests"
    }
    ```
