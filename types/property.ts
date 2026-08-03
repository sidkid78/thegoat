export type UserRole = 'buyer' | 'seller' | 'agent' | 'admin';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFeatures {
  hasPool?: boolean;
  garageSpaces?: number;
  heatingType?: string;
  coolingType?: string;
  yearBuilt?: number;
  hoaFeeMonthly?: number;
  [key: string]: unknown;
}

export interface Property {
  id: number;
  ownerId?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  description: string;
  features: PropertyFeatures;
  photos: string[];
  status: 'active' | 'pending' | 'sold' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface CmaReport {
  id: number;
  propertyId: number;
  userId: string;
  estimatedValuation: number;
  valuationRangeLow: number;
  valuationRangeHigh: number;
  comparablePropertyIds: number[];
  reportData: {
    summary: string;
    marketTrends: string;
    renovationImpacts?: Array<{ feature: string; estimatedValueAdd: number }>;
    confidenceScore: number;
  };
  createdAt: string;
}

export interface PropertyOffer {
  id: number;
  propertyId: number;
  buyerId: string;
  offerAmount: number;
  earnestMoney?: number;
  contingencies: string[];
  status: 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
  contractUrl?: string;
  createdAt: string;
  updatedAt: string;
}