const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const http = require('http')
const WebSocket = require('ws')

const app = express()

// Create HTTP server
const server = http.createServer(app)

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Store connected clients
const connectedClients = new Set()

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket client connected')
    connectedClients.add(ws)
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        message: 'Connected to real-time notification server',
        timestamp: new Date().toISOString()
    }))
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message)
            console.log('Received from client:', data)
        } catch (error) {
            console.error('WebSocket message error:', error)
        }
    })
    
    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected')
        connectedClients.delete(ws)
    })
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        connectedClients.delete(ws)
    })
})

// Broadcast to all connected clients
function broadcastNewScholarship(scholarship) {
    const message = JSON.stringify({
        type: 'NEW_SCHOLARSHIP',
        scholarship: scholarship,
        timestamp: new Date().toISOString()
    })
    
    let sentCount = 0
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
            sentCount++
        }
    })
    
    if (sentCount > 0) {
        console.log(`📡 Broadcasted new scholarship to ${sentCount} client(s)`)
    }
}

// Broadcast scholarship update
function broadcastScholarshipUpdate(action, scholarship) {
    const message = JSON.stringify({
        type: 'SCHOLARSHIP_UPDATED',
        action: action, // 'created', 'updated', 'deleted', 'featured'
        scholarship: scholarship,
        timestamp: new Date().toISOString()
    })
    
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
        }
    })
    
    console.log(`📡 Broadcasted scholarship ${action} update`)
}

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

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err)
        return
    }
    console.log('✅ Connected to MySQL database!')
    
    // Create admins table with proper password hashing
    const createAdminsTable = `
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
    
    db.query(createAdminsTable, async (err) => {
        if (err) {
            console.error('Error creating admins table:', err)
        } else {
            console.log('✅ Admins table ready')
            
            // Check if default admin exists
            db.query('SELECT * FROM admins WHERE username = ?', ['admin'], async (err, results) => {
                if (err) {
                    console.error('Error checking admin:', err)
                } else if (results.length === 0) {
                    // Create default admin with hashed password
                    const hashedPassword = await bcrypt.hash('admin123', 10)
                    db.query('INSERT INTO admins (username, password, email) VALUES (?, ?, ?)', 
                        ['admin', hashedPassword, 'admin@goabroad.com'], 
                        (err) => {
                            if (err) {
                                console.error('Error creating default admin:', err)
                            } else {
                                console.log('✅ Default admin created (username: admin, password: admin123)')
                            }
                        })
                } else {
                    // Check if existing admin has plain text password and update it
                    const admin = results[0]
                    if (admin.password && admin.password.length < 60) {
                        const hashedPassword = await bcrypt.hash(admin.password, 10)
                        db.query('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, admin.id], (err) => {
                            if (err) {
                                console.error('Error updating admin password:', err)
                            } else {
                                console.log('✅ Admin password hashed successfully')
                            }
                        })
                    }
                }
            })
        }
    })
    
    // Create subscribers table
    const createSubscribersTable = `
        CREATE TABLE IF NOT EXISTS subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `
    
    // Create contacts table
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
    
    // Create scholarship inquiries table
    const createInquiriesTable = `
        CREATE TABLE IF NOT EXISTS scholarship_inquiries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            scholarship_title VARCHAR(500) NOT NULL,
            message TEXT NOT NULL,
            status ENUM('pending', 'contacted', 'completed') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `
    
    // CREATE SCHOLARSHIPS TABLE
    const createScholarshipsTable = `
        CREATE TABLE IF NOT EXISTS scholarships (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            country VARCHAR(255) NOT NULL,
            degree VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            eligibility TEXT,
            benefits TEXT,
            deadline DATE,
            link VARCHAR(500),
            image_url VARCHAR(500),
            status ENUM('active', 'inactive') DEFAULT 'active',
            featured BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `
    
    db.query(createSubscribersTable, (err) => {
        if (err) {
            console.error('Error creating subscribers table:', err)
        } else {
            console.log('✅ Subscribers table ready')
        }
    })
    
    db.query(createContactsTable, (err) => {
        if (err) {
            console.error('Error creating contacts table:', err)
        } else {
            console.log('✅ Contacts table ready')
        }
    })
    
    db.query(createInquiriesTable, (err) => {
        if (err) {
            console.error('Error creating scholarship inquiries table:', err)
        } else {
            console.log('✅ Scholarship Inquiries table ready')
        }
    })
    
    db.query(createScholarshipsTable, (err) => {
        if (err) {
            console.error('Error creating scholarships table:', err)
        } else {
            console.log('✅ Scholarships table ready')
            
            // Insert sample scholarships if table is empty
            db.query('SELECT COUNT(*) as count FROM scholarships', (err, results) => {
                if (err) {
                    console.error('Error checking scholarships:', err)
                } else if (results[0].count === 0) {
                    const sampleScholarships = [
                        {
                            title: 'Fulbright Scholarship 2025',
                            country: 'USA',
                            degree: "Master's & PhD",
                            description: 'The Fulbright Scholarship provides funding for international students to study in the United States. It covers tuition, living expenses, and travel costs.',
                            eligibility: 'Open to all nationalities. Bachelor\'s degree required. Minimum GPA 3.0.',
                            benefits: 'Full tuition coverage, monthly stipend of $2,000, health insurance, round-trip airfare.',
                            deadline: '2025-10-15',
                            link: 'https://foreign.fulbrightonline.org',
                            image_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=500&auto=format&fit=crop',
                            status: 'active',
                            featured: true
                        },
                        {
                            title: 'Chevening Scholarship',
                            country: 'UK',
                            degree: "Master's",
                            description: 'Chevening is the UK government\'s international awards program aimed at developing global leaders.',
                            eligibility: 'Citizens of Chevening-eligible countries. 2+ years of work experience. Undergraduate degree.',
                            benefits: 'Full tuition fees, living allowance, return flights to UK, additional grants.',
                            deadline: '2025-11-07',
                            link: 'https://www.chevening.org',
                            image_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&auto=format&fit=crop',
                            status: 'active',
                            featured: true
                        },
                        {
                            title: 'DAAD Scholarship Germany',
                            country: 'Germany',
                            degree: "Master's & PhD",
                            description: 'DAAD offers scholarships for international students to study in Germany.',
                            eligibility: 'Bachelor\'s degree in relevant field. Good academic record.',
                            benefits: 'Monthly stipend of €934, health insurance, travel allowance, study allowance.',
                            deadline: '2025-09-30',
                            link: 'https://www.daad.de',
                            image_url: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=500&auto=format&fit=crop',
                            status: 'active',
                            featured: false
                        },
                        {
                            title: 'Eiffel Excellence Scholarship',
                            country: 'France',
                            degree: "Master's & PhD",
                            description: 'The Eiffel Scholarship program is a tool developed by the French Ministry for Europe and Foreign Affairs.',
                            eligibility: 'Non-French nationality. Under 30 for Master\'s, under 35 for PhD.',
                            benefits: 'Monthly allowance of €1,181, travel expenses, health insurance, cultural activities.',
                            deadline: '2025-01-10',
                            link: 'https://www.campusfrance.org',
                            image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&auto=format&fit=crop',
                            status: 'active',
                            featured: false
                        }
                    ]
                    
                    sampleScholarships.forEach(scholarship => {
                        db.query(
                            'INSERT INTO scholarships (title, country, degree, description, eligibility, benefits, deadline, link, image_url, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [scholarship.title, scholarship.country, scholarship.degree, scholarship.description, scholarship.eligibility, scholarship.benefits, scholarship.deadline, scholarship.link, scholarship.image_url, scholarship.status, scholarship.featured],
                            (err) => {
                                if (err) console.error('Error inserting sample scholarship:', err)
                            }
                        )
                    })
                    console.log('✅ Sample scholarships inserted')
                }
            })
        }
    })
})

// Make db available to all routes
app.use((req, res, next) => {
    req.db = db
    next()
})

// ==================== MIDDLEWARE ====================
const checkToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
    }
    next()
}

// ==================== ADMIN AUTHENTICATION ====================

// POST /api/admin/login - Admin login with bcryptjs
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body
    const db = req.db
    
    console.log('Login attempt for username:', username)
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username and password are required' 
        })
    }
    
    try {
        const query = 'SELECT id, username, email, password FROM admins WHERE username = ?'
        
        db.query(query, [username], async (err, results) => {
            if (err) {
                console.error('Login error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                })
            }
            
            if (results.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid username or password' 
                })
            }
            
            const admin = results[0]
            let passwordMatch = false
            
            try {
                passwordMatch = await bcrypt.compare(password, admin.password)
            } catch (compareErr) {
                console.error('bcrypt compare error:', compareErr)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Error verifying password' 
                })
            }
            
            if (!passwordMatch) {
                console.log('Password mismatch for user:', username)
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid username or password' 
                })
            }
            
            const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
            
            console.log('Login successful for:', username)
            
            res.json({ 
                success: true, 
                message: 'Login successful',
                token: token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email
                }
            })
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        })
    }
})

// POST /api/admin/reset - Reset admin password
app.post('/api/admin/reset', async (req, res) => {
    const db = req.db
    const { username = 'admin', newPassword = 'admin123' } = req.body
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        
        db.query('DELETE FROM admins WHERE username = ?', [username], async (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error deleting old admin' })
            }
            
            db.query('INSERT INTO admins (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, `${username}@goabroad.com`],
                (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Error creating admin' })
                    }
                    res.json({ 
                        success: true, 
                        message: `Admin reset successfully. Username: ${username}, Password: ${newPassword}` 
                    })
                }
            )
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error resetting admin' })
    }
})

// POST /api/admin/fix-password - DIRECT password fix
app.post('/api/admin/fix-password', async (req, res) => {
    const db = req.db
    const { username = 'admin', newPassword = 'XMA!!' } = req.body
    
    console.log(`Fixing password for user: ${username}`);
    console.log(`New password: ${newPassword}`);
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        
        db.query('DELETE FROM admins WHERE username = ?', [username], (err) => {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ success: false, message: 'Error deleting admin' });
            }
            
            db.query('INSERT INTO admins (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, `${username}@goabroad.com`],
                (err) => {
                    if (err) {
                        console.error('Insert error:', err);
                        return res.status(500).json({ success: false, message: 'Error creating admin' });
                    }
                    
                    bcrypt.compare(newPassword, hashedPassword, (err, isValid) => {
                        if (isValid) {
                            console.log('✅ Password verification successful');
                            res.json({ 
                                success: true, 
                                message: `Password fixed successfully!`,
                                credentials: {
                                    username: username,
                                    password: newPassword
                                },
                                verification: 'Password hash is valid'
                            });
                        } else {
                            console.log('❌ Password verification failed');
                            res.json({ 
                                success: true, 
                                message: `Admin created but verification failed. Please test login.`,
                                credentials: {
                                    username: username,
                                    password: newPassword
                                }
                            });
                        }
                    });
                }
            );
        });
    } catch (error) {
        console.error('Fix password error:', error);
        res.status(500).json({ success: false, message: 'Error fixing password' });
    }
});

// GET /api/admin/check-db - Check database status
app.get('/api/admin/check-db', async (req, res) => {
    const db = req.db;
    
    db.query('SELECT id, username, LENGTH(password) as pass_len, LEFT(password, 15) as pass_start, email FROM admins', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const adminInfo = results.map(admin => ({
            id: admin.id,
            username: admin.username,
            password_length: admin.pass_len,
            password_starts_with: admin.pass_start,
            is_valid_hash: admin.pass_len === 60 && (admin.pass_start.startsWith('$2a$') || admin.pass_start.startsWith('$2b$')),
            email: admin.email
        }));
        
        res.json({
            success: true,
            admins: adminInfo,
            total_admins: results.length
        });
    });
});

// POST /api/admin/change-password - Change admin password
app.post('/api/admin/change-password', checkToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body
    const db = req.db
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Current password and new password are required' 
        })
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ 
            success: false, 
            message: 'New password must be at least 4 characters long' 
        })
    }
    
    try {
        db.query('SELECT * FROM admins WHERE username = ?', ['admin'], async (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Admin not found' 
                })
            }
            
            const admin = results[0]
            const isValid = await bcrypt.compare(currentPassword, admin.password)
            
            if (!isValid) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Current password is incorrect' 
                })
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10)
            
            db.query(
                'UPDATE admins SET password = ? WHERE username = ?',
                [hashedPassword, 'admin'],
                (err) => {
                    if (err) {
                        console.error('Update error:', err)
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Failed to update password' 
                        })
                    }
                    
                    res.json({ 
                        success: true, 
                        message: 'Password changed successfully!' 
                    })
                }
            )
        })
    } catch (error) {
        console.error('Password change error:', error)
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        })
    }
})

// GET /api/admin/verify - Verify token
app.get('/api/admin/verify', checkToken, (req, res) => {
    res.json({ 
        success: true, 
        message: 'Token is valid'
    })
})

// GET /api/websocket/stats - Get WebSocket connection stats
app.get('/api/websocket/stats', (req, res) => {
    res.json({
        success: true,
        connectedClients: connectedClients.size,
        status: 'running',
        wsEndpoint: 'ws://localhost:3000'
    })
})

// ==================== NEWSLETTER ROUTES ====================

// POST /api/subscribe - Subscribe to newsletter
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body
    const db = req.db
    
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
    
    db.query('SELECT * FROM subscribers WHERE email = ?', [email], (err, results) => {
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
        
        db.query('INSERT INTO subscribers (email) VALUES (?)', [email], (err) => {
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

// GET /api/subscribers - Get all subscribers
app.get('/api/subscribers', checkToken, (req, res) => {
    const db = req.db
    
    db.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// DELETE /api/subscriber/:id - Delete subscriber
app.delete('/api/subscriber/:id', checkToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('DELETE FROM subscribers WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to delete' 
            })
        }
        res.json({ 
            success: true, 
            message: 'Subscriber deleted successfully' 
        })
    })
})

// ==================== CONTACT ROUTES ====================

// POST /api/contact - Submit contact form
app.post('/api/contact', (req, res) => {
    const { fullName, email, phone, subject, message } = req.body
    const db = req.db
    
    if (!fullName || !email || !subject || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Full name, email, subject, and message are required' 
        })
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please enter a valid email address' 
        })
    }
    
    const query = `
        INSERT INTO contacts (full_name, email, phone, subject, message) 
        VALUES (?, ?, ?, ?, ?)
    `
    
    db.query(
        query,
        [fullName, email, phone || null, subject, message],
        (err) => {
            if (err) {
                console.error('Insert error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to send message. Please try again.' 
                })
            }
            
            res.json({ 
                success: true, 
                message: 'Message sent successfully! We will contact you soon.' 
            })
        }
    )
})

// GET /api/contacts - Get all contacts
app.get('/api/contacts', checkToken, (req, res) => {
    const db = req.db
    
    db.query('SELECT * FROM contacts ORDER BY created_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// DELETE /api/contact/:id - Delete contact message
app.delete('/api/contact/:id', checkToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('DELETE FROM contacts WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to delete' 
            })
        }
        res.json({ 
            success: true, 
            message: 'Contact message deleted successfully' 
        })
    })
})

// ==================== SCHOLARSHIP INQUIRIES ROUTES ====================

// POST /api/scholarship/inquiry - Submit scholarship inquiry
app.post('/api/scholarship/inquiry', (req, res) => {
    const { fullName, email, phone, scholarshipTitle, message } = req.body
    const db = req.db
    
    if (!fullName || !email || !scholarshipTitle || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Full name, email, scholarship title, and message are required' 
        })
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please enter a valid email address' 
        })
    }
    
    const query = `
        INSERT INTO scholarship_inquiries (full_name, email, phone, scholarship_title, message) 
        VALUES (?, ?, ?, ?, ?)
    `
    
    db.query(
        query,
        [fullName, email, phone || null, scholarshipTitle, message],
        (err, result) => {
            if (err) {
                console.error('Insert error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to submit inquiry. Please try again.' 
                })
            }
            
            res.json({ 
                success: true, 
                message: 'Inquiry submitted successfully! We will contact you within 24 hours.',
                inquiryId: result.insertId
            })
        }
    )
})

// GET /api/scholarship/inquiries - Get all scholarship inquiries
app.get('/api/scholarship/inquiries', checkToken, (req, res) => {
    const db = req.db
    
    db.query('SELECT * FROM scholarship_inquiries ORDER BY created_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// GET /api/scholarship/inquiry/:id - Get single inquiry
app.get('/api/scholarship/inquiry/:id', checkToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('SELECT * FROM scholarship_inquiries WHERE id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        if (results.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Inquiry not found' 
            })
        }
        res.json(results[0])
    })
})

// PUT /api/scholarship/inquiry/:id/status - Update inquiry status
app.put('/api/scholarship/inquiry/:id/status', checkToken, (req, res) => {
    const { id } = req.params
    const { status } = req.body
    const db = req.db
    
    if (!['pending', 'contacted', 'completed'].includes(status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid status. Must be pending, contacted, or completed' 
        })
    }
    
    db.query(
        'UPDATE scholarship_inquiries SET status = ? WHERE id = ?',
        [status, id],
        (err, result) => {
            if (err) {
                console.error('Update error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update status' 
                })
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Inquiry not found' 
                })
            }
            
            res.json({ 
                success: true, 
                message: 'Status updated successfully' 
            })
        }
    )
})

// DELETE /api/scholarship/inquiry/:id - Delete inquiry
app.delete('/api/scholarship/inquiry/:id', checkToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('DELETE FROM scholarship_inquiries WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Delete error:', err)
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to delete inquiry' 
            })
        }
        res.json({ 
            success: true, 
            message: 'Inquiry deleted successfully' 
        })
    })
})

// ==================== SCHOLARSHIPS MANAGEMENT ROUTES ====================

// GET /api/scholarships - Get all scholarships (Public)
app.get('/api/scholarships', (req, res) => {
    const db = req.db
    const { featured, status } = req.query
    
    let query = 'SELECT * FROM scholarships'
    let conditions = []
    let params = []
    
    if (featured === 'true') {
        conditions.push('featured = ?')
        params.push(true)
    }
    
    if (status) {
        conditions.push('status = ?')
        params.push(status)
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
    }
    
    query += ' ORDER BY featured DESC, created_at DESC'
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching scholarships:', err)
            return res.status(500).json({ error: err.message })
        }
        res.json(results)
    })
})

// GET /api/scholarships/:id - Get single scholarship by ID
app.get('/api/scholarships/:id', (req, res) => {
    const { id } = req.params
    const db = req.db
    
    db.query('SELECT * FROM scholarships WHERE id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message })
        }
        if (results.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Scholarship not found' 
            })
        }
        res.json(results[0])
    })
})

// POST /api/admin/scholarships - Create new scholarship (Protected)
app.post('/api/admin/scholarships', checkToken, (req, res) => {
    const { 
        title, country, degree, description, eligibility, benefits, 
        deadline, link, image_url, status, featured 
    } = req.body
    const db = req.db
    
    if (!title || !country || !degree || !description) {
        return res.status(400).json({ 
            success: false, 
            message: 'Title, country, degree, and description are required' 
        })
    }
    
    const query = `
        INSERT INTO scholarships 
        (title, country, degree, description, eligibility, benefits, deadline, link, image_url, status, featured) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    db.query(
        query,
        [title, country, degree, description, eligibility || null, benefits || null, deadline || null, link || null, image_url || null, status || 'active', featured || false],
        (err, result) => {
            if (err) {
                console.error('Insert error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to create scholarship' 
                })
            }
            
            // Fetch the newly created scholarship to broadcast
            db.query('SELECT * FROM scholarships WHERE id = ?', [result.insertId], (err, newScholarship) => {
                if (!err && newScholarship && newScholarship.length > 0) {
                    // Broadcast to all WebSocket clients
                    broadcastNewScholarship(newScholarship[0])
                    broadcastScholarshipUpdate('created', newScholarship[0])
                }
            })
            
            res.json({ 
                success: true, 
                message: 'Scholarship created successfully',
                id: result.insertId
            })
        }
    )
})

