const bcrypt = require('bcryptjs');

const password = 'XMA!!';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('Hash length:', hash.length);