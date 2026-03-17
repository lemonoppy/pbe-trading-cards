-- Create settings table for daily pack subscriptions
CREATE TABLE IF NOT EXISTS pbe_settings (
  userID INTEGER PRIMARY KEY,
  subscription INTEGER DEFAULT 0 CHECK (subscription >= 0 AND subscription <= 3),
  rubySubscription INTEGER DEFAULT 0 CHECK (rubySubscription >= 0 AND rubySubscription <= 3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on userID for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_userid ON pbe_settings(userID);
