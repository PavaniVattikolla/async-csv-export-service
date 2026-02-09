import random
import string
import psycopg2

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_USER = "exporter"
DB_PASSWORD = "secret"
DB_NAME = "exports_db"

# Function to generate random user data
def generate_random_user():
    name = ''.join(random.choices(string.ascii_letters, k=10))
    email = f'{name}@example.com'
    country_code = random.choice(['US', 'CA', 'GB', 'AU'])
    subscription_tier = random.choice(['free', 'premium', 'enterprise'])
    lifetime_value = round(random.uniform(0, 1000), 2)
    return (name, email, country_code, subscription_tier, lifetime_value)

# Function to seed the database with 10 million users
def seed_database():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME
    )
    cursor = conn.cursor()
    for _ in range(10000000):
        user_data = generate_random_user()
        cursor.execute(
            "INSERT INTO users (name, email, country_code, subscription_tier, lifetime_value) VALUES (%s, %s, %s, %s, %s)",
            user_data
        )
    conn.commit()
    cursor.close()
    conn.close()

if __name__ == '__main__':
    seed_database()