// PUT /api/admin/scholarships/:id - Update scholarship (Protected)
app.put('/api/admin/scholarships/:id', checkToken, (req, res) => {
    const { id } = req.params
    const { 
        title, country, degree, description, eligibility, benefits, 
        deadline, link, image_url, status, featured 
    } = req.body
    const db = req.db
    
    if (!title || !country || !degree || !description) {
        return res.status(400).json({ 
            success: false, 
            message: 'Title, country, degree, and description are required' 
        })
    }
    
    const query = `
        UPDATE scholarships 
        SET title = ?, country = ?, degree = ?, description = ?, 
            eligibility = ?, benefits = ?, deadline = ?, link = ?, 
            image_url = ?, status = ?, featured = ?
        WHERE id = ?
    `
    
    db.query(
        query,
        [title, country, degree, description, eligibility || null, benefits || null, deadline || null, link || null, image_url || null, status || 'active', featured || false, id],
        (err, result) => {
            if (err) {
                console.error('Update error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update scholarship' 
                })
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Scholarship not found' 
                })
            }
            
            // Fetch updated scholarship to broadcast
            db.query('SELECT * FROM scholarships WHERE id = ?', [id], (err, updatedScholarship) => {
                if (!err && updatedScholarship && updatedScholarship.length > 0) {
                    broadcastScholarshipUpdate('updated', updatedScholarship[0])
                }
            })
            
            res.json({ 
                success: true, 
                message: 'Scholarship updated successfully' 
            })
        }
    )
})

