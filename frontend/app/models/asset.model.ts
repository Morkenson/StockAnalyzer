export interface Asset {
  id: string;
  name: string;
  assetType: string;
  value: number;
  institution?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetRow {
  id: string;
  name: string;
  assetType: string;
  value: number;
  institution?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
