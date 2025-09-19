const axios = require('axios');

const BASE_URL = 'http://localhost:3003/api/admin';

async function testGameSelection() {
  try {
    console.log('🏈 Testing Game Selection System...\n');

    const year = 2025;
    const week = 4;

    // 1. Get top 20 games for selection
    console.log(`1. Getting top 20 games for ${year} Week ${week}...`);
    const topGamesResponse = await axios.get(`${BASE_URL}/top-games/${year}/${week}`);

    console.log(`✅ Found ${topGamesResponse.data.games.length} top games`);
    console.log(`Selected: ${topGamesResponse.data.selectedCount}, Available: ${topGamesResponse.data.totalAvailable}`);

    // Show top 5 games with their selection scores
    console.log('\nTop 5 games:');
    topGamesResponse.data.games.slice(0, 5).forEach((game, index) => {
      console.log(`${index + 1}. ${game.away_team} @ ${game.home_team} (Score: ${game.selection_score}, Selected: ${game.isSelected})`);
    });

    // 2. Select specific games (first 6 games from the list)
    const gamesToSelect = topGamesResponse.data.games.slice(0, 6).map(game => game.id.toString());

    console.log(`\n2. Selecting ${gamesToSelect.length} games...`);
    const selectResponse = await axios.post(`${BASE_URL}/select-games`, {
      year,
      week,
      gameIds: gamesToSelect
    });

    console.log(`✅ Selected ${selectResponse.data.gamesSelected} games for Week ${week}`);

    // 3. Get currently selected games
    console.log(`\n3. Getting currently selected games for Week ${week}...`);
    const selectedResponse = await axios.get(`${BASE_URL}/selected-games/${year}/${week}`);

    console.log(`✅ Currently selected: ${selectedResponse.data.count} games`);
    selectedResponse.data.games.forEach((game, index) => {
      console.log(`${index + 1}. ${game.away_team} @ ${game.home_team} (${game.status})`);
    });

    // 4. Test scraping with selected games
    console.log(`\n4. Testing scrape with selected games...`);
    const scrapeResponse = await axios.post(`${BASE_URL}/scrape-games`, {
      year,
      week
    });

    console.log(`✅ Scrape completed: ${scrapeResponse.data.gamesStored} games stored`);

    console.log('\n🎉 Game selection system test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing game selection:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testGameSelection();