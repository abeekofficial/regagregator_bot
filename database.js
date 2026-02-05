const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database/taxi.db';

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('✅ Database connected');
        this.init();
      }
    });
  }

  init() {
    this.db.serialize(() => {
      // Users jadvali (umumiy)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id INTEGER UNIQUE NOT NULL,
          username TEXT,
          role TEXT CHECK(role IN ('passenger', 'driver', 'admin')) NOT NULL,
          phone TEXT,
          full_name TEXT,
          referrer_id INTEGER,
          referral_count INTEGER DEFAULT 0,
          rating REAL DEFAULT 5.0,
          total_ratings INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          is_blocked INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(telegram_id)
        )
      `);

      // Haydovchilar ma'lumotlari
      this.db.run(`
        CREATE TABLE IF NOT EXISTS drivers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id INTEGER UNIQUE NOT NULL,
          car_model TEXT NOT NULL,
          car_number TEXT NOT NULL,
          car_color TEXT,
          license_number TEXT,
          is_verified INTEGER DEFAULT 0,
          is_available INTEGER DEFAULT 1,
          current_lat REAL,
          current_lon REAL,
          FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
        )
      `);

      // Buyurtmalar
      this.db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          passenger_id INTEGER NOT NULL,
          driver_id INTEGER,
          from_location TEXT NOT NULL,
          to_location TEXT NOT NULL,
          from_lat REAL,
          from_lon REAL,
          to_lat REAL,
          to_lon REAL,
          distance REAL,
          price REAL,
          status TEXT CHECK(status IN ('pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
          cancelled_by INTEGER,
          cancel_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          assigned_at DATETIME,
          accepted_at DATETIME,
          completed_at DATETIME,
          FOREIGN KEY (passenger_id) REFERENCES users(telegram_id),
          FOREIGN KEY (driver_id) REFERENCES users(telegram_id)
        )
      `);

      // Buyurtma takliflari (qaysi haydovchiga yuborilgan)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS order_offers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          driver_id INTEGER NOT NULL,
          offered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          response TEXT CHECK(response IN ('pending', 'accepted', 'rejected', 'timeout')),
          response_at DATETIME,
          priority_score INTEGER DEFAULT 0,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (driver_id) REFERENCES drivers(telegram_id)
        )
      `);

      // Reytinglar
      this.db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          from_user INTEGER NOT NULL,
          to_user INTEGER NOT NULL,
          rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (from_user) REFERENCES users(telegram_id),
          FOREIGN KEY (to_user) REFERENCES users(telegram_id)
        )
      `);

      // Firibgarlik hisobotlari
      this.db.run(`
        CREATE TABLE IF NOT EXISTS fraud_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_id INTEGER NOT NULL,
          reported_user_id INTEGER NOT NULL,
          order_id INTEGER,
          reason TEXT NOT NULL,
          description TEXT,
          status TEXT CHECK(status IN ('pending', 'investigating', 'resolved', 'dismissed')) DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          admin_notes TEXT,
          FOREIGN KEY (reporter_id) REFERENCES users(telegram_id),
          FOREIGN KEY (reported_user_id) REFERENCES users(telegram_id),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        )
      `);

      // Xabarlar tarixi
      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          from_user INTEGER NOT NULL,
          to_user INTEGER NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (from_user) REFERENCES users(telegram_id),
          FOREIGN KEY (to_user) REFERENCES users(telegram_id)
        )
      `);

      // Indexlar yaratish (tezlik uchun)
      this.db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_passenger ON orders(passenger_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_offers_order ON order_offers(order_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_offers_driver ON order_offers(driver_id)');

      console.log('✅ Database tables created/verified');
    });
  }

  // Helper metodlar
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();
