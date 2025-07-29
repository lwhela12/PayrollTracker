# Testing Invitation System

## API Endpoints to Test

### 1. Send Single Company Invitation
```bash
curl -X POST http://localhost:5000/api/employers/20/invite \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "Employee"}' \
  --cookie-jar cookies.txt
```

### 2. Send Multi-Company Invitation
```bash
curl -X POST http://localhost:5000/api/invitations/multi-company \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "companies": [
      {"employerId": 20, "role": "Admin"},
      {"employerId": 21, "role": "Employee"}
    ]
  }' \
  --cookie-jar cookies.txt
```

### 3. Check Pending Invitations
```bash
curl -X GET http://localhost:5000/api/employers/20/invitations \
  --cookie-jar cookies.txt
```

### 4. Check Team Members
```bash
curl -X GET http://localhost:5000/api/employers/20/users \
  --cookie-jar cookies.txt
```

## Testing Database Queries

### Check Pending Invitations
```sql
SELECT * FROM pending_invitations WHERE email = 'test@example.com';
```

### Check User-Employer Relationships
```sql
SELECT ue.*, u.email, e.name as company_name 
FROM user_employers ue
JOIN users u ON ue.user_id = u.id
JOIN employers e ON ue.employer_id = e.id;
```

### Check Audit Log
```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```