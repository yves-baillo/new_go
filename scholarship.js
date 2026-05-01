const express = require('express')
const router = express.Router()

// Middleware to verify token (import from main app or redefine)
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' })
    }
    
    const jwt = require('jsonwebtoken')
    const JWT_SECRET = 'goabroad-secret-key-2024'
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Invalid token' })
        }
        req.adminId = decoded.id
        req.adminUsername = decoded.username
        next()
    })
}

// POST /api/scholarship/inquiry - Public (no auth needed)
router.post('/scholarship/inquiry', (req, res) => {
    const { fullName, email, phone, scholarshipTitle, message } = req.body
    const db = req.db
    
    if (!fullName || !email || !scholarshipTitle || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required' })
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' })
    }
    
    db.query(
        'INSERT INTO scholarship_inquiries (full_name, email, phone, scholarship_title, message) VALUES (?, ?, ?, ?, ?)',
        [fullName, email, phone || null, scholarshipTitle, message],
        (err, result) => {
            if (err) {
                console.error('Insert error:', err)
                return res.status(500).json({ success: false, message: 'Failed to submit inquiry' })
            }
            res.json({ 
                success: true, 
                message: 'Inquiry submitted successfully! We will contact you within 24 hours.',
                inquiryId: result.insertId
            })
        }
    )
})

// GET /api/scholarship/inquiries - Protected (admin only)
router.get('/scholarship/inquiries', verifyToken, (req, res) => {
    const db = req.db
    db.query('SELECT * FROM scholarship_inquiries ORDER BY created_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// GET /api/scholarship/inquiry/:id - Protected (get single inquiry)
router.get('/scholarship/inquiry/:id', verifyToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('SELECT * FROM scholarship_inquiries WHERE id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' })
        }
        res.json(results[0])
    })
})

// PUT /api/scholarship/inquiry/:id/status - Protected (update status)
router.put('/scholarship/inquiry/:id/status', verifyToken, (req, res) => {
    const { id } = req.params
    const { status } = req.body
    const db = req.db
    
    if (!['pending', 'contacted', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' })
    }
    
    db.query('UPDATE scholarship_inquiries SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update status' })
        }
        res.json({ success: true, message: 'Status updated successfully' })
    })
})

// DELETE /api/scholarship/inquiry/:id - Protected (delete inquiry)
router.delete('/scholarship/inquiry/:id', verifyToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('DELETE FROM scholarship_inquiries WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete' })
        }
        res.json({ success: true, message: 'Inquiry deleted successfully' })
    })
})

// GET /api/scholarship/stats - Public (no auth needed)
router.get('/scholarship/stats', (req, res) => {
    const db = req.db
    db.query(`
        SELECT 
            COUNT(*) as total_inquiries,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_inquiries,
            SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_inquiries,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_inquiries
        FROM scholarship_inquiries
    `, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results[0])
    })
})

// GET /api/scholarship/popular - Public (most popular scholarships)
router.get('/scholarship/popular', (req, res) => {
    const db = req.db
    db.query(`
        SELECT scholarship_title, COUNT(*) as inquiry_count 
        FROM scholarship_inquiries 
        GROUP BY scholarship_title 
        ORDER BY inquiry_count DESC 
        LIMIT 10
    `, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

module.exports = router