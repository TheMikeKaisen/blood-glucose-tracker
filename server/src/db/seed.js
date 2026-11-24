const { query, pool } = require('../config/db');
const { hashPassword } = require('../utils/security');

/**
 * Sweety Database Seeder
 * Populates realistic clinical demo account (Priya Sharma, demo@sweety.dev)
 */
async function seedDatabase() {
  console.log('Seeding Sweety database...');

  // 1. Create or ensure Demo User
  const demoEmail = 'demo@sweety.dev';
  const demoName = 'Priya Sharma';
  const demoPassword = 'Demo1234!';

  const existingUserRes = await query(
    'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1);',
    [demoEmail]
  );

  let userId;
  if (existingUserRes.rows.length > 0) {
    userId = existingUserRes.rows[0].id;
    console.log(`Demo user already exists (id: ${userId}, email: ${demoEmail}).`);
  } else {
    const passwordHash = await hashPassword(demoPassword);
    const insertUserRes = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email;`,
      [demoName, demoEmail, passwordHash]
    );
    userId = insertUserRes.rows[0].id;
    console.log(`Demo user created (id: ${userId}, email: ${demoEmail}, password: ${demoPassword}).`);
  }

  // 2. Check if readings table exists
  const tableCheckRes = await query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_name = 'readings';`
  );

  if (tableCheckRes.rows.length > 0) {
    console.log('Readings table detected. Seeding 30-day clinical glucose story...');
    // Clear previous seed readings for this demo user
    await query('DELETE FROM readings WHERE user_id = $1;', [userId]);

    // Generate 30 days of data ending today
    const now = new Date();
    const readingsToInsert = [];

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const d = new Date(now);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toISOString().split('T')[0];

      // Phase 1: Days 29..15 (Uncontrolled hyperglycemia)
      // Phase 2: Days 14..0 (Post-consultation glycemic stabilization)
      const isEarly = dayOffset >= 15;

      const fastingVal = isEarly ? Math.floor(155 + Math.random() * 45) : Math.floor(88 + Math.random() * 20);
      const breakfastVal = isEarly ? Math.floor(210 + Math.random() * 55) : Math.floor(130 + Math.random() * 25);
      const lunchVal = isEarly ? Math.floor(190 + Math.random() * 50) : Math.floor(125 + Math.random() * 25);
      const dinnerVal = isEarly ? Math.floor(205 + Math.random() * 45) : Math.floor(135 + Math.random() * 25);

      readingsToInsert.push({ date: dateStr, slot: 'morning_fasting', value: fastingVal });
      readingsToInsert.push({ date: dateStr, slot: 'after_breakfast', value: breakfastVal });
      readingsToInsert.push({ date: dateStr, slot: 'after_lunch', value: lunchVal });
      readingsToInsert.push({ date: dateStr, slot: 'after_dinner', value: dinnerVal });
    }

    for (const r of readingsToInsert) {
      await query(
        `INSERT INTO readings (user_id, date, slot, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, date, slot) DO UPDATE SET value = EXCLUDED.value;`,
        [userId, r.date, r.slot, r.value]
      );
    }
    console.log(`Seeded ${readingsToInsert.length} clinical readings for demo user.`);
  } else {
    console.log('Readings table not yet migrated (Phase 1). Demo user is seeded and ready for Phase 2.');
  }

  console.log('Database seeding completed successfully.');
  return { userId, email: demoEmail };
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Database seeding failed:', err);
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
      process.exit(1);
    });
}

module.exports = { seedDatabase };
