# Database Schema Changelog

## 2026-01-13 - Major Schema Update

### Cards Table (`pbe_cards`)
**Removed stat columns** (never existed in production):
- ❌ overall, skating, shooting, hands, checking, defense
- ❌ high_shots, low_shots, quickness, control, conditioning

**Added columns**:
- ✅ `legacy_card_id` VARCHAR(24) - MongoDB ObjectID from legacy system
- ✅ `sub_type` VARCHAR(50) - Card type descriptor

**Updated columns**:
- ✅ `card_rarity` - Now stores pack tiers (Common, Uncommon, Rare, Mythic) instead of detailed rarities
- ✅ `position` VARCHAR(25) - Increased from VARCHAR(5) to fit full position names

### Owned Cards (`pbe_owned_cards`)
**Changed from TABLE to VIEW**:
- ✅ Now a materialized aggregation from `pbe_collection`
- ✅ Automatically calculates `quantity` by counting rows per user/card
- ✅ Always in sync with `pbe_collection` - no manual updates needed

### Rarity System
**Old System** (legacy):
- card_rarity: Bronze, Silver, Gold, Ruby, Diamond, Awards, Hall of Fame, etc.
- sub_type: Special categories (first_rounders, draft_cards) or Awards sub-types

**New System** (current):
- **card_rarity**: Pack tiers (Common, Uncommon, Rare, Mythic)
  - Determines pack pull rates
  - Common: 49% of cards, Uncommon: 13%, Rare: 34%, Mythic: 4%
- **sub_type**: Card descriptors (Base, Award, Captain, Hall of Fame, etc.)
  - Describes card type/category
  - All Common cards have sub_type='Base'
  - Other tiers keep descriptive names

### Migration Files
- `migrations/add_legacy_id_column.sql` - Added legacy_card_id column
- `migrations/restructure-rarities.ts` - Converted old rarities to new system
- `migrations/create-owned-cards-view.sql` - Created pbe_owned_cards view

### Pack Types
- **Base Pack**: $50k, 65% Common / 25% Uncommon / 8% Rare / 2% Mythic
- **Ultimus Pack** (formerly Ruby): $150k, 35% Common / 35% Uncommon / 20% Rare / 10% Mythic

### Data Migration Stats
- Total cards: 5,833 legacy cards imported
- Duplicates removed: 10
- Player match rate: 97.4% (fuzzy matched to Portal API)
- User match rate: 100%
