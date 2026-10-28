import { Database } from './database.js';

const db = new Database('data/demo.json');
console.log('Previous user:', db.get('user'));
db.set('user', { name: 'etherlyvan', project: 'ether-db' });
console.log('Saved user:', db.get('user'));
db.set('temporary', true);
console.log('Deleted temporary:', db.delete('temporary'));
console.log('Keys:', db.keys());
console.log('Reloaded user:', new Database('data/demo.json').get('user'));
