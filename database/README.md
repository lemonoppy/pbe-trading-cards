# ISFL Dotts Database Schema

This directory contains the database schema for the ISFL Dotts trading cards system.

## Schema Files

### 01_cards_table.sql
The main cards table with football-specific positions and attributes.

**Key Features:**
- Football positions: QB, RB, WR, TE, OL, DE, DT, LB, CB, S, K
- Universal attributes: speed, strength, agility, intelligence, endurance
- Position-specific attributes: arm, throwingAccuracy, hands, passBlocking, runBlocking, tackling, kickPower, kickAccuracy
- Support for 3 leagues: ISFL (0), DSFL (1), WFC (2)

### 02_supporting_tables.sql
Supporting tables for the trading card system:
- `collection` / `ownedCards` - User-owned cards
- `packs_owned` - User pack inventory
- `packToday` - Daily pack purchase limits
- `trades` - Trade records
- `trade_assets` - Cards in trades
- `binders` - User card collections
- `binder_cards` - Cards in binders
- `user_info` - User information

### 03_team_data.sql
Team data for all three leagues with team information and colors.

**Teams Included:**
- **ISFL (14 teams)**: NSFC (7) + ASFC (7)
- **DSFL (8 teams)**: North (6) + South (2)
- **WFC (8 regions)**: International regions

## Installation

### Fresh Install

Run the schema files in order:

```bash
psql -h localhost -U postgres -d pbe_cards -f database/schema/01_cards_table.sql
psql -h localhost -U postgres -d pbe_cards -f database/schema/02_supporting_tables.sql
psql -h localhost -U postgres -d pbe_cards -f database/schema/03_team_data.sql
psql -h localhost -U postgres -d pbe_cards -f database/schema/04_trade_procedures.sql
```

Or use the migration runner:

```bash
npx tsx migrations/run-migration.ts ../database/schema/01_cards_table.sql
npx tsx migrations/run-migration.ts ../database/schema/02_supporting_tables.sql
npx tsx migrations/run-migration.ts ../database/schema/03_team_data.sql
npx tsx migrations/run-migration.ts ../database/schema/04_trade_procedures.sql
```

### Using pgAdmin or psql

1. Create a new database named `pbe_cards`
2. Run each `.sql` file in numerical order
3. Verify tables were created successfully

## Position-Attribute Matrix

| Position | Universal Stats | Position-Specific Stats |
|----------|----------------|------------------------|
| QB | All 5 universal | arm, throwingAccuracy |
| RB | All 5 universal | hands |
| WR | All 5 universal | hands |
| TE | All 5 universal | hands, passBlocking, runBlocking |
| OL | All 5 universal | passBlocking, runBlocking |
| DE/DT/LB/CB/S | All 5 universal | tackling |
| K | All 5 universal | kickPower, kickAccuracy |

**Universal Stats:** speed, strength, agility, intelligence, endurance

## League IDs

- `0` = ISFL (International Simulation Football League)
- `1` = DSFL (Developmental Simulation Football League)
- `2` = WFC (World Football Championship)

## Team Colors

The team colors in `03_team_data.sql` are placeholders. Update with actual team colors from the ISFL Portal or team branding guidelines.

Colors are stored as JSON:
```json
{
  "primary": "#HEX_COLOR",
  "secondary": "#HEX_COLOR",
  "text": "#HEX_COLOR"
}
```

## Notes

- This project uses PostgreSQL (not MySQL)
- Foreign keys are set up with `ON DELETE CASCADE` where appropriate
- Indexes are created on frequently queried columns for performance
- The `cards` table uses nullable columns for position-specific attributes
- Custom ENUM types are used for status fields (e.g., trade_status_enum)

## Environment Variables

Remember to set up your environment variables for database connection:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your_password>
POSTGRES_DATABASE=pbe_cards
```
