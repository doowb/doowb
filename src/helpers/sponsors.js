
const GitHub = require('github-base');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const github = new GitHub({ token: GITHUB_TOKEN });

const cache = new Map();

const gql = async query => {
  if (!cache.has(query)) {
    const response = await github.post('/graphql', { query });
    cache.set(query, response.body.data);
  }
  return cache.get(query);
};

const query = `
query {
  viewer {
    login
    sponsorshipsAsMaintainer(activeOnly: false, includePrivate: true, first: 100) {
      nodes {
        id
        sponsorEntity {
          __typename
          ... on Organization {
            id
            email
            login
            avatarUrl(size: 10)
            name
          }
          ... on User {
            id
            email
            avatarUrl(size: 10)
            login
            name
          }
        }
        isActive
        isOneTimePayment
        isSponsorOptedIntoEmail
        createdAt
        privacyLevel
        tierSelectedAt
        tier {
          id
          isCustomAmount
          isOneTime
          name
          monthlyPriceInCents
          monthlyPriceInDollars
          updatedAt
          description
          descriptionHTML
          createdAt
        }
      }
    }
  }
}
`;

const withinRange = (value, min, max) => value >= min && value <= max;

const tiers = {
  supporter: {
    isMatch: tier => tier.isOneTime !== true && withinRange(tier.monthlyPriceInCents, 100, 4999)
  },
  top_supporter: {
    isMatch: tier => tier.isOneTime !== true && withinRange(tier.monthlyPriceInCents, 5000, 14999)
  },
  shoutout: {
    isMatch: tier => tier.isOneTime === true && withinRange(tier.monthlyPriceInCents, 100, 2499)
  },
  shoutout_link: {
    isMatch: tier => tier.isOneTime === true && withinRange(tier.monthlyPriceInCents, 2500, 14999)
  },
  bronze: {
    isMatch: tier => withinRange(tier.monthlyPriceInCents, 15000, 24999)
  },
  silver: {
    isMatch: tier => withinRange(tier.monthlyPriceInCents, 25000, 74999)
  },
  gold: {
    isMatch: tier => withinRange(tier.monthlyPriceInCents, 75000, 149999)
  },
  platinum: {
    isMatch: tier => withinRange(tier.monthlyPriceInCents, 150000, 1200000)
  },
  other: {
    isMatch: tier => !Object.keys(tiers).filter(key => key !== 'other').some(key => tiers[key].isMatch(tier))
  }
};

const sponsors = async tier => {
  const response = await gql(query);
  const me = { ...response.viewer };
  const sponsorships = [...me.sponsorshipsAsMaintainer.nodes];
  return sponsorships.filter(sponsorship => sponsorship.isActive && tiers[tier].isMatch(sponsorship.tier));
};

const formatItem = item => {
  const { avatarUrl, login, name = login } = item.sponsorEntity;
  const parsed = new URL(avatarUrl);
  parsed.searchParams.set('s', '32');
  return `[![${name}](${parsed.toString()} "${name}")](https://github.com/${login})`;
};

const formatList = list => list.length ? list.map(formatItem).join('\n') : '';

module.exports = (tier, callback) => {
  sponsors(tier)
    .then(list => callback(null, formatList(list)))
    .catch(callback);
};

// (async () => {
//   for (const tier of Object.keys(tiers)) {
//     console.log(`Getting sponsors for tier "${tier}":`);
//     console.log();
//     // const result = await gql(query);
//     const result = await sponsors(tier);
//     console.log(JSON.stringify(result, null, 2));
//     console.log();
//   }
// })().catch(console.error);

