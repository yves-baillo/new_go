const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'goabroad_db'
})

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err)
        return
    }
    console.log('Connected to MySQL database!')
    
    // Create subscribers table
    const createSubscribersTable = `
        CREATE TABLE IF NOT EXISTS subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
    
    // Create contacts table with updated fields
    const createContactsTable = `
        CREATE TABLE IF NOT EXISTS contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
    
    db.query(createSubscribersTable, (err) => {
        if (err) console.error('Error creating subscribers table:', err)
        else console.log('Subscribers table ready')
    })
    
    db.query(createContactsTable, (err) => {
        if (err) console.error('Error creating contacts table:', err)
        else console.log('Contacts table ready')
    })
})

// Make db available to all route files
app.use((req, res, next) => {
    req.db = db
    next()
})

// Import route files
const subscribeRoutes = require('./subscribe')
const contactRoutes = require('./contact')

// Use routes
app.use('/api', subscribeRoutes)  // POST /api/subscribe, GET /api/subscribers
app.use('/api', contactRoutes)     // POST /api/contact, GET /api/contacts

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'GoAbroad Admissions API',
        version: '1.0.0',
        endpoints: {
            subscribe: 'POST /api/subscribe',
            subscribers: 'GET /api/subscribers',
            contact: 'POST /api/contact',
            contacts: 'GET /api/contacts'
        }
    })
})

// Start server
const PORT = 3000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})