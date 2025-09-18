const axios = require('axios');

async function testScraping() {
  try {
    console.log('Testing scrape-games endpoint...');
    
    const response = await axios.post('http://localhost:3003/api/admin/scrape-games', {
      year: 2025,
      week: 4
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error testing scraping:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testScraping();