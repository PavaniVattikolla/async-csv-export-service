const pool = require('../src/db');

const BATCH_SIZE = 50000;

function generateRandomUser() {
  const names = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com'];
  const countries = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'CN'];
  const tiers = ['free', 'premium', 'enterprise'];

  const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
  const email = `${name}${Math.floor(Math.random() * 10000)}@${domains[Math.floor(Math.random() * domains.length)]}`;
  const country_code = countries[Math.floor(Math.random() * countries.length)];
  const subscription_tier = tiers[Math.floor(Math.random() * tiers.length)];
  const lifetime_value = (Math.random() * 1000).toFixed(2);

  return { name, email, country_code, subscription_tier, lifetime_value };
}

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding with 10 million records...');

    const totalRows = 10000000;
    let inserted = 0;

    while (inserted < totalRows) {
      const batchSize = Math.min(BATCH_SIZE, totalRows - inserted);
      const users = Array.from({ length: batchSize }, () => generateRandomUser());

      const values = users
        .map(
          (user, index) =>
            `('${user.name.replace(/'/g, "''")}', '${user.email.replace(/'/g, "''")}', '${user.country_code}', '${user.subscription_tier}', ${user.lifetime_value})`
        )
        .join(',');

      const query = `
        INSERT INTO users (name, email, country_code, subscription_tier, lifetime_value)
        VALUES ${values}
      `;

      try {
        await client.query(query);
        inserted += batchSize;
        const percentage = ((inserted / totalRows) * 100).toFixed(2);
        console.log(`Seeded ${inserted} records (${percentage}%)`);
      } catch (err) {
        console.error('Error inserting batch:', err);
        throw err;
      }
    }

    console.log('Database seeding completed successfully!');
  } finally {
    await client.end();
  }
}

seedDatabase().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
