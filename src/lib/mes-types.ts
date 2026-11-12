/** API response shapes of the batch MES, shared by services and pages. */
import type { Batch, Recipe } from "@/data/collections";
import type { BatchStatus } from "@/lib/mes-domain";

export interface BatchRow {
  id: string;
  code: string;
  status: BatchStatus;
  recipeCode: string;
  recipeName: string;
  productName: string;
  reactor: string;
  targetOutputKg: number;
  plannedStartAt: string;
  progressDone: number;
  progressTotal: number;
}

export type BatchDetail = Batch & { revision: number };

export interface StationQueueItem {
  id: string;
  code: string;
  status: BatchStatus;
  productName: string;
  reactor: string;
  targetOutputKg: number;
  plannedStartAt: string;
  progressDone: number;
  progressTotal: number;
  currentStep?: string;
}

export interface RecipeRow {
  id: string;
  revision: number;
  code: string;
  name: string;
  productName: string;
  version: string;
  baseOutputKg: number;
  active: boolean;
  stepCount: number;
  steps: Recipe["steps"];
  notes?: string;
}

export interface RecipeOption {
  id: string;
  code: string;
  name: string;
  productName: string;
  version: string;
  baseOutputKg: number;
}
