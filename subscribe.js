const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',     // Your MySQL host
    user: 'root',          // Your MySQL username
    password: '',          // Your MySQL password (leave blank for XAMPP)
    database: 'goabroad_db'
})

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err)
        return
    }
    console.log('Connected to MySQL database!')
    
    // Create table if it doesn't exist
    const createTable = `
        CREATE TABLE IF NOT EXISTS subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
    
    db.query(createTable, (err) => {
        if (err) {
            console.error('Error creating table:', err)
        } else {
            console.log('Subscribers table ready')
        }
    })
})

// API endpoint for newsletter subscription
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body
    
    // Validate email
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email is required' 
        })
    }
    
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please enter a valid email address' 
        })
    }
    
    // Check if email already exists
    const checkQuery = 'SELECT * FROM subscribers WHERE email = ?'
    
    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error('Database error:', err)
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            })
        }
        
        if (results.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'This email is already subscribed!' 
            })
        }
        
        // Insert new subscriber
        const insertQuery = 'INSERT INTO subscribers (email) VALUES (?)'
        
        db.query(insertQuery, [email], (err, result) => {
            if (err) {
                console.error('Insert error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to subscribe' 
                })
            }
            
            res.json({ 
                success: true, 
                message: 'Successfully subscribed to newsletter!' 
            })
        })
    })
})

// Optional: Get all subscribers (for admin panel)
app.get('/api/subscribers', (req, res) => {
    db.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// Start server
const PORT = 3000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})