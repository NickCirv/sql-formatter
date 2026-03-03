-- Complex test SQL file for sql-formatter

-- CTE example
WITH active_users AS (
  SELECT u.id, u.name, u.email, u.created_at FROM users u WHERE u.active = 1 AND u.deleted_at IS NULL
), order_counts AS (
  SELECT user_id, COUNT(*) AS total_orders, SUM(amount) AS total_spent FROM orders WHERE status IN ('completed','shipped') GROUP BY user_id
)
SELECT au.id, au.name, au.email, COALESCE(oc.total_orders, 0) AS orders, COALESCE(oc.total_spent, 0.00) AS spent, CASE WHEN oc.total_spent > 1000 THEN 'VIP' WHEN oc.total_spent > 500 THEN 'Regular' ELSE 'New' END AS tier FROM active_users au LEFT JOIN order_counts oc ON au.id = oc.user_id ORDER BY oc.total_spent DESC LIMIT 50 OFFSET 0;

-- Subquery example
SELECT p.id, p.title, p.price, (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.approved = TRUE) AS avg_rating FROM products p WHERE p.category_id IN (SELECT id FROM categories WHERE parent_id = 5 AND active = 1) AND p.stock > 0 ORDER BY avg_rating DESC, p.price ASC;

-- INSERT example
INSERT INTO orders (user_id, product_id, quantity, unit_price, status, created_at) VALUES (42, 101, 3, 29.99, 'pending', NOW()), (42, 205, 1, 149.00, 'pending', NOW()), (42, 308, 2, 9.99, 'pending', NOW());

-- UPDATE with JOIN
UPDATE inventory i SET i.quantity = i.quantity - od.quantity, i.updated_at = NOW() FROM order_details od INNER JOIN orders o ON od.order_id = o.id WHERE o.status = 'confirmed' AND i.product_id = od.product_id AND i.quantity >= od.quantity;

-- CREATE TABLE
CREATE TABLE IF NOT EXISTS user_sessions (id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_token VARCHAR(255) NOT NULL UNIQUE, ip_address VARCHAR(45), user_agent TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NOT NULL, last_active TIMESTAMP);

-- Complex SELECT with HAVING
SELECT d.name AS department, COUNT(e.id) AS employee_count, AVG(e.salary) AS avg_salary, MAX(e.salary) AS max_salary, MIN(e.hire_date) AS oldest_hire FROM departments d LEFT JOIN employees e ON d.id = e.department_id WHERE d.active = TRUE GROUP BY d.id, d.name HAVING COUNT(e.id) > 5 AND AVG(e.salary) BETWEEN 50000 AND 200000 ORDER BY avg_salary DESC;

-- UNION example
SELECT id, name, email, 'admin' AS role FROM admins WHERE active = 1 UNION SELECT id, username, email, 'user' AS role FROM users WHERE banned = 0 UNION SELECT id, display_name, contact_email, 'vendor' AS role FROM vendors WHERE verified = 1 ORDER BY name ASC;

-- DELETE with subquery
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE last_login < NOW() - INTERVAL 90 DAY AND account_type = 'guest') AND created_at < NOW() - INTERVAL 7 DAY;
