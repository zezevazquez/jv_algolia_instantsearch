const algoliasearch = require('algoliasearch')
const records = require('./sample_data/data.json');


const client = algoliasearch('APP_ID', 'ADMIN_API_KEY');
const index = client.initIndex('ecommerce_data');

index.saveObjects(records, { autoGenerateObjectIDIfNotExist: true });