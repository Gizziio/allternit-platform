# Acceptance Tests for Marketplace Feature

This document outlines the click-by-click acceptance tests to verify the UI correctness of the marketplace feature implementation.

## 1. Registry Mode Functionality

### Test 1.1: Registry Mode Still Functions as Before
1. Navigate to the Registry view
2. Verify that the registry content is displayed correctly
3. Verify that all registry-specific functionality works as expected
4. Ensure no marketplace elements appear in registry mode

### Test 1.2: Two-Mode Toggle Works Correctly
1. In Registry mode, verify the toggle shows "Registered" as active
2. Click the "Marketplace" button
3. Verify the view switches to Marketplace mode
4. Click the "Registered" button
5. Verify the view switches back to Registry mode

## 2. Marketplace Mode Loading

### Test 2.1: Marketplace Mode Loads Correctly
1. Switch to Marketplace mode using the toggle
2. Verify the loading spinner appears initially
3. Verify the loading spinner disappears after data loads
4. Verify the marketplace content is displayed correctly
5. Verify the header shows "Marketplace" title and description

### Test 2.2: Initial Asset Display
1. Load the marketplace view
2. Verify assets are displayed in the grid
3. Verify each asset card shows the correct information (icon, name, version, rating, etc.)
4. Verify the stats show correct total and imported counts

## 3. Search and Filter Functionality

### Test 3.1: Search Updates Results
1. Enter text in the search input field
2. Verify the asset list updates to show only matching results
3. Clear the search field
4. Verify all assets are displayed again

### Test 3.2: Category Filters Work
1. Click on the "Capsules" category filter
2. Verify only capsule-type assets are displayed
3. Click on the "Agents" category filter
4. Verify only agent-type assets are displayed
5. Click on "All" filter
6. Verify all asset types are displayed again

### Test 3.3: Sort Options Work
1. Click the "Popular" sort option
2. Verify assets are sorted by download count (descending)
3. Click the "Top Rated" sort option
4. Verify assets are sorted by rating (descending)
5. Click the "Newest" sort option
6. Verify assets are sorted by creation/update date (newest first)

## 4. Asset Detail Panel

### Test 4.1: Clicking Result Opens Detail Panel
1. Click on an asset card in the grid
2. Verify the asset detail modal appears
3. Verify the modal shows detailed information about the selected asset
4. Click outside the modal or the close button
5. Verify the modal closes

### Test 4.2: Detail Panel Shows Correct Information
1. Open the detail panel for an asset
2. Verify the asset name, version, description, and metadata are displayed correctly
3. Verify the rating and download count match the card view
4. Verify all information comes from the asset data correctly

## 5. Import Functionality

### Test 5.1: Import Triggers API Call and Shows Success State
1. Find an unimported asset in the list
2. Click the "Import" button on the asset card
3. Verify the button changes to "✓ Imported" and becomes disabled
4. Verify the asset's status reflects as imported (different styling/badge)
5. Verify the imported count in the header stats increases by 1

### Test 5.2: Import from Detail Panel Works
1. Open the detail panel for an unimported asset
2. Click the "Import Asset" button in the modal
3. Verify the modal closes
4. Verify the asset card in the grid updates to show imported status
5. Verify the imported count in the header stats increases by 1

### Test 5.3: Re-import Prevention
1. Find an already imported asset
2. Verify the import button shows "✓ Already Imported" or is disabled
3. Attempt to click the import button
4. Verify nothing happens (asset remains imported)

## 6. Marketplace-Specific Constraints

### Test 6.1: No "Activate/Enable" Actions in Marketplace Mode
1. Navigate to Marketplace mode
2. Verify no "Activate" or "Enable" buttons appear anywhere in the UI
3. Verify all action buttons say "Import" rather than "Install", "Activate", or "Enable"
4. Verify the functionality is limited to importing assets to the registry (draft)

### Test 6.2: Import Semantics Verification
1. Verify all UI text refers to "Import" rather than "Install"
2. Verify status indicators show "Imported" rather than "Installed"
3. Verify the underlying API call uses import semantics
4. Verify imported assets are added to the registry as drafts

## 7. UI Quality Checks

### Test 7.1: Loading States
1. Verify loading spinner appears during data fetch
2. Verify appropriate loading message is displayed
3. Verify loading state gracefully transitions to content display

### Test 7.2: Empty States
1. Apply filters that result in no matches
2. Verify the "No assets found" empty state appears
3. Verify the empty state message is helpful and clear
4. Clear filters and verify assets reappear

### Test 7.3: Error Handling
1. Simulate a network error or API failure
2. Verify appropriate error message is displayed to the user (console error logged, empty state shown)
3. Verify the UI gracefully handles the error without crashing

### Test 7.4: Responsive Behavior
1. Resize the browser window
2. Verify the layout adapts appropriately
3. Verify all elements remain accessible and readable
4. Verify no content is cut off or overlaps incorrectly

## 8. Cross-Module Integration

### Test 8.1: Registry/Marketplace Toggle Persistence
1. Switch to Marketplace mode
2. Perform several actions (search, filter, import)
3. Switch to Registry mode
4. Switch back to Marketplace mode
5. Verify the view returns to an appropriate state (likely default view)

### Test 8.2: Data Consistency
1. Import an asset in Marketplace mode
2. Switch to Registry mode
3. Verify the imported asset appears in the registry
4. Switch back to Marketplace mode
5. Verify the asset still shows as imported