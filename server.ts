import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS sales_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_point_id INTEGER,
    quantity INTEGER DEFAULT 0,
    manufacturing_date TEXT,
    delivery_date TEXT,
    due_date TEXT,
    returned_quantity INTEGER DEFAULT 0,
    withdrawal_date TEXT,
    unit_value REAL DEFAULT 0,
    total_value REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'ABERTO',
    FOREIGN KEY (sales_point_id) REFERENCES sales_points(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    product TEXT,
    value REAL DEFAULT 0,
    category TEXT
  );
`);

// Migration: Add phone column if it doesn't exist (for existing databases)
try {
  db.exec("ALTER TABLE sales_points ADD COLUMN phone TEXT");
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.exec("ALTER TABLE sales ADD COLUMN product_name TEXT DEFAULT 'Brownie'");
} catch (e) { }

try {
  db.exec("ALTER TABLE sales ADD COLUMN reference_month TEXT");
} catch (e) { }

// Populate reference_month if null
db.exec("UPDATE sales SET reference_month = strftime('%Y-%m', delivery_date) WHERE reference_month IS NULL OR reference_month = ''");

// Seed initial data if empty
const pointsCount = db.prepare("SELECT COUNT(*) as count FROM sales_points").get() as { count: number };
if (pointsCount.count === 0) {
  const points = [
    "Adega MilDrinks", "Adega Fênix", "Eris Burger", "Padaria Almeida",
    "Padaria Alquimia", "Padaria São Sebastião", "Padaria Shalon",
    "Mercado Pinheiro", "Padaria Primor Carolina", "Colégio Anglo",
    "Padaria Itamaraty", "Padaria do Rodrigo", "BPT São Vicente",
    "BPT Itamaraty", "Padaria Vidotto", "Padaria Primor São Vicente",
    "Padaria Nova Ypê", "Mercado Okeo Manacás", "Restaurante Tofoli"
  ];
  const insertPoint = db.prepare("INSERT INTO sales_points (name) VALUES (?)");
  points.forEach(p => insertPoint.run(p));
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/sales-points", (req, res) => {
    const points = db.prepare("SELECT * FROM sales_points ORDER BY name").all();
    res.json(points);
  });

  app.delete("/api/sales-points/:id", (req, res) => {
    const id = req.params.id;
    db.prepare("DELETE FROM sales WHERE sales_point_id = ?").run(id);
    db.prepare("DELETE FROM sales_points WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/sales-points", (req, res) => {
    const { name, phone } = req.body;
    try {
      const result = db.prepare("INSERT INTO sales_points (name, phone) VALUES (?, ?)").run(name, phone);
      res.json({ id: result.lastInsertRowid, name, phone });
    } catch (e) {
      res.status(400).json({ error: "Name already exists" });
    }
  });

  app.patch("/api/sales-points/:id", (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;
    try {
      db.prepare("UPDATE sales_points SET phone = ? WHERE id = ?").run(phone, id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update sales point" });
    }
  });

  app.get("/api/sales/:pointId", (req, res) => {
    const sales = db.prepare("SELECT * FROM sales WHERE sales_point_id = ? ORDER BY delivery_date DESC").all(req.params.pointId);
    res.json(sales);
  });

  app.post("/api/sales", (req, res) => {
    const {
      sales_point_id, quantity, manufacturing_date, delivery_date,
      due_date, returned_quantity, withdrawal_date, unit_value,
      total_value, payment_status, product_name, reference_month
    } = req.body;

    const prod = product_name || 'Brownie';
    const ref_month = reference_month || delivery_date.substring(0, 7);

    const result = db.prepare(`
      INSERT INTO sales (
        sales_point_id, quantity, manufacturing_date, delivery_date, 
        due_date, returned_quantity, withdrawal_date, unit_value, 
        total_value, payment_status, product_name, reference_month
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sales_point_id, quantity, manufacturing_date, delivery_date,
      due_date, returned_quantity, withdrawal_date, unit_value,
      total_value, payment_status, prod, ref_month
    );
    res.json({ id: result.lastInsertRowid, ...req.body, product_name: prod, reference_month: ref_month });
  });

  app.patch("/api/sales/:id", (req, res) => {
    const { payment_status, returned_quantity } = req.body;
    const id = req.params.id;

    if (payment_status !== undefined) {
      db.prepare("UPDATE sales SET payment_status = ? WHERE id = ?").run(payment_status, id);
    }

    if (returned_quantity !== undefined) {
      const sale = db.prepare("SELECT quantity, unit_value FROM sales WHERE id = ?").get(id) as { quantity: number, unit_value: number };
      if (sale) {
        const newTotal = (sale.quantity - returned_quantity) * sale.unit_value;
        db.prepare("UPDATE sales SET returned_quantity = ?, total_value = ? WHERE id = ?").run(returned_quantity, newTotal, id);
      }
    }
    res.json({ success: true });
  });

  app.delete("/api/sales/:id", (req, res) => {
    db.prepare("DELETE FROM sales WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/expenses", (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(expenses);
  });

  app.post("/api/expenses", (req, res) => {
    const { date, product, value, category } = req.body;
    const result = db.prepare("INSERT INTO expenses (date, product, value, category) VALUES (?, ?, ?, ?)").run(date, product, value, category);
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  app.delete("/api/expenses/:id", (req, res) => {
    db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const filter = req.query.filter;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    let salesWhere = "";
    let expensesWhere = "";
    let salesParams: any[] = [];
    let expensesParams: any[] = [];

    if (filter === 'month') {
      salesWhere = "WHERE strftime('%Y-%m', delivery_date) = ?";
      expensesWhere = "WHERE strftime('%Y-%m', date) = ?";
      salesParams = [`${currentYear}-${currentMonth}`];
      expensesParams = [`${currentYear}-${currentMonth}`];
    } else if (filter === 'year') {
      salesWhere = "WHERE strftime('%Y', delivery_date) = ?";
      expensesWhere = "WHERE strftime('%Y', date) = ?";
      salesParams = [`${currentYear}`];
      expensesParams = [`${currentYear}`];
    }

    const totalSales = db.prepare(`SELECT SUM(total_value) as total FROM sales ${salesWhere}`).get(...salesParams) as { total: number };
    const totalReceived = db.prepare(`SELECT SUM(total_value) as total FROM sales ${salesWhere ? salesWhere + " AND" : "WHERE"} payment_status = 'PAGO'`).get(...salesParams) as { total: number };
    const totalPending = db.prepare(`SELECT SUM(total_value) as total FROM sales ${salesWhere ? salesWhere + " AND" : "WHERE"} payment_status = 'ABERTO'`).get(...salesParams) as { total: number };
    const totalExpenses = db.prepare(`SELECT SUM(value) as total FROM expenses ${expensesWhere}`).get(...expensesParams) as { total: number };

    res.json({
      totalSales: totalSales.total || 0,
      totalReceived: totalReceived.total || 0,
      totalPending: totalPending.total || 0,
      totalExpenses: totalExpenses.total || 0,
      balance: (totalSales.total || 0) - (totalExpenses.total || 0)
    });
  });

  app.get("/api/expiring-sales", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    const expiring = db.prepare(`
      SELECT s.*, sp.name as point_name, sp.phone as point_phone
      FROM sales s
      JOIN sales_points sp ON s.sales_point_id = sp.id
      WHERE s.due_date BETWEEN ? AND ?
      AND s.payment_status = 'ABERTO'
      ORDER BY s.due_date ASC
    `).all(today, threeDaysStr);

    res.json(expiring);
  });

  app.get("/api/reports/sales", (req, res) => {
    const { month, point_id, product } = req.query;
    let query = `
      SELECT s.*, sp.name as point_name 
      FROM sales s 
      JOIN sales_points sp ON s.sales_point_id = sp.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (month) {
      query += " AND s.reference_month = ?";
      params.push(month);
    }
    if (point_id) {
      query += " AND s.sales_point_id = ?";
      params.push(point_id);
    }
    if (product) {
      query += " AND s.product_name LIKE ?";
      params.push(`%${product}%`);
    }

    query += " ORDER BY s.delivery_date DESC";

    const data = db.prepare(query).all(...params);
    res.json(data);
  });

  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT DISTINCT product_name FROM sales WHERE product_name IS NOT NULL").all().map((row: any) => row.product_name);
    res.json(products);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