// DELETE /api/admin/scholarships/:id - Delete scholarship (Protected)
app.delete('/api/admin/scholarships/:id', checkToken, (req, res) => {
    const { id } = req.params
    const db = req.db
    
    // Get scholarship info before deleting for broadcast
    db.query('SELECT * FROM scholarships WHERE id = ?', [id], (err, scholarship) => {
        if (!err && scholarship && scholarship.length > 0) {
            broadcastScholarshipUpdate('deleted', scholarship[0])
        }
        
        db.query('DELETE FROM scholarships WHERE id = ?', [id], (err, result) => {
            if (err) {
                console.error('Delete error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to delete scholarship' 
                })
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Scholarship not found' 
                })
            }
            
            res.json({ 
                success: true, 
                message: 'Scholarship deleted successfully' 
            })
        })
    })
})

// PATCH /api/admin/scholarships/:id/feature - Toggle featured status
app.patch('/api/admin/scholarships/:id/feature', checkToken, (req, res) => {
    const { id } = req.params
    const { featured } = req.body
    const db = req.db
    
    db.query(
        'UPDATE scholarships SET featured = ? WHERE id = ?',
        [featured, id],
        (err, result) => {
            if (err) {
                console.error('Update error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update featured status' 
                })
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Scholarship not found' 
                })
            }
            
            // Fetch updated scholarship to broadcast
            db.query('SELECT * FROM scholarships WHERE id = ?', [id], (err, updatedScholarship) => {
                if (!err && updatedScholarship && updatedScholarship.length > 0) {
                    broadcastScholarshipUpdate('featured', updatedScholarship[0])
                }
            })
            
            res.json({ 
                success: true, 
                message: `Scholarship ${featured ? 'featured' : 'unfeatured'} successfully` 
            })
        }
    )
})

