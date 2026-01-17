# Campaign Header Save Button - Integration Guide

## Quick Integration

Add this code to your campaign screen header (in `app/campaign/[id].tsx`):

### 1. Import SaveGameModal

```typescript
import { SaveGameModal } from '../../components/campaign/SaveGameModal';
```

### 2. Add State

```typescript
const [showSaveModal, setShowSaveModal] = useState(false);
```

### 3. Add Save Icon to Header

Find your header section and add the save icon next to existing icons:

```tsx
{/* Save Button */}
<TouchableOpacity
    onPress={() => setShowSaveModal(true)}
    style={styles.headerIcon}
>
    <Ionicons name="save-outline" size={24} color={colors.text.primary} />
</TouchableOpacity>
```

### 4. Add SaveGameModal Component

At the end of your component, before the closing tag:

```tsx
<SaveGameModal
    visible={showSaveModal}
    campaign={campaign}
    messages={messages}
    campaignLedger={campaignLedger} // Build this using buildCampaignLedger()
    onClose={() => setShowSaveModal(false)}
    onSaved={() => {
        // Optional: refresh campaign data
        console.log('Campaign saved!');
    }}
/>
```

### 5. Build Campaign Ledger (if not already available)

```typescript
import { buildCampaignLedger } from '../../functions/src/utils/campaignLedger';

// In your component
const campaignLedger = useMemo(() => {
    if (!campaign || !campaign.moduleState) return undefined;
    return buildCampaignLedger(
        campaign.moduleState,
        campaign.worldModule
    );
}, [campaign]);
```

---

## Alternative: Menu Integration

If you prefer to add it to an existing menu instead of the header:

```tsx
<MenuItem
    icon="save-outline"
    title="Save & Export"
    onPress={() => setShowSaveModal(true)}
/>
```

---

## Styling

Add to your styles if needed:

```typescript
headerIcon: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
},
```

---

That's it! The save button will now open the enhanced SaveGameModal with all features:
- ⚡ Quick Save
- 📝 Save As New
- 📁 Export to File
- 🔗 Copy Share Code
