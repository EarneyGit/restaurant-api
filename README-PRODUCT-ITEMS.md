# Product Items Tab Implementation

This document explains the implementation of the "Items" tab functionality in the product model, which allows products to include other products as selectable items.

## Model Changes

The following changes were made to the `product.model.js` file:

1. Added `itemSettingsSchema` to define the settings structure:
   ```javascript
   const itemSettingsSchema = new mongoose.Schema({
     showSelectedOnly: {
       type: Boolean,
       default: false
     },
     showSelectedCategories: {
       type: Boolean,
       default: false
     },
     limitSingleChoice: {
       type: Boolean,
       default: false
     },
     addAttributeCharges: {
       type: Boolean,
       default: false
     },
     useProductPrices: {
       type: Boolean,
       default: false
     },
     showChoiceAsDropdown: {
       type: Boolean,
       default: false
     }
   }, { _id: false });
   ```

2. Added new fields to the `productSchema`:
   ```javascript
   selectedItems: [{
     type: mongoose.Schema.Types.ObjectId,
     ref: 'Product'
   }],
   itemSettings: {
     type: itemSettingsSchema,
     default: () => ({})
   }
   ```

## Controller Changes

The product controller was updated to:

1. Populate the `selectedItems` field when fetching products:
   ```javascript
   .populate('selectedItems', 'name price category')
   ```

2. Parse JSON strings for `selectedItems` and `itemSettings` in create and update operations:
   ```javascript
   if (typeof req.body.selectedItems === 'string') {
     req.body.selectedItems = JSON.parse(req.body.selectedItems);
   }
   if (typeof req.body.itemSettings === 'string') {
     req.body.itemSettings = JSON.parse(req.body.itemSettings);
   }
   ```

3. Transform the response data to include the new fields.

## Usage in API

### Creating a Product with Item Selection

To create a product with selected items, send the following in your request:

```
POST /api/products
```

Include in the formdata:
- `selectedItems`: JSON array of product IDs that should be included in this product
  ```
  ["6123456789abcdef12345670", "6123456789abcdef12345671"]
  ```
- `itemSettings`: JSON object with settings for the items display
  ```
  {
    "showSelectedOnly": false,
    "showSelectedCategories": true,
    "limitSingleChoice": true,
    "addAttributeCharges": false,
    "useProductPrices": true,
    "showChoiceAsDropdown": true
  }
  ```

### Updating a Product's Selected Items

To update a product's selected items:

```
PUT /api/products/:id
```

Include the same fields as in the create operation, with updated values.

## Item Settings Explanation

1. `showSelectedOnly`: When true, only selected items are shown in the item selection view
2. `showSelectedCategories`: When true, only categories containing selected items are displayed
3. `limitSingleChoice`: Limits customer to selecting just one of the items
4. `addAttributeCharges`: Adds prices of selected attributes to the total price
5. `useProductPrices`: Uses the actual price of selected products instead of a fixed price
6. `showChoiceAsDropdown`: Displays the selection interface as a dropdown instead of a list

## Frontend Integration

The backend changes support the frontend functionality shown in:
- `menu-items-tab.tsx`: Component for selecting and managing items
- `edit-item-modal.tsx`: The top-level modal that contains the Items tab

These changes allow restaurant owners to create product groups or combo meals where customers can select from predefined product options. 