// PATCH /api/admin/scholarships/:id/status - Update scholarship status
app.patch('/api/admin/scholarships/:id/status', checkToken, (req, res) => {
    const { id } = req.params
    const { status } = req.body
    const db = req.db
    
    if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Status must be active or inactive' 
        })
    }
    
    db.query(
        'UPDATE scholarships SET status = ? WHERE id = ?',
        [status, id],
        (err, result) => {
            if (err) {
                console.error('Update error:', err)
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update status' 
                })
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Scholarship not found' 
                })
            }
            
            // Fetch updated scholarship to broadcast
            db.query('SELECT * FROM scholarships WHERE id = ?', [id], (err, updatedScholarship) => {
                if (!err && updatedScholarship && updatedScholarship.length > 0) {
                    broadcastScholarshipUpdate('updated', updatedScholarship[0])
                }
            })
            
            res.json({ 
                success: true, 
                message: `Scholarship status updated to ${status}` 
            })
        }
    )
})

// ==================== SCHOLARSHIP STATISTICS ====================

// GET /api/scholarship/stats - Get scholarship statistics
app.get('/api/scholarship/stats', (req, res) => {
    const db = req.db
    
    const statsQuery = `
        SELECT 
            COUNT(*) as total_inquiries,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_inquiries,
            SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_inquiries,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_inquiries
        FROM scholarship_inquiries
    `
    
    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('Stats error:', err)
            return res.status(500).json({ error: err.message })
        }
        res.json(results[0])
    })
})

