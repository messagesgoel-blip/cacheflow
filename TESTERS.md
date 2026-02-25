# CacheFlow Test Summary for Testers

## Quick Start

```bash
# Run all tests
./test_suite.sh all

# Run tests for specific day
./test_suite.sh day5    # Days 31-40
./test_suite.sh day8    # Days 71-80

# Run specific test
./test_suite.sh t045
```

## Test Categories

### Day 1-10: Infrastructure
| ID | What it tests |
|----|---------------|
| T-001 | PostgreSQL container running |
| T-002 | Redis container running |
| T-003 | API health endpoint |
| T-004 | Users table exists |
| T-005 | Files table exists |

### Day 11-20: Auth & Files
| ID | What it tests |
|----|---------------|
| T-011 | User registration endpoint |
| T-012 | User login endpoint |
| T-013 | File upload endpoint |
| T-014 | File download endpoint |
| T-015 | File delete endpoint |

### Day 21-30: Sync & Cloud
| ID | What it tests |
|----|---------------|
| T-021 | Cloud configs table |
| T-022 | Rclone in worker |
| T-023 | Sync logic |
| T-024 | Worker container running |
| T-025 | /mnt/local mount exists |

### Day 31-40: Sharing & Conflicts
| ID | What it tests |
|----|---------------|
| T-031 | Shared links table |
| T-032 | Share creation endpoint |
| T-033 | Conflicts table |
| T-034 | Conflict routes |
| T-035 | Conflict resolution |

### Day 41-50: Admin & Multi-tenant
| ID | What it tests |
|----|---------------|
| T-041 | Search endpoint |
| T-042 | Admin routes |
| T-043 | Admin notifications |
| T-044 | Tenants table |
| T-045 | Tenant ID migration |

### Day 51-60: Embeddings & UI
| ID | What it tests |
|----|---------------|
| T-051 | Embeddings service |
| T-052 | Vector search |
| T-053 | Web app exists |
| T-054 | Files page |
| T-055 | Web container |

### Day 61-70: Monitoring
| ID | What it tests |
|----|---------------|
| T-061 | Tailnet container |
| T-062 | Worker logging |
| T-063 | Error handling |
| T-064 | Worker logs directory |
| T-065 | API logs directory |

### Day 71-80: Security
| ID | What it tests |
|----|---------------|
| T-071 | Anthropic API integration |
| T-072 | Helmet security headers |
| T-073 | CORS configured |
| T-074 | Rate limiting |
| T-075 | Security page |

### Day 81-90: Complete Features
| ID | What it tests |
|----|---------------|
| T-081 | WebDAV container |
| T-082 | WebDAV port 8180 |
| T-083 | AI merge route |
| T-084 | AI merge file types |
| T-085 | Audit logs table |
| T-086 | Overflow sync |
| T-087 | Stale recovery |
| T-088 | API documentation |
| T-089 | Release notes |
| T-090 | PILOT RELEASE ready |

## Manual Test Checklist

### Web UI (http://cacheflow.goels.in)
- [ ] Register new account
- [ ] Login with credentials
- [ ] Upload file
- [ ] Download file
- [ ] Delete file
- [ ] Create share link
- [ ] View security page

### WebDAV (port 8180)
- [ ] Connect with credentials
- [ ] List files
- [ ] Download file

### API (http://127.0.0.1:8100)
- [ ] GET /health
- [ ] POST /auth/register
- [ ] POST /auth/login
- [ ] POST /files/upload
- [ ] GET /files/:id/download
- [ ] DELETE /files/:id
- [ ] POST /share
- [ ] GET /conflicts
- [ ] POST /conflicts/:id/resolve

## Expected Results

**Pass rate: 89/90 (99%)**
- T-003 may fail in containerized environments (network isolation)

## Services
| Service | Port | Container |
|---------|------|-----------|
| API | 8100 | cacheflow-api |
| Web | 3010 | cacheflow-web |
| WebDAV | 8180 | cacheflow-webdav |
| Postgres | 5433 | cacheflow-postgres |
| Redis | 6380 | cacheflow-redis |
| Worker | - | cacheflow-worker |
