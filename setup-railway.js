const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'switchyard.proxy.rlwy.net',
    port: 52431,
    user: 'root',
    password: 'diEthSwsdHDWFdtwTPBGzgsDnxcLeSyT',
    database: 'railway'
});

connection.connect((err) => {
    if (err) {
        console.error('❌ Connection error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to Railway MySQL\n');

    // Create tables one by one
    const createAdmins = `
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createSubscribers = `
        CREATE TABLE IF NOT EXISTS subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createContacts = `
        CREATE TABLE IF NOT EXISTS contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createInquiries = `
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
    `;

    const createScholarships = `
        CREATE TABLE IF NOT EXISTS scholarships (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            country VARCHAR(255) NOT NULL,
            degree VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            full_details TEXT,
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
    `;

    // Run queries sequentially
    connection.query(createAdmins, (err) => {
        if (err) console.error('❌ Error creating admins:', err.message);
        else console.log('✅ Table: admins');
        
        connection.query(createSubscribers, (err) => {
            if (err) console.error('❌ Error creating subscribers:', err.message);
            else console.log('✅ Table: subscribers');
            
            connection.query(createContacts, (err) => {
                if (err) console.error('❌ Error creating contacts:', err.message);
                else console.log('✅ Table: contacts');
                
                connection.query(createInquiries, (err) => {
                    if (err) console.error('❌ Error creating scholarship_inquiries:', err.message);
                    else console.log('✅ Table: scholarship_inquiries');
                    
                    connection.query(createScholarships, (err) => {
                        if (err) console.error('❌ Error creating scholarships:', err.message);
                        else console.log('✅ Table: scholarships');
                        
                        // Insert admin user
                        const hashedPassword = '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr7vZqRK4YqV9sKvqZqRK4YqV9sK';
                        connection.query(
                            `INSERT IGNORE INTO admins (username, password, email) VALUES (?, ?, ?)`,
                            ['admin', hashedPassword, 'admin@goabroad.com'],
                            (err, result) => {
                                if (err) {
                                    console.error('❌ Error inserting admin:', err.message);
                                } else {
                                    if (result.affectedRows > 0) {
                                        console.log('\n✅ Admin user created!');
                                    } else {
                                        console.log('\n✅ Admin user already exists');
                                    }
                                    console.log('   Username: admin');
                                    console.log('   Password: XMA!!');
                                }
                                
                                // Show all tables
                                connection.query('SHOW TABLES', (err, tables) => {
                                    if (!err && tables && tables.length > 0) {
                                        console.log('\n📋 Tables in database:');
                                        tables.forEach(t => {
                                            console.log(`   - ${Object.values(t)[0]}`);
                                        });
                                    }
                                    console.log('\n✅ Database setup complete!');
                                    connection.end();
                                });
                            }
                        );
                    });
                });
            });
        });
    });
});