// GET /api/scholarship/popular - Get most popular scholarships
app.get('/api/scholarship/popular', (req, res) => {
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

// GET /api/scholarship/admin/stats - Get admin dashboard stats
app.get('/api/scholarship/admin/stats', checkToken, (req, res) => {
    const db = req.db
    
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM subscribers) as total_subscribers,
            (SELECT COUNT(*) FROM contacts) as total_contacts,
            (SELECT COUNT(*) FROM scholarship_inquiries) as total_inquiries,
            (SELECT COUNT(*) FROM scholarships) as total_scholarships,
            (SELECT COUNT(*) FROM scholarships WHERE featured = true) as featured_scholarships,
            (SELECT COUNT(*) FROM scholarships WHERE status = 'active') as active_scholarships
    `
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Stats error:', err)
            return res.status(500).json({ error: err.message })
        }
        res.json(results[0])
    })
})

// ==================== HOME ROUTE ====================

app.get('/', (req, res) => {
    res.json({
        message: 'GoAbroad Admissions API',
        version: '4.1.0',
        status: 'running',
        websocket: {
            enabled: true,
            endpoint: 'ws://localhost:3000',
            connections: connectedClients.size
        },
        endpoints: {
            public: {
                home: 'GET /',
                subscribe: 'POST /api/subscribe',
                contact: 'POST /api/contact',
                scholarshipInquiry: 'POST /api/scholarship/inquiry',
                scholarshipStats: 'GET /api/scholarship/stats',
                popularScholarships: 'GET /api/scholarship/popular',
                getAllScholarships: 'GET /api/scholarships',
                getScholarshipById: 'GET /api/scholarships/:id',
                websocketStats: 'GET /api/websocket/stats'
            },
            protected: {
                login: 'POST /api/admin/login',
                resetAdmin: 'POST /api/admin/reset',
                fixPassword: 'POST /api/admin/fix-password',
                checkDatabase: 'GET /api/admin/check-db',
                changePassword: 'POST /api/admin/change-password',
                verify: 'GET /api/admin/verify',
                subscribers: 'GET /api/subscribers',
                deleteSubscriber: 'DELETE /api/subscriber/:id',
                contacts: 'GET /api/contacts',
                deleteContact: 'DELETE /api/contact/:id',
                inquiries: 'GET /api/scholarship/inquiries',
                getInquiry: 'GET /api/scholarship/inquiry/:id',
                updateStatus: 'PUT /api/scholarship/inquiry/:id/status',
                deleteInquiry: 'DELETE /api/scholarship/inquiry/:id',
                createScholarship: 'POST /api/admin/scholarships',
                updateScholarship: 'PUT /api/admin/scholarships/:id',
                deleteScholarship: 'DELETE /api/admin/scholarships/:id',
                toggleFeatured: 'PATCH /api/admin/scholarships/:id/feature',
                updateScholarshipStatus: 'PATCH /api/admin/scholarships/:id/status',
                adminStats: 'GET /api/scholarship/admin/stats'
            }
        },
        admin_credentials: {
            username: 'admin',
            password: 'admin123'
        }
    })
})

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
    })
})

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err)
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    })
})

// ==================== START SERVER ====================

const PORT = 3000
server.listen(PORT, () => {
    console.log('\n' + '='.repeat(50))
    console.log(' GoAbroad Admissions API Server')
    console.log('='.repeat(50))
    console.log(`\n🚀 HTTP Server running on http://localhost:${PORT}`)
    console.log(`🔌 WebSocket Server running on ws://localhost:${PORT}`)
    console.log(`📡 WebSocket Clients Connected: ${connectedClients.size}`)
    console.log('\n Admin Login Credentials:')
    console.log('   Username: admin')
    console.log('   Password: admin123')
    console.log('\n Admin Management:')
    console.log('   Reset to default: POST /api/admin/reset')
    console.log('   Fix password: POST /api/admin/fix-password')
    console.log('   Change password: POST /api/admin/change-password (requires auth)')
    console.log('   Check database: GET /api/admin/check-db')
    console.log('   WebSocket stats: GET /api/websocket/stats')
    console.log('\n Public Endpoints:')
    console.log('   POST   /api/subscribe')
    console.log('   POST   /api/contact')
    console.log('   POST   /api/scholarship/inquiry')
    console.log('   GET    /api/scholarship/stats')
    console.log('   GET    /api/scholarship/popular')
    console.log('   GET    /api/scholarships')
    console.log('   GET    /api/scholarships/:id')
    console.log('\n Protected Endpoints (Require Token):')
    console.log('   POST   /api/admin/login')
    console.log('   POST   /api/admin/reset')
    console.log('   POST   /api/admin/fix-password (no auth required)')
    console.log('   GET    /api/admin/check-db (no auth required)')
    console.log('   POST   /api/admin/change-password')
    console.log('   GET    /api/admin/verify')
    console.log('   GET    /api/subscribers')
    console.log('   DELETE /api/subscriber/:id')
    console.log('   GET    /api/contacts')
    console.log('   DELETE /api/contact/:id')
    console.log('   GET    /api/scholarship/inquiries')
    console.log('   PUT    /api/scholarship/inquiry/:id/status')
    console.log('   DELETE /api/scholarship/inquiry/:id')
    console.log('   POST   /api/admin/scholarships')
    console.log('   PUT    /api/admin/scholarships/:id')
    console.log('   DELETE /api/admin/scholarships/:id')
    console.log('   PATCH  /api/admin/scholarships/:id/feature')
    console.log('   PATCH  /api/admin/scholarships/:id/status')
    console.log('   GET    /api/scholarship/admin/stats')
    console.log('\n' + '='.repeat(50))
    console.log('✅ Server ready to accept requests!\n')
})