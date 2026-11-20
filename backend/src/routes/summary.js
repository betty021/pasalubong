import { Router } from 'express';
import { query } from '../db.js';
import { wrap } from '../util.js';
import { requireAuth } from '../auth.js';

const r = Router();
const TZ = 'Asia/Manila';
const LOW_STOCK = 5;   // pasok sa "low stock" kapag ito o mas mababa

// Admin lang: buod para sa Dashboard tab
r.get('/', requireAuth('admin'), wrap(async (_req, res) => {
  const [counts, today, week, top, low] = await Promise.all([
    query(`SELECT status, count(*)::int AS n FROM orders GROUP BY status`),
    query(`SELECT COALESCE(sum(total),0)::float AS sales, count(*)::int AS orders
             FROM orders
            WHERE status <> 'cancelled'
              AND (created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  COALESCE(sum(o.total), 0)::float AS sales
             FROM generate_series((now() AT TIME ZONE '${TZ}')::date - 6,
                                  (now() AT TIME ZONE '${TZ}')::date, '1 day') d
             LEFT JOIN orders o
               ON o.status <> 'cancelled'
              AND (o.created_at AT TIME ZONE '${TZ}')::date = d::date
            GROUP BY d ORDER BY d`),
    query(`SELECT oi.product_name AS name, sum(oi.quantity)::int AS sold
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.status <> 'cancelled'
            GROUP BY oi.product_name ORDER BY sold DESC, name LIMIT 5`),
    query(`SELECT id, name, stock FROM products
            WHERE deleted_at IS NULL AND status = 'active' AND stock <= $1
            ORDER BY stock, name LIMIT 10`, [LOW_STOCK]),
  ]);

  const byStatus = { pending: 0, preparing: 0, ready: 0, out_for_delivery: 0, completed: 0, cancelled: 0 };
  for (const c of counts.rows) byStatus[c.status] = c.n;

  res.json({
    by_status: byStatus,
    today: today.rows[0],
    week: week.rows,
    top_products: top.rows,
    low_stock: low.rows,
    low_stock_limit: LOW_STOCK,
  });
}));

export default r;
