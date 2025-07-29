-- Monitor pending invitations
SELECT pi.*, e.name as company_name 
FROM pending_invitations pi
JOIN employers e ON pi.employer_id = e.id
ORDER BY pi.created_at DESC;

-- Check user access after login
SELECT ue.*, u.email, e.name as company_name 
FROM user_employers ue
JOIN users u ON ue.user_id = u.id
JOIN employers e ON ue.employer_id = e.id
WHERE u.email IN ('infinitextpublishing@gmail.com', 'lucas.whelan@gmail.com')
ORDER BY ue.joined_at DESC;

-- Monitor audit log during testing
SELECT al.*, u.email as user_email, e.name as company_name
FROM audit_logs al
JOIN users u ON al.user_id = u.id
JOIN employers e ON al.employer_id = e.id
ORDER BY al.created_at DESC
LIMIT 10;

-- Check for duplicate access (should not exist)
SELECT user_id, employer_id, COUNT(*) as count
FROM user_employers
GROUP BY user_id, employer_id
HAVING COUNT(*) > 1;