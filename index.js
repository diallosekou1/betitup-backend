require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS globally


// Odds API Key
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Odds Fetcher
app.get('/odds/:sport', async (req, res) => {
  const sport = req.params.sport;
  try {
    const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'moneyline,spreads,totals',
        dateFormat: 'iso'
      }
    });

    const filteredOdds = response.data.map(game => ({
      matchup: `${game.home_team} vs ${game.away_team}`,
      commence_time: game.commence_time,
      bookmakers: game.bookmakers.map(book => ({
        name: book.title,
        markets: book.markets.map(m => ({
          type: m.key,
          outcomes: m.outcomes
        }))
      }))
    }));

    res.json({ sport, games: filteredOdds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});

// Pick Generator
app.get('/generate-picks/:sport', async (req, res) => {
  const sport = req.params.sport;
  try {
    const oddsRes = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'moneyline,spreads',
        dateFormat: 'iso'
      }
    });

    const picks = oddsRes.data.map(game => {
      const home = game.home_team;
      const away = game.away_team;
      const mlMarket = game.bookmakers[0]?.markets.find(m => m.key === 'moneyline');
      const spreadMarket = game.bookmakers[0]?.markets.find(m => m.key === 'spreads');

      const homeML = mlMarket?.outcomes.find(o => o.name === home)?.price || 0;
      const awayML = mlMarket?.outcomes.find(o => o.name === away)?.price || 0;
      const spread = spreadMarket?.outcomes.find(o => o.name === home)?.point || 0;

      const pick = homeML < awayML ? `${home} ML` : `${away} ML`;
      const confidence = Math.abs(homeML - awayML) > 50 ? 'High' : 'Moderate';

      return {
        matchup: `${home} vs ${away}`,
        pick,
        spread,
        confidence
      };
    });

    res.json({ sport, picks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate picks' });
  }
});

// Parlay Composer
app.get('/compose-parlay', async (req, res) => {
  const tier = req.query.tier || 'moderate';

  const picks = [
    { leg: 'Broncos ML', odds: -150, confidence: 'High' },
    { leg: 'Raiders +3.5', odds: +110, confidence: 'Moderate' },
    { leg: 'Wilson Over 249.5 yards', odds: +125, confidence: 'High' },
    { leg: 'Adams Over 5.5 receptions', odds: +105, confidence: 'Moderate' },
    { leg: 'USC -21.5', odds: -110, confidence: 'High' }
  ];

  const filtered = picks.filter(p => {
    if (tier === 'safe') return p.odds < -110;
    if (tier === 'moderate') return p.odds >= -110 && p.odds <= +110;
    if (tier === 'high') return p.odds > +110;
    return true;
  });

  const legs = filtered.slice(0, 4);
  const payout = legs.reduce((acc, leg) => {
    const decimal = leg.odds > 0 ? (leg.odds / 100 + 1) : (100 / Math.abs(leg.odds) + 1);
    return acc * decimal;
  }, 1);

  res.json({
    tier,
    legs: legs.map(l => l.leg),
    estimated_payout: `+${Math.round((payout - 1) * 100)}`
  });
});
app.get('/', (req, res) => {
  res.send('Backend is live');
});
app.listen(PORT, () => {
  console.log(`BetItUp backend running on port ${PORT}`);
});
