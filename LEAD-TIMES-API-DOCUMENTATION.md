# Lead Times API Documentation

## Overview
The Lead Times API allows admin users to manage collection and delivery lead times for their branch. Lead times represent the preparation time needed for orders.

## Base URL
```
/api/settings/lead-times
```

## Authentication
All endpoints require authentication with admin, manager, or staff privileges. The API automatically uses the authenticated user's assigned branch.

## Endpoints

### 1. Get Lead Times
**GET** `/api/settings/lead-times`

Retrieves the current lead times for the authenticated user's branch.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Response
```json
{
  "success": true,
  "data": {
    "collection": "20 mins",
    "delivery": "45 mins"
  }
}
```

#### Error Responses
```json
// User not assigned to branch
{
  "success": false,
  "message": "admin must be assigned to a branch"
}

// Access denied
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}

// Branch not found
{
  "success": false,
  "message": "Branch not found"
}
```

### 2. Update Lead Times
**PUT** `/api/settings/lead-times`

Updates the lead times for the authenticated user's branch.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "collection": "25 mins",
  "delivery": "50 mins"
}
```

#### Response
```json
{
  "success": true,
  "message": "Lead times updated successfully",
  "data": {
    "collection": "25 mins",
    "delivery": "50 mins"
  }
}
```

#### Error Responses
```json
// Missing required fields
{
  "success": false,
  "message": "Both collection and delivery lead times are required"
}

// Invalid format
{
  "success": false,
  "message": "Lead times must be positive numbers"
}

// Staff access denied
{
  "success": false,
  "message": "Staff are not authorized to update lead times"
}
```

## Frontend Integration Examples

### React/Next.js Hook for Lead Times Management

```typescript
// hooks/useLeadTimes.ts
import { useState, useEffect } from 'react';

interface LeadTimes {
  collection: string;
  delivery: string;
}

interface UseLeadTimesReturn {
  leadTimes: LeadTimes | null;
  loading: boolean;
  error: string | null;
  updateLeadTimes: (data: LeadTimes) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useLeadTimes = (): UseLeadTimesReturn => {
  const [leadTimes, setLeadTimes] = useState<LeadTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeadTimes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/lead-times', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch lead times');
      }

      setLeadTimes(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateLeadTimes = async (newLeadTimes: LeadTimes) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings/lead-times', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLeadTimes),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update lead times');
      }

      setLeadTimes(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadTimes();
  }, []);

  return {
    leadTimes,
    loading,
    error,
    updateLeadTimes,
    refetch: fetchLeadTimes,
  };
};
```

### Lead Times Page Component

```typescript
// app/orders/lead-times/page.tsx
'use client';

import { useState } from 'react';
import { useLeadTimes } from '@/hooks/useLeadTimes';

const LeadTimesPage = () => {
  const { leadTimes, loading, error, updateLeadTimes } = useLeadTimes();
  const [formData, setFormData] = useState({
    collection: '',
    delivery: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when lead times are loaded
  useEffect(() => {
    if (leadTimes) {
      setFormData({
        collection: leadTimes.collection,
        delivery: leadTimes.delivery
      });
    }
  }, [leadTimes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      await updateLeadTimes(formData);
      // Show success message
      alert('Lead times updated successfully!');
    } catch (err) {
      // Show error message
      alert('Failed to update lead times. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: 'collection' | 'delivery', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading lead times...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">Change Lead Times</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Collection Lead Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collection
          </label>
          <select
            value={formData.collection}
            onChange={(e) => handleInputChange('collection', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select time</option>
            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(mins => (
              <option key={mins} value={`${mins} mins`}>
                {mins} mins
              </option>
            ))}
          </select>
        </div>

        {/* Delivery Lead Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery
          </label>
          <select
            value={formData.delivery}
            onChange={(e) => handleInputChange('delivery', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select time</option>
            {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90].map(mins => (
              <option key={mins} value={`${mins} mins`}>
                {mins} mins
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
};

export default LeadTimesPage;
```

### API Service (Alternative Approach)

```typescript
// services/leadTimesService.ts
interface LeadTimes {
  collection: string;
  delivery: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

class LeadTimesService {
  private baseUrl = '/api/settings/lead-times';

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getLeadTimes(): Promise<LeadTimes> {
    const response = await fetch(this.baseUrl, {
      headers: this.getAuthHeaders(),
    });

    const data: ApiResponse<LeadTimes> = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch lead times');
    }

    return data.data!;
  }

  async updateLeadTimes(leadTimes: LeadTimes): Promise<LeadTimes> {
    const response = await fetch(this.baseUrl, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(leadTimes),
    });

    const data: ApiResponse<LeadTimes> = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update lead times');
    }

    return data.data!;
  }
}

export const leadTimesService = new LeadTimesService();
```

## Testing Examples

### cURL Commands

```bash
# Get lead times
curl -X GET "http://localhost:5000/api/settings/lead-times" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Update lead times
curl -X PUT "http://localhost:5000/api/settings/lead-times" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "25 mins",
    "delivery": "50 mins"
  }'
```

### Postman Collection

```json
{
  "info": {
    "name": "Lead Times API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Lead Times",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/settings/lead-times",
          "host": ["{{baseUrl}}"],
          "path": ["api", "settings", "lead-times"]
        }
      }
    },
    {
      "name": "Update Lead Times",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"collection\": \"25 mins\",\n  \"delivery\": \"50 mins\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/settings/lead-times",
          "host": ["{{baseUrl}}"],
          "path": ["api", "settings", "lead-times"]
        }
      }
    }
  ]
}
```

## Notes

1. **Data Storage**: Lead times are stored in the `ordering-times` collection, applied to all days of the week for consistency.

2. **Format**: Lead times must be in the format "X mins" where X is a positive integer.

3. **Permissions**: 
   - Admin, Manager, Staff can view lead times
   - Only Admin and Manager can update lead times
   - Staff have read-only access

4. **Branch Association**: Lead times are automatically associated with the authenticated user's branch.

5. **Default Values**: If no lead times are set, defaults are 20 mins for collection and 45 mins for delivery.

6. **Validation**: The API validates that lead times are positive numbers and in the correct format. 