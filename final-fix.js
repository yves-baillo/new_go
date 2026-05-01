const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'goabroad_db'
});

async function fixAll() {
    const password = 'XMA!!';
    const hash = bcrypt.hashSync(password, 10);
    
    console.log('='.repeat(50));
    console.log('🔧 FIXING ADMIN PASSWORDS');
    console.log('='.repeat(50));
    console.log('New hash generated:', hash.substring(0, 30) + '...');
    console.log('');
    
    // Clear all admins
    db.query('DELETE FROM admins', (err) => {
        if (err) {
            console.error('Delete error:', err);
            return;
        }
        
        // Insert new admins
        const admins = [
            ['admin', hash, 'admin@goabroad.com'],
            ['xmaopp', hash, 'xma@goabroad.com'],
            ['jack', hash, 'jack@goabroad.com']
        ];
        
        let inserted = 0;
        admins.forEach(([username, pass, email]) => {
            db.query('INSERT INTO admins (username, password, email) VALUES (?, ?, ?)',
                [username, pass, email],
                (err) => {
                    if (err) {
                        console.error(`❌ Failed to insert ${username}:`, err.message);
                    } else {
                        console.log(`✅ Inserted ${username}`);
                        inserted++;
                    }
                    
                    if (inserted === admins.length) {
                        console.log('\n' + '='.repeat(50));
                        console.log('✅ ALL ADMINS FIXED!');
                        console.log('='.repeat(50));
                        console.log('\n📋 CREDENTIALS:');
                        admins.forEach(([username]) => {
                            console.log(`   Username: ${username} → Password: ${password}`);
                        });
                        console.log('\n' + '='.repeat(50));
                        
                        // Test login
                        setTimeout(() => {
                            testLogin();
                        }, 1000);
                        
                        db.end();
                    }
                }
            );
        });
    });
}

async function testLogin() {
    console.log('\n🧪 TESTING LOGIN...');
    console.log('-'.repeat(30));
    
    try {
        const response = await axios.post('http://localhost:3000/api/admin/login', {
            username: 'admin',
            password: 'XMA!!'
        });
        
        if (response.data.success) {
            console.log('✅ LOGIN SUCCESSFUL!');
            console.log('   Token:', response.data.token.substring(0, 30) + '...');
            console.log('   Admin:', response.data.admin.username);
        } else {
            console.log('❌ Login failed:', response.data.message);
        }
    } catch (error) {
        console.log('❌ Login error:', error.response?.data?.message || error.message);
        console.log('\n💡 Make sure your server is running!');
        console.log('   Run: node server.js');
    }
}

fixAll();