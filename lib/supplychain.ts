import { Prisma, UserRole, SupplyChainStage } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

/**
 * Human-readable business identifiers. Base36 of the clock keeps them short and
 * monotonically increasing, which is enough for a single-node demo deployment.
 */
export function businessNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')}`;
}

export function shortCode(value: string, length = 3) {
  return value.replace(/[^A-Za-z]/g, '').slice(0, length).toUpperCase().padEnd(length, 'X');
}

export type ChainEventInput = {
  batchId: string;
  stage: SupplyChainStage;
  actorId?: string | null;
  actorRole?: UserRole | null;
  title: string;
  description: string;
  quantityKg?: number | null;
  pricePerKg?: number | null;
  refType?: string | null;
  refId?: string | null;
  /** Margins and purchase costs are only visible to the parties and to admin. */
  isConfidential?: boolean;
};

export async function recordChainEvent(tx: Tx, input: ChainEventInput) {
  return tx.supplyChainEvent.create({
    data: {
      batchId: input.batchId,
      stage: input.stage,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      title: input.title,
      description: input.description,
      quantityKg: input.quantityKg ?? null,
      pricePerKg: input.pricePerKg ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      isConfidential: input.isConfidential ?? false,
    },
  });